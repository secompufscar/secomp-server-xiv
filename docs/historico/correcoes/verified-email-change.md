# Troca de e-mail verificada e senha administrativa — 30/09/2026

Registro de implementação/auditoria preservado para rastreabilidade. O estado vigente está no [roadmap](../../roadmap.md).

Continuidade dos achados A2/A3 da [auditoria por blocos](../auditorias/functional-block-review-2026-09-29.md), na branch `codex/verified-email-change`, iniciada no `main` após o merge dos PRs #17–20. Implementação e testes não comprovam deploy.

## Comportamento

`PATCH /users/updateProfile` mantém nome/e-mail no corpo e perfil público no HTTP 200. Nome é atualizado normalmente. Um novo e-mail é armazenado como solicitação pendente, recebe um link com validade de um dia e só substitui o endereço ativo após confirmação. Até lá, login, recuperação, sessões, presença e inscrições continuam usando a conta e o endereço atuais. A resposta mantém `email` com o endereço ativo; nenhum campo interno entra no perfil.

`PUT /admin/edit` também passa a solicitar confirmação de `updatedEmail`. Mantém o e-mail atual até a confirmação e HTTP 201 com a projeção administrativa. Quando o administrador envia `senha`, o bcrypt, a versão de autenticação e a revogação dos refresh tokens são gravados juntos em transação. Isso encerra somente os acessos anteriores da conta cuja senha foi alterada. Edição só do nome não muda versões nem encerra sessões.

Ao confirmar a troca de e-mail, a transação trava a conta, verifica endereço ativo, endereço pendente, versão de e-mail e versão de autenticação, revalida a disponibilidade do endereço e grava a troca junto com a revogação de sessões. Links de recuperação anteriores e tokens de acesso passam a falhar pela versão de autenticação; links de confirmação anteriores falham pela versão de e-mail. Repetir o link de troca não grava novamente. Senha, ID, QR, pontos, inscrições e outras contas permanecem intactos.

Não há reset coletivo, logout geral, novo APK ou novos campos obrigatórios no app. A pessoa que escolheu concluir uma troca de e-mail precisa entrar novamente com o novo endereço e a mesma senha; a página de confirmação informa isso. Uma troca de senha administrativa também exige novo login apenas da conta editada.

## Reenvio, cancelamento e falhas

- Repetir a edição com o novo endereço envia uma nova confirmação e invalida a anterior pela versão. Informar outro endereço substitui a pendência; enviar o endereço ativo cancela a pendência sem logout.
- Edição só do nome preserva a pendência e seus links. Mudar a senha invalida um link pendente de troca; repetir a solicitação emite um link atualizado.
- Falha/timeout de e-mail mantém a solicitação gravada e o endereço ativo funcionando. O provedor pode já ter aceitado o e-mail; nunca se exclui a conta. A API retorna erro de envio; a solicitação pode ser repetida. Nome e eventual senha administrativa enviados na mesma requisição já estão gravados nesse caso: a chamada ao provedor acontece depois do commit e não é uma transação distribuída.
- Endereço já ocupado falha antes da pendência. Endereços pendentes não são reservados: a confirmação verifica novamente a constraint única, inclusive se outra conta ocupou o endereço depois da solicitação.
- Pedidos concorrentes e snapshots alterados durante o processamento não sobrescrevem credenciais novas; retornam conflito. Falha depois da escrita da conta ou da revogação faz rollback completo.
- Não há reenvio automático persistente. O fluxo requer sessão autenticada e controle do novo endereço; não acrescenta senha obrigatória à edição, preservando o contrato dos clientes existentes.

## Tokens, validação e cotas

Novas confirmações de cadastro incluem endereço, `emailVersion` e finalidade `email-confirmation`; trocas usam finalidade `email-change` e também vinculam endereço ativo e `authVersion`. Finalidade diferente, falta de expiração, endereço incorreto, versão inválida, expiração e assinatura inválida não concluem mudanças.

