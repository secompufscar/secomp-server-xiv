# Cancelamento de inscrição: atomicidade

O cancelamento removia `UserEvent`, os vínculos de atividades e promovia a fila em operações independentes. Uma falha podia deixar a inscrição removida, com vínculos remanescentes ou sem promoção.

`deleteWithActivitiesAndWaitlist` agora verifica o titular e executa todas essas operações na mesma transação Prisma. O filtro de atividades continua limitado ao usuário e ao `eventId` da inscrição. A fila mantém a ordenação por `createdAt` e a promoção de uma inscrição pendente, conforme o comportamento anterior.

## Contratos e limites

- `DELETE /userEvent/:id` mantém autenticação, `200` com corpo vazio no sucesso e `404` para inscrição ausente ou de outro titular. O Swagger foi corrigido de `204` para o `200` já praticado.
- Nenhuma migração ou novo APK é necessário para esta alteração.
- Esta etapa não altera os campos duplicados `User.registrationStatus`/`currentEdition`, pontos, nem a regra de promoção ao cancelar inscrições pendentes ou encerradas. Essas regras e a concorrência entre cancelamentos distintos continuam pendentes no P1-03/P1-04; atomicidade não comprova a correção dessas regras.
- As listagens administrativas preservam `user.nome` e `presente`, permitindo filtrar os presentes e contar o total. Este patch não muda os endpoints de presença nem acrescenta um campo agregado de total.

## Evidência

`tests/registration-cancellation.test.cjs` exercita a rota real, middleware, serviço e composição transacional, com autenticação, titularidade, repetição e resposta vazia. `tests/registration-cancellation.integration.test.cjs` usa MySQL e injeta uma exceção **após executar** cada uma das três escritas. Compara todas as inscrições, vínculos e usuários antes/depois para comprovar rollback, além de verificar sucesso, ordem da fila, cancelamento sem fila e isolamento de outras edições/usuários/atividades sem edição.

Em 28/09/2026, `npm run test:db:atomicity` passou em uma instância MySQL 8.4.11 temporária, limitada a `127.0.0.1:3308`. As oito migrações foram aplicadas ao schema `secomp_xiv_codex_test_1106702f3d4a`; os dois testes de integração passaram e o executor removeu o schema. O serviço MySQL existente e seu banco `secomp` não receberam alterações.

A CI passa a executar a mesma integração em um serviço MySQL 8.4 efêmero. A suíte sem banco limita a concorrência a dois processos após esgotamento de memória observado com a concorrência padrão no ambiente local.

Merge, CI e teste local não comprovam deploy, migrações nem comportamento em produção.
