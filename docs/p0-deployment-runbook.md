# Publicação dos P0

Este roteiro mantém migração, aplicação e política de versão em etapas reversíveis e auditáveis.

## Antes da publicação

1. Confirme que o backup ou snapshot do MySQL pode ser restaurado.
2. Mantenha `APP_VERSION_ENFORCEMENT_ENABLED=false` no ambiente de produção.
3. Execute `npm ci` e `npm run verify` no commit que será publicado.
4. Consulte `npm run migrate:status` usando a `DATABASE_URL` de produção.

## Banco de dados

Execute `npm run migrate:deploy` antes de iniciar a nova aplicação. O comando aplica somente as migrações versionadas em `prisma/migrations`; não use `prisma migrate dev` em produção.

As migrações P0:

- eliminam inscrições duplicadas antes de criar a restrição por usuário e atividade;
- adicionam a regra de inscrição e o `slug` das categorias;
- vinculam atividades à edição do evento quando existe correspondência por data ou evento atual;
- criam as sessões de refresh token.

Depois da migração, execute novamente `npm run migrate:status`. Interrompa a publicação se houver falha ou migração pendente.

## Aplicação

1. Publique a API com a exigência de versão desativada.
2. Valide `GET /api/v1/app/version`, login, refresh, logout, inscrição e check-in.
3. Gere o aplicativo com a mesma chave que assinou o APK `1.0.0` e confirme uma atualização sobre a instalação existente.
4. Publique o aplicativo e confirme que a URL de atualização está acessível.
5. Atualize as versões mínima e mais recente na API.
6. Ative `APP_VERSION_ENFORCEMENT_ENABLED=true` somente após a distribuição estar disponível.

Para desfazer o bloqueio de clientes, restaure `APP_VERSION_ENFORCEMENT_ENABLED=false` e reinicie a API. Reversões de banco devem usar backup testado ou uma migração corretiva; não apague registros de `_prisma_migrations`.