Confirmações legadas com apenas `userId` continuam aceitas somente na versão de e-mail zero, até a expiração original. A migração não invalida links ou sessões em massa. Endereços mudados historicamente antes desta proteção não podem ser reconstruídos a partir de um token antigo sem endereço; esta alteração não anuncia reparação retroativa desses casos.

Nome/e-mail passam por validação e whitelist. E-mails são normalizados e limitados a 191 caracteres, capacidade da coluna ativa já existente; nunca se agenda um endereço que falharia na gravação final. Senhas administrativas novas usam o limite de 72 bytes UTF-8 do bcrypt. `pendingEmail`, `emailVersion` e `authVersion` não são aceitos como campos de edição pública nem retornados nas projeções.

Pedidos de troca do participante têm contadores próprios: limite menor por ID autenticado e teto amplo por rede, com as configurações existentes de operações de conta. Edição só do nome ignora esses contadores. As cotas de login/cadastro/recuperação continuam independentes, inclusive na eduroam. A rota administrativa permanece protegida por ADMIN e não usa a cota individual de troca do participante; seu uso e o volume de e-mail exigem monitoramento. Contadores continuam em memória por instância.

## Migração e publicação

Migração aditiva `20260930030000_verified_email_change`: `users.emailVersion` com default zero e `users.pendingEmail` nullable. Não reescreve e-mails, senhas, confirmações, pontos nem inscrições.

1. Confirmar backup, configuração existente de segredos e migrações anteriores. Sem rotação automática de chaves.
2. Aplicar migrações versionadas antes de iniciar o código novo; não usar `db push`, `migrate dev` ou reset em produção.
3. Atualizar todas as instâncias: o código antigo altera e-mail diretamente e não implementa esta confirmação. Durante mistura de versões não há garantia do protocolo completo.
4. Testar com conta controlada: login antigo/web/iOS, nome, solicitação, recebimento no novo endereço, confirmação, novo login e recusa de links anteriores. Conferir nomes/total de presentes e inscrições sem alterações.

O build copia templates para `dist/views`; o bootstrap agora resolve views junto ao código executado, funcionando em `src` e em artefato compilado. Sucesso de cadastro mantém o redirecionamento antigo; troca usa a mesma página com instrução para novo login. O pacote contém o novo template de e-mail. Exigência de versão de app e origem CORS não foram alteradas.

Nenhum deploy, migração de produção, e-mail real ou edição de conta de participante foi executado nesta validação.

## Evidências

- Testes HTTP preservam perfil público e status, filtram campos internos, mantêm nome independente, verificam finalidade/expiração e redirecionamento. Sender real com Brevo substituído confirma endereço, conteúdo e claims sem envio externo.
- 100 IDs no mesmo IP pedem alteração sem compartilhar a cota individual; abuso de um ID retorna 429 e não impede nome ou outro participante.
- MySQL isolado: migrações aplicadas, solicitação mantém acesso legado, confirmação concorrente tem um sucesso, links antigos/reset/refresh deixam de funcionar, conflito de endereço e falhas preservam estado. Rollback após revogação testado tanto para troca de e-mail quanto para senha administrativa, com outra conta intacta.
- `npm run verify`: 107 testes aprovados, oito integrações opt-in ignoradas na suíte padrão, zero falhas; TypeScript aprovado. Runner MySQL: sete integrações aprovadas e 12 migrações aplicadas; schema e servidor/diretório temporários removidos. Build aprovado; templates compilados de confirmação renderizados nos dois modos com instrução de login apenas para troca. CI é verificada separadamente no PR.

Uma tentativa local de `verify` teve `EPERM` ao regenerar a DLL do Prisma enquanto o teste MySQL a usava no Windows; regeneração deve ocorrer depois do encerramento desse processo. Não se trata de falha de migração nem de escrita em produção.
