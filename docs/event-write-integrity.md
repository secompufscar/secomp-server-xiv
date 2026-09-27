# Integridade das escritas de evento e inscrição

## Problema

- A criação de um evento persistia o evento antes de redefinir os status de inscrição dos usuários. Uma falha na segunda escrita deixava o evento criado sem o estado esperado.
- A criação de uma inscrição persistia `UserEvent` antes de atualizar `User.registrationStatus` e `currentEdition`. Uma falha deixava o vínculo e o perfil divergentes.
- A exclusão de um evento marcava todos os usuários como encerrados antes de tentar removê-lo. Eventos de outras edições eram afetados mesmo se a exclusão falhasse.

## Correção

As escritas relacionadas de cada operação agora usam uma transação Prisma. A criação de inscrição mantém o ano da edição e o status confirmado nos mesmos valores anteriores. Na exclusão, o evento é removido primeiro dentro da transação; a atualização do status alcança apenas usuários cujo `currentEdition` corresponde ao ano excluído. Se uma chave estrangeira impedir a exclusão, nenhuma atualização de usuário é executada. As linhas de `UserEvent` continuam seguindo a cascata definida no schema; atualizá-las imediatamente antes da exclusão era redundante.

## Verificação e limites

`tests/event-write-atomicity.test.cjs` verifica a composição transacional, a propagação de falhas e o filtro da edição. `npm run verify` cobre TypeScript e a suíte de testes. Estes testes usam um cliente Prisma substituto: a reversão efetiva no MySQL ainda requer teste de integração em banco isolado. Não há migração nem mudança nas respostas de sucesso.

Ainda falta transacionar o cancelamento de inscrição e revisar a regra de edição atual sob concorrência. O reset global na criação de uma nova edição conserva o comportamento atual e precisa de uma decisão funcional antes de mudar seu alcance.
