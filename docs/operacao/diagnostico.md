# Diagnóstico de erros

Última revisão: 02/10/2026. Guia para investigação; não comprova acesso ou inspeção do serviço publicado. [Roadmap](../roadmap.md).

## Railway

No projeto, selecionar o serviço da API, abrir o deployment correspondente e consultar **Deploy Logs** para erros de execução. **Build Logs** mostra instalação/compilação. **Observability → Log Explorer** permite procurar por serviço e período. O Railway captura stdout/stderr, incluindo `console.log` e `console.error`. [Documentação oficial de logs](https://docs.railway.com/observability/logs).

Na CLI vinculada ao projeto, `railway logs` acompanha logs do serviço; `railway logs --since 1h` busca o último período. Selecionar explicitamente serviço/ambiente quando houver mais de um. [Referência oficial da CLI](https://docs.railway.com/cli/logs).

## Investigar uma falha

1. Registrar operação, horário/fuso, status HTTP, mensagem e `requestId` da resposta, quando presente. Verificar o commit do deployment.
2. Reproduzir com conta de teste e procurar o mesmo período/identificador nos logs do serviço correto.
3. Distinguir falha de build/startup, banco/migração, provedor externo, autenticação, validação e cota. CI verde não substitui esse diagnóstico.

O [handler de erros](../../src/middlewares/errorHandler.ts) registra identificador, método, rota e código para erros inesperados. Erros de validação/regras de negócio podem só retornar HTTP, sem linha no console. O serviço também usa códigos como `CONFIRMATION_EMAIL_FAILED`, `PASSWORD_RESET_EMAIL_FAILED` e `SIGNUP_CONFIRMATION_FAILED`; não se pode afirmar que todo erro tem stack trace ou correlação completa.

## Limites

Não incluir senhas, tokens, corpo de recuperação ou credenciais em relatos/logs compartilhados. Sanitização dos demais logs, métricas, timeouts e alertas ainda têm pendências no roadmap. Tráfego real e topologia do proxy devem ser conferidos antes de interpretar cotas; os testes locais não reproduzem a eduroam inteira.

## Arquivos locais e upload

O [`.gitignore`](../../.gitignore) exclui o script pessoal `backup-production.ps1`, dumps SQL (inclusive compactados ou parciais), diretórios de backup, logs, variações de `.env`, chaves privadas e resultados locais. A exceção `.env.example` conserva o modelo público. Os arquivos `prisma/migrations/**/migration.sql` continuam versionáveis: são instruções de migração, não cópias de dados.

O [`.railwayignore`](../../.railwayignore) também protege esses arquivos no upload por `railway up` e retira documentação, testes, exemplos HTTP e ferramentas de auditoria do pacote. Permanecem incluídos código, templates, dependências declaradas, configuração TypeScript, migrações e `scripts/copy-views.cjs`. Essa regra se aplica ao upload da CLI; não comprova o conteúdo de deployments anteriores ou de outras formas de publicação. [Referência oficial](https://docs.railway.com/cli/up#file-handling).

O [`api.http`](../../api.http) é um exemplo versionado, com destino local padrão. Tokens, senha de teste, token push e identificador de usuário são obtidos de variáveis do ambiente local (`SECOMP_ACCESS_TOKEN`, `SECOMP_TEST_PASSWORD`, `SECOMP_TEST_PUSH_TOKEN`, `SECOMP_TEST_USER_ID`). Não salvar credenciais reais no exemplo. [Sintaxe do REST Client](https://github.com/Huachao/vscode-restclient#system-variables).

Na revisão de 02/10/2026 sobre a base `f8d6b5c`, o script de backup estava não rastreado; foi preservado. Foram removidos do exemplo quatro JWTs literais cujo payload indicava expiração em 2025, além de dados literais de conta/push/identificador. O histórico do Git conserva as versões anteriores. A busca por padrões de JWT, chave privada, chaves de provedores e hashes bcrypt não encontrou outras ocorrências literais nos arquivos rastreados atuais; isso não equivale a uma verificação de todos os segredos possíveis.

Regras de ignore não removem arquivos já rastreados e não impedem inclusão forçada com `git add -f`. Conferir `git status` e o conjunto de arquivos antes de publicar. A exportação do backup e sua restauração precisam de evidência própria; estas exclusões não comprovam sua execução.
