# Diagnóstico de erros

Última revisão: 03/10/2026. Guia para investigação; resultados específicos de produção ficam nos relatos de incidentes. [Roadmap](../roadmap.md).

## Railway

No projeto, selecionar o serviço da API, abrir o deployment correspondente e consultar **Deploy Logs** para erros de execução. **Build Logs** mostra instalação/compilação. **Observability → Log Explorer** permite procurar por serviço e período. O Railway captura stdout/stderr, incluindo `console.log` e `console.error`. [Documentação oficial de logs](https://docs.railway.com/observability/logs).

Na CLI vinculada ao projeto, `railway logs` acompanha logs do serviço; `railway logs --since 1h` busca o último período. Selecionar explicitamente serviço/ambiente quando houver mais de um. [Referência oficial da CLI](https://docs.railway.com/cli/logs).

## Investigar uma falha

1. Registrar operação, horário/fuso, status HTTP, mensagem e `requestId` da resposta, quando presente. Verificar o commit do deployment.
2. Reproduzir com conta de teste e procurar o mesmo período/identificador nos logs do serviço correto.
3. Distinguir falha de build/startup, banco/migração, provedor externo, autenticação, validação e cota. CI verde não substitui esse diagnóstico.

O [handler de erros](../../src/middlewares/errorHandler.ts) registra uma linha JSON com identificador, método, rota, código público, tipo de erro permitido e `databaseCode` quando for um código Prisma reconhecido. Não registra mensagem interna, stack, parâmetros de consulta ou corpo. Os middlewares de autenticação encaminham falhas inesperadas para esse handler; falha do banco não significa senha incorreta. Erros de validação/regras de negócio podem só retornar HTTP, sem linha no console. O serviço também usa códigos como `CONFIRMATION_EMAIL_FAILED`, `PASSWORD_RESET_EMAIL_FAILED` e `SIGNUP_CONFIRMATION_FAILED`; não se pode afirmar que todo erro tem stack trace ou correlação completa.

## Conexão intermitente com o banco

As leituras de usuário por ID/e-mail, refresh token, edição atual e readiness repetem até duas vezes após `P1001`/`P1017`, com esperas de 100/250 ms. A criação/rotação de sessão só pode repetir a transação se a falha aconteceu antes da primeira escrita. Não há repetição de escrita ou commit com resultado incerto, nem reset do pool compartilhado. O evento `DATABASE_CONNECTION_RETRY` contém somente operação permitida, código e número da tentativa.

Indisponibilidade reconhecida (`P1001`, `P1002`, `P1008`, `P1017`, `P2024`) que chega ao handler retorna HTTP 503, `DATABASE_UNAVAILABLE`, `Retry-After: 1` e `requestId`; detalhes técnicos ficam no log. Outras falhas continuam com seus contratos anteriores. Readiness mantém HTTP 503 com `{status: "unavailable"}`. Esse mecanismo é limitado aos caminhos indicados e não corrige a infraestrutura nem recupera transações já iniciadas com escrita.

Para novas ocorrências, correlacionar `requestId` e `databaseCode` com logs do MySQL, uptime, conexões, DNS/rede privada e deployment. Não presumir falta de migração, problema de senha ou CORS a partir de um HTTP 500. A [investigação de 03/10](../historico/auditorias/login-database-connection-2026-10-03.md) distingue a desconexão confirmada das causas de infraestrutura ainda não demonstradas.

## Limites

Não incluir senhas, tokens, corpo de recuperação ou credenciais em relatos/logs compartilhados. Sanitização dos demais logs, métricas, timeouts e alertas ainda têm pendências no roadmap. Tráfego real e topologia do proxy devem ser conferidos antes de interpretar cotas; os testes locais não reproduzem a eduroam inteira.

## Arquivos locais e upload

O [`.gitignore`](../../.gitignore) exclui o script pessoal `backup-production.ps1`, dumps SQL (inclusive compactados ou parciais), diretórios de backup, logs, variações de `.env`, chaves privadas e resultados locais. A exceção `.env.example` conserva o modelo público. Os arquivos `prisma/migrations/**/migration.sql` continuam versionáveis: são instruções de migração, não cópias de dados.

O [`.railwayignore`](../../.railwayignore) também protege esses arquivos no upload por `railway up` e retira documentação, testes, exemplos HTTP e ferramentas de auditoria do pacote. Permanecem incluídos código, templates, dependências declaradas, configuração TypeScript, migrações e `scripts/copy-views.cjs`. Essa regra se aplica ao upload da CLI; não comprova o conteúdo de deployments anteriores ou de outras formas de publicação. [Referência oficial](https://docs.railway.com/cli/up#file-handling).

O [`api.http`](../../api.http) é um exemplo versionado, com destino local padrão. Tokens, senha de teste, token push e identificador de usuário são obtidos de variáveis do ambiente local (`SECOMP_ACCESS_TOKEN`, `SECOMP_TEST_PASSWORD`, `SECOMP_TEST_PUSH_TOKEN`, `SECOMP_TEST_USER_ID`). Não salvar credenciais reais no exemplo. [Sintaxe do REST Client](https://github.com/Huachao/vscode-restclient#system-variables).

Na revisão de 02/10/2026 sobre a base `f8d6b5c`, o script de backup estava não rastreado; foi preservado. Foram removidos do exemplo quatro JWTs literais cujo payload indicava expiração em 2025, além de dados literais de conta/push/identificador. O histórico do Git conserva as versões anteriores. A busca por padrões de JWT, chave privada, chaves de provedores e hashes bcrypt não encontrou outras ocorrências literais nos arquivos rastreados atuais; isso não equivale a uma verificação de todos os segredos possíveis.

Regras de ignore não removem arquivos já rastreados e não impedem inclusão forçada com `git add -f`. Conferir `git status` e o conjunto de arquivos antes de publicar. A exportação do backup e sua restauração precisam de evidência própria; estas exclusões não comprovam sua execução.
