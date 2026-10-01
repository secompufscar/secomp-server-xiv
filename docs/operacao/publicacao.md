# Publicação e migrações

Última revisão: 30/09/2026. Produção não inspecionada; procedimento operacional, não registro de deploy. [Roadmap](../roadmap.md).

## Preparação

1. Identificar commit, PRs integrados, ambiente e serviço da API. Fazer pull antes de publicar e verificar CI no commit que será usado.
2. Confirmar backup restaurável e configuração existente de segredos, sem rotação automática ou exposição em logs.
3. Manter a exigência de versão desativada para esta continuidade da API. Confirmar origem `https://secomp-app-xiv.vercel.app` e configuração do proxy.
4. Conferir migrações pendentes e edições atuais duplicadas. A constraint não resolve duplicatas automaticamente. Consultar [consistência de edição](../historico/correcoes/edition-registration-consistency.md).

## Banco e aplicação

Aplicar `npm run migrate:deploy` antes do código que depende das colunas novas; conferir `npm run migrate:status` depois. Não usar `migrate dev`, `db push`, reset ou exclusão de registros de migração em produção.

As etapas anteriores incluem sessões renováveis, versão de autenticação, crédito de presença e integridade da edição. O PR #22 acrescenta a migração de e-mail pendente/versão; ela só pertence ao deploy se esse PR estiver no commit publicado. [Detalhes do #22](../historico/correcoes/verified-email-change.md).

Atualizar todas as instâncias antes de declarar proteção por versão/bloqueios confirmada. Misturar código antigo e novo não garante revogação ou coordenação completa. Migração bem-sucedida não comprova atualização da aplicação.

## Validação após publicação

Com contas controladas, conferir versão informada, login legado/web/iOS, cadastro/QR/e-mail, recuperação voluntária, inscrição/fila/cancelamento e check-in com nomes/total. Conferir CORS e erros, métricas e 429 da rede compartilhada. Quando houver #22, testar confirmação do novo endereço, novo login e recusa de links anteriores; verificar edição só do nome sem logout.

Registrar commit implantado, resultado de migrações, horário, evidência de rotas e problemas encontrados. Estado online só pode ser marcado como confirmado com essa evidência.

## Recuperação e compatibilidade

Para desfazer bloqueio de versão, desativar a exigência e reiniciar a API. Para erro de código, preferir correção que mantenha o protocolo de versões; código antigo pode voltar a aceitar tokens revogados. Alterações de banco exigem backup testado ou migração corretiva; não remover colunas ou histórico de migrações por tentativa.

Esta rodada não exige novo APK, reset coletivo ou recálculo de pontos. O [runbook P0 original](../historico/correcoes/p0-deployment-runbook.md) registra também distribuição de aplicativo e lojas, que não é pré-requisito dessas melhorias apenas na API.
