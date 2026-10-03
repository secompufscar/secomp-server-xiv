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
