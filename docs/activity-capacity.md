# Consistência de vagas e inscrições — item 5

Cada inscrição em atividade agora é criada dentro de uma transação que bloqueia a linha da atividade com `SELECT ... FOR UPDATE`. Todas as inscrições concorrentes para a mesma atividade são serializadas antes da contagem de vagas e da criação do registro.

A mesma trava protege o cancelamento e a promoção da primeira pessoa da lista de espera. Assim, uma nova inscrição não pode ocupar a vaga ao mesmo tempo em que outra transação promove alguém da fila.

## Garantias no banco

A migração `20260922120000_activity_enrollment_constraints` adiciona a restrição única `(userId, activityId)`. Antes de criar o índice, ela remove registros duplicados existentes e preserva, nesta ordem:

1. o registro com presença confirmada;
2. o registro fora da lista de espera;
3. o registro criado primeiro;
4. o menor `id`, para desempate determinístico.

A API retorna conflito (`409`) quando o usuário já está inscrito. Atividades inexistentes retornam `404`; atividades sem quantidade de vagas definida retornam `409`.

## Validação

Os testes unitários simulam inscrições, duplicidades e cancelamentos concorrentes. O teste de integração opcional executa transações reais no MySQL e limpa os usuários, atividade e categoria temporários ao terminar:

```powershell
$env:RUN_DATABASE_INTEGRATION='1'
node --require ts-node/register --test tests/activity-capacity.integration.test.cjs
```

Durante uma implantação gradual, instâncias antigas ainda podem usar o fluxo sem trava. A atualização deve reiniciar todas as instâncias da API no mesmo período; a restrição única já impede duplicidades, mas somente o código novo garante a capacidade sob concorrência.
