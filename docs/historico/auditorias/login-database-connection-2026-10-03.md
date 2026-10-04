# Login e desconexão do banco — 03/10/2026

Investigação no deployment Railway `0c148d97-0b0f-4f55-8e0f-41baf265fe24`, código funcional `633e8c8`, sem alteração de contas ou sessões reais durante o diagnóstico.

## Evidências de produção

- Os IDs `12e0c3ba-80b0-4114-9a61-056704e61cc0`, `6f689ef0-004b-4a53-ba36-4da26c9d511f` e `998c183f-b5d3-4d39-b8c3-675f63171c22` foram encontrados às 21:03:30/21:04:00 UTC (18:03/18:04 de Brasília). O handler antigo só registrava `INTERNAL_SERVER_ERROR`, sem a causa desses três erros.
- O snapshot de 131 linhas até 22:00:57 UTC continha 11 registros desse código, quatro na rota `/login`, além de refresh e consultas. Os logs do middleware de autenticação às 20:39:45 e 21:36:40 UTC continham `PrismaClientKnownRequestError`, `P1017`, modelo User e “Server has closed the connection”. Isso confirma falha de conexão em autenticação; não prova isoladamente a causa de cada ID de login.
- Banco privado acessível, usuários/sessões consultáveis, formato bcrypt e comparação funcionando, chaves válidas e tokens modernos/legados gerados em memória. Hashes dos módulos de login, sessões, repositório e Prisma coincidiram com o build local publicado.
- MySQL sem reinício no intervalo: uptime aproximado de 11h32, `wait_timeout` global/sessão de 28.800 segundos, limite de 151 conexões e máximo observado de cinco. Não havia falhas por limite de conexões. URL interna sem opções extras de pool. Isso não exclui interrupção de rede nem identifica quem encerrou cada socket.
- Requisições públicas de controle: edição atual 200; login com endereço fictício inexistente 404/`API_ERROR`. Não foi realizado login com senha de participante durante a investigação.

## Reprodução e correção limitada

Em uma conexão Prisma de diagnóstico isolada, pool de uma conexão, foi alterado apenas o `wait_timeout` daquela sessão para um segundo. Após 2,2 segundos sem consulta, as leituras deram `P1001`, depois `P1017`; a terceira tentativa recuperou e as próximas passaram. Nenhum timeout global ou dado foi alterado. Esse experimento reproduz a recuperação após socket encerrado; não demonstra que o timeout global causou o incidente real.

A API passa a recuperar até duas falhas de conexão em leituras do caminho de login/autenticação/refresh, edição atual e readiness. Criação/rotação de sessão pode repetir apenas quando a falha ocorre antes de qualquer escrita. Escritas e commits não são repetidos quando o resultado é incerto. Falha persistente reconhecida retorna 503 com identificador, e logs estruturados registram código Prisma sem mensagem, stack ou credenciais.

O teste MySQL isolado encerra uma conexão real antes do login legado e moderno, verifica recuperação, tokens válidos, exatamente uma sessão moderna e usuário integralmente preservado. Testes de contrato verificam limite de tentativas, ausência de dados privados nos logs, ausência de repetição após escrita/commit e resposta 503 pelos middlewares de usuário/admin.

Não foi identificada a origem física do encerramento dos sockets. A nova classificação deve ser usada para correlacionar novas ocorrências; sucesso de leitura ou CI não comprova estabilidade de todos os logins reais. Evidência de publicação e validação posterior deve ser registrada separadamente.

## Publicação e limites posteriores

O [PR #31](https://github.com/secompufscar/secomp-server-xiv/pull/31) foi integrado em `3fa481f3663c69a1dc95108776b7e6ce84dd15c0` antes do upload. CI do PR e desse merge aprovado. Railway concluiu o deployment `d41dedf2-e474-461a-adec-3dee8cc9edc6`, criado em 03/10 às 23:45:55 UTC (20:45:55 BRT). A correção não altera schema/migrações nem o app.

Backup novo pela conexão privada, SHA-256 `f1cac597640ce14eeafedd0c380aa9473434e0f855f37374492352f806223560`, foi restaurado em MySQL isolado. Migrações conferidas, todos os campos originais preservados: 254 contas, 39 atividades, 429 inscrições em atividades, 194 na edição e 33 sessões. Nenhum dump foi incluído no Git ou no upload.

Após a publicação: `/health/live`, `/health/ready` e `/event/current` retornaram 200; login com endereço fictício inexistente retornou 404, conforme o contrato. Inspeção privada confirmou banco acessível, geração de tokens e módulo atualizado de sessões. Não foi usado acesso de participante real. A tentativa de repetir a queda simulada pela CLI após deploy expirou na conexão de diagnóstico; a recuperação foi comprovada na integração MySQL isolada, mas essa tentativa remota não é evidência de sucesso.

Fluxos de rede próximos aos IDs originais mostram três descartes `NO_SOCKET` às 21:03:07, 21:03:29 e 21:03:42 UTC, de origem 3306 para portas temporárias da API. A proximidade com os erros reforça a investigação de conexão, sem identificar causa física nem vincular cada pacote a um requestId HTTP.

Às 23:50:28 UTC, após o novo deploy, houve `P1017` em `activityImage.findMany`, caminho fora da proteção de leituras selecionadas do login. O incidente de infraestrutura e a revisão de outros leitores continuam abertos; não se declara eliminação global das desconexões. Não há necessidade de reset de contas, troca de senhas, revogação coletiva ou novo APK para esta correção.
