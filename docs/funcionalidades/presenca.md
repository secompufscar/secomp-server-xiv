# Presença e pontos

Última revisão: 07/10/2026. A API publicada `dea590e2` acrescenta o instante de presença e a lista geral administrativa. Migração e leitura da nova lista foram confirmadas; check-in/reversão reais não fizeram parte dessa rodada. [Evidência de 06/10](../historico/auditorias/participant-directory-release-2026-10-06.md), [rodada anterior](../historico/auditorias/production-deployment-2026-10-03.md) e [roadmap](../roadmap.md).

## Check-in e reversão

Check-in e administração de presença exigem ADMIN autenticado. Elegibilidade é conferida dentro da transação: inscrição anual/edição, regra da categoria e estado da atividade. Usuário em espera não pode estar presente, inclusive em palestra aberta. Repetir check-in não credita novamente.

Novas presenças registram internamente o valor concedido em `creditedPoints`. Reversão usa esse valor mesmo se os pontos da atividade mudarem depois. Presença, pontos, exclusão e promoção relacionada são coordenados em transação; saldo insuficiente retorna conflito e faz rollback. O campo interno não entra nas respostas.

`checkedInAt` registra o instante real ao passar de ausência para presença, junto dos pontos na mesma transação. Repetir presença preserva o instante; desmarcar limpa o campo. Registros legados podem não ter data confiável. A [lista geral](../contratos/participantes.md) expõe esse instante como `credentialedAt` somente para o credenciamento da edição atual; ele é diferente do horário programado da atividade.

## Nomes e total de presentes

Rota aditiva para ADMIN: `GET /api/v1/checkIn/presentes/:activityId`.

```json
{"totalPresentes":1,"presentes":[{"userId":"id","nome":"Participante"}]}
```

Conta somente presença confirmada. Atividade vazia retorna zero e lista vazia; inexistente retorna 404. A listagem anterior de participantes mantém seu contrato de array.

## Evidência e limites

Evidência: [integração de presença](../../tests/attendance-integrity.integration.test.cjs), [relato de implementação](../historico/correcoes/event-critical-fixes.md), [contratos](../contratos/respostas.md).

Crédito legado nulo indica valor original desconhecido. Reversão individual mantém a avaliação anterior pelos pontos atuais, protegendo contra saldo negativo; cancelamento anual preserva créditos desconhecidos. Não houve recálculo em massa. Exclusão administrativa de atividade não recalcula pontos históricos. Deploy exige a migração e o protocolo de todas as instâncias.
