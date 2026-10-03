# Presença e pontos

Última revisão: 03/10/2026. Implementação preservada na API publicada `633e8c8`, com deploy e migrações confirmados. Check-in/reversão e listagem nominal online ainda não foram exercitados; testes isolados e seus limites estão na [evidência de produção](../historico/auditorias/production-deployment-2026-10-03.md). [Roadmap](../roadmap.md).

## Check-in e reversão

Check-in e administração de presença exigem ADMIN autenticado. Elegibilidade é conferida dentro da transação: inscrição anual/edição, regra da categoria e estado da atividade. Usuário em espera não pode estar presente, inclusive em palestra aberta. Repetir check-in não credita novamente.

Novas presenças registram internamente o valor concedido em `creditedPoints`. Reversão usa esse valor mesmo se os pontos da atividade mudarem depois. Presença, pontos, exclusão e promoção relacionada são coordenados em transação; saldo insuficiente retorna conflito e faz rollback. O campo interno não entra nas respostas.

## Nomes e total de presentes

Rota aditiva para ADMIN: `GET /api/v1/checkIn/presentes/:activityId`.

```json
{"totalPresentes":1,"presentes":[{"userId":"id","nome":"Participante"}]}
```

Conta somente presença confirmada. Atividade vazia retorna zero e lista vazia; inexistente retorna 404. A listagem anterior de participantes mantém seu contrato de array.

## Evidência e limites

Evidência: [integração de presença](../../tests/attendance-integrity.integration.test.cjs), [relato de implementação](../historico/correcoes/event-critical-fixes.md), [contratos](../contratos/respostas.md).

Crédito legado nulo indica valor original desconhecido. Reversão individual mantém a avaliação anterior pelos pontos atuais, protegendo contra saldo negativo; cancelamento anual preserva créditos desconhecidos. Não houve recálculo em massa. Exclusão administrativa de atividade não recalcula pontos históricos. Deploy exige a migração e o protocolo de todas as instâncias.
