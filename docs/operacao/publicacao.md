# Publicação e migrações

Última revisão: 07/10/2026. Este guia descreve o procedimento operacional. A API `dea590e2` foi publicada após merge do PR #33 e CI aprovado, com a migração de instante de presença aplicada e a lista geral validada online. O app do PR #21 foi mergeado depois e publicado automaticamente na Vercel. [Evidência de 06/10](../historico/auditorias/participant-directory-release-2026-10-06.md). As [rodadas de 03/10](../historico/auditorias/production-deployment-2026-10-03.md) conservam as verificações anteriores de login e migrações. [Roadmap](../roadmap.md).

## Preparação

1. Identificar commit, PRs, ambiente e serviço da API. Aprovar a CI e mergear o PR da API no GitHub antes de publicar; atualizar a cópia local e conferir o commit usado. Quando o app depender dessa API, validar o serviço publicado antes de mergear o PR do app que dispara a Vercel.
2. Fazer um backup atualizado da produção, restaurá-lo em banco isolado e ensaiar as migrações com os dados atuais. Conferir configuração dos segredos sem expor valores.
3. Manter a exigência de versão desativada para esta continuidade da API. Confirmar origem `https://secomp-app-xiv.vercel.app` e configuração do proxy.
4. Conferir migrações pendentes e edições atuais duplicadas. A constraint não resolve duplicatas automaticamente. Consultar [consistência de edição](../historico/correcoes/edition-registration-consistency.md).

## Banco e aplicação

Aplicar `npm run migrate:deploy` antes do código que depende das colunas novas; conferir `npm run migrate:status` depois. Não usar `migrate dev`, `db push`, reset ou exclusão de registros de migração em produção.

A lista geral requer `20261006090000_attendance_timestamp`, aplicada antes da API do PR #33. O backup atualizado foi feito por SSH/conexão privada, sem tornar o banco público. O ensaio preservou os campos originais e a conferência privada confirmou término/checksum da migração. A recuperação conservadora de horários legados compara os tipos DATETIME/TIMESTAMP com a sessão SQL em UTC e restaura o fuso anterior. [Evidência](../historico/auditorias/participant-directory-release-2026-10-06.md).

`20261007010000_require_attendance_timestamp` garante horário em novas presenças por triggers `userAtActivity_checkedInAt_insert` e `userAtActivity_checkedInAt_update`. Exige permissão MySQL para criar triggers. Ensaiar em cópia isolada e conferir ambos em `information_schema.TRIGGERS`, além de término/checksum da migração. A instalação não reescreve presenças anteriores. A API existente já fornece horário, portanto essa proteção é compatível e não exige novo app/APK. Não remover triggers ou o histórico da migração em produção para tentar desfazer um erro.

As etapas anteriores incluem sessões renováveis, versão de autenticação, crédito de presença e integridade da edição. O PR #22, já integrado, acrescenta `20260930030000_verified_email_change`, com e-mail pendente/versão. Publicar o código atual exige também essa migração. [Detalhes do #22](../historico/correcoes/verified-email-change.md).

Um ensaio anterior de 03/10/2026 restaurou o backup de 02/10 em MySQL local 8.4.11 (origem 9.7.2), aplicou as 12 migrações e terminou com `prisma migrate status` atualizado. Preservou as 227 contas e todos os campos originais; removeu apenas uma inscrição duplicada, mantendo o registro de presença. O relatório local registra `migrationRehearsalCompleted: true` e todas as verificações de integridade como `true`. Esse ensaio não substitui um backup e uma conferência feitos imediatamente antes do deploy, nem comprova execução na versão exata do MySQL de produção.

Antes da publicação efetiva de 03/10, foi feito outro backup atualizado, com 247 contas, 39 atividades e 387 inscrições em atividades. Restauração e ensaio passaram no commit `e2080ac`; a deduplicação prevista deixou 386 inscrições. A produção aplicou nove migrações pendentes, totalizando 12, e a conferência posterior confirmou esses totais e o status atualizado. Não houve restauração ou seed em produção. [Resultados e limitações](../historico/auditorias/production-deployment-2026-10-03.md).

## Segredos e continuidade das sessões

Preservar exatamente os valores existentes de `JWT_SECRET`, `JWT_RESET_SECRET` e `EMAIL_SECRET`: eles validam tokens de acesso, recuperação e confirmação já emitidos. Se algum tiver menos de 32 bytes, fornecer o correspondente `JWT_SIGNING_SECRET`, `JWT_RESET_SIGNING_SECRET` ou `EMAIL_SIGNING_SECRET` com pelo menos 32 bytes aleatórios. Os novos tokens usam a chave de assinatura; as chaves antigas são aceitas apenas para validação durante a transição. Todos os valores devem ser distintos. O startup recusa chave curta sem chave de assinatura forte. Testar login web, token legado e links pendentes antes de considerar a publicação concluída. Remover a validação pelas chaves antigas requer uma mudança posterior planejada, após expiração dos tokens.

Atualizar todas as instâncias antes de declarar proteção por versão/bloqueios confirmada. Misturar código antigo e novo não garante revogação ou coordenação completa. Migração bem-sucedida não comprova atualização da aplicação.

## Validação após publicação

Com contas controladas, conferir versão informada, login legado/web/iOS, cadastro/QR/e-mail, recuperação voluntária, inscrição/fila/cancelamento e check-in com nomes/total. Conferir CORS e erros, métricas e 429 da rede compartilhada. Testar também confirmação do novo endereço, novo login e recusa de links anteriores; verificar edição só do nome sem logout.

Registrar commit implantado, resultado de migrações, horário, evidência de rotas e problemas encontrados. Estado online só pode ser marcado como confirmado com essa evidência.

## Recuperação e compatibilidade

Para desfazer bloqueio de versão, desativar a exigência e reiniciar a API. Para erro de código, preferir correção que mantenha o protocolo de versões; código antigo pode voltar a aceitar tokens revogados. Alterações de banco exigem backup testado ou migração corretiva; não remover colunas ou histórico de migrações por tentativa.

Esta rodada não exige novo APK, reset coletivo ou recálculo de pontos. O [runbook P0 original](../historico/correcoes/p0-deployment-runbook.md) registra também distribuição de aplicativo e lojas, que não é pré-requisito dessas melhorias apenas na API.
