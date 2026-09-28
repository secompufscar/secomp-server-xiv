# Integridade das escritas de evento e inscrição

## Problema

- A criação de um evento persistia o evento antes de redefinir os status de inscrição dos usuários. Uma falha na segunda escrita deixava o evento criado sem o estado esperado.
- A criação de uma inscrição persistia `UserEvent` antes de atualizar `User.registrationStatus` e `currentEdition`. Uma falha deixava o vínculo e o perfil divergentes.
- A exclusão de um evento marcava todos os usuários como encerrados antes de tentar removê-lo. Eventos de outras edições eram afetados mesmo se a exclusão falhasse.

## Correção

As escritas relacionadas de cada operação agora usam uma transação Prisma. A criação de inscrição mantém o ano da edição e o status confirmado nos mesmos valores anteriores. Na exclusão, o evento é removido primeiro dentro da transação; a atualização do status alcança apenas usuários cujo `currentEdition` corresponde ao ano excluído. Se uma chave estrangeira impedir a exclusão, nenhuma atualização de usuário é executada. As linhas de `UserEvent` continuam seguindo a cascata definida no schema; atualizá-las imediatamente antes da exclusão era redundante.

## Verificação e limites

`tests/event-write-atomicity.test.cjs` verifica a composição transacional, a propagação de falhas e o filtro da edição. `tests/event-write-atomicity.integration.test.cjs` injeta falhas depois da primeira escrita e consulta um MySQL real para comprovar o rollback. `npm run verify` cobre TypeScript e a suíte sem banco. Para a integração, configure `DATABASE_URL` com uma conexão administrativa **local** e execute `npm run test:db:atomicity`. O script cria um schema temporário aleatório, aplica as migrações, executa o teste e remove o schema. Se o usuário não puder criar bancos, um administrador pode criar previamente um schema vazio com nome `secomp_xiv_codex_test_` seguido de 12 dígitos hexadecimais e conceder acesso ao usuário da conexão. Nesse caso, defina `TEST_DATABASE_NAME`; `TEST_DATABASE_DROP=1` autoriza o script a removê-lo no final. O script recusa um schema com tabelas e o teste recusa qualquer nome fora desse padrão. Não há migração nem mudança nas respostas de sucesso.

Em 27/09/2026, a integração foi executada contra o MySQL 8.4 local em um schema temporário vazio. As oito migrações foram aplicadas, o teste de rollback passou e o schema foi removido pelo executor. O banco `secomp` não foi migrado nem usado como destino das escritas de teste.

Ainda falta transacionar o cancelamento de inscrição e revisar a regra de edição atual sob concorrência. O reset global na criação de uma nova edição conserva o comportamento atual e precisa de uma decisão funcional antes de mudar seu alcance.
