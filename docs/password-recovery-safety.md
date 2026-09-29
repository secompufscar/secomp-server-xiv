# Recuperação voluntária de senha: uso único e sessões

## Compatibilidade antes do evento

Não há reset coletivo, alteração das senhas existentes, rotação de segredos, exigência de APK novo ou logout geral. **Solicitar o e-mail não modifica credenciais nem encerra sessões.** Somente concluir uma recuperação válida troca a senha e invalida as sessões daquela conta, que poderá entrar novamente com a senha escolhida. Outras contas ficam intactas.

Mantidos: `POST /api/v1/users/sendForgotPasswordEmail`, mensagem genérica de solicitação, link `https://secomp-app-xiv.vercel.app/SetNewPassword?token=...`, `PATCH /api/v1/users/updatePassword/:token`, corpo `{senha}` e sucesso `200 {message: "Senha atualizada com sucesso"}`. Um link repetido/invalidado responde 401 no contrato normal de erro. Links antigos com assinatura válida e expiração original continuam aceitos na versão zero, até a primeira recuperação concluída. Solicitar outro link não invalida os anteriores; concluir uma troca invalida todos os links emitidos antes dela.

## Implementação e concorrência

A migração `20260929010000_user_auth_version` acrescenta `authVersion INT NOT NULL DEFAULT 0` em usuários e refresh sessions, sem substituir hashes nem excluir dados. Tokens antigos sem esse claim representam a versão zero. Tokens de acesso e novos links de recuperação levam a versão atual; os novos links também têm finalidade explícita e identificador aleatório, com a validade anterior de uma hora.

Uma transação atualiza condicionalmente senha e versão da conta e revoga suas refresh sessions. A versão é a condição de consumo: apenas uma tentativa concorrente vence. Falhar após qualquer escrita reverte senha, versão e revogação juntas. A leitura de autenticação que já existia verifica a versão antes de autorizar, inclusive em rotas administrativas. Não foi acrescentada uma consulta por requisição autenticada.

Criação/rotação de refresh sessions bloqueia a linha do usuário antes de escrever e confere sua versão, na mesma ordem de bloqueio do reset. Isso impede uma renovação/login iniciado com credenciais antigas de deixar uma sessão ativa após o reset. A revogação por replay fica limitada à versão da sessão: reproduzir um refresh antigo não encerra as sessões novas criadas depois da recuperação.

## Evidências

- `npm run verify`: 71 testes passaram, três integrações opt-in omitidas nessa execução. Uma checagem adicional de emissão de e-mail foi acrescentada e executada na suíte específica; a CI executa todas.
- `npm run build`: aprovado.
- MySQL 8.4 isolado em loopback: nove migrações aplicadas em schema aleatório; teste anterior de rollback e novo `password-recovery.integration.test.cjs` aprovados. Falhas após alteração de senha/versão e após revogação foram revertidas; concorrência, replay, tokens legados, login após reset, refresh e isolamento de outra conta foram verificados. Schema removido e servidor temporário encerrado.
- `password-recovery.test.cjs`: HTTP real com banco/e-mail simulados, mensagem/rota preservadas, rejeição de replay/tokens inválidos e solicitação sem mudanças na conta. Nenhum e-mail real ou credencial de participante foi usado.
- CI executa testes/TypeScript/build e MySQL em serviço separado, com criação e remoção do schema de teste.

## Publicação e limites

Esta branch continua o PR #15; aquele PR inclui validação dos segredos no startup. Conferir a configuração já existente antes de publicar, sem rotacionar chaves automaticamente. O PR #14 mantém as mudanças independentes de CORS e cancelamento.

Aplicar a migração aditiva **antes** de iniciar o novo código. Ensaiar o deploy e o login legado/web em ambiente de homologação com cópia sanitizada antes de produção; o teste em banco vazio não mede duração de ALTER TABLE ou condições dos dados reais. A compatibilidade com tokens antigos é deliberada; não há invalidação geral no deploy.

A revogação por versão só é garantida quando todas as instâncias da API executam o novo código. Não manter instâncias antigas atendendo após a atualização; uma reversão do código antigo não apaga a coluna, mas deixa de verificar a revogação. Preferir correção que preserve a verificação de versão em vez de restaurar o autenticador antigo após recuperações concluídas.

AUD-02 fica resolvido **para a recuperação voluntária** nesta branch. Mudança de senha administrativa e troca de e-mail verificada permanecem pendentes; esta mudança não anuncia proteção para esses fluxos. Deploy, migração de produção e incidente histórico do iOS não foram confirmados por estes testes.
