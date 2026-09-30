# Correções prioritárias antes do evento — 30/09/2026

Implementadas na branch `codex/event-critical-fixes`, que integra o trabalho dos PRs #14, #15 e #16 e a revisão por blocos. Código na branch não confirma deploy, migrações nem comportamento online.

## Agendamento

Lembretes usam o instante absoluto da atividade menos 24h e 2h, sem deslocamento fixo de fuso nem recorrência anual. Datas ausentes são válidas e não criam tarefas. Alteração, remoção da data e exclusão cancelam tarefas antigas. Erros de leitura, timer e envio são tratados; falha de uma atividade não interrompe as demais nem rejeita a inicialização da API. Timers longos são rearmados dentro do limite do Node e não mantêm o processo aberto.

Ao reiniciar, tarefas futuras são reconstruídas; lembretes cujo prazo passou são ignorados. A solução ainda usa memória por processo: várias instâncias podem enviar cópias. Não há fila persistente, repetição automática de falhas, garantia de entrega ou recuperação dos lembretes perdidos durante indisponibilidade. Uma atualização não pode retirar um push já aceito pelo provedor.

## Presença, pontos e cancelamento

Check-in, alteração de presença, exclusão individual e cancelamento anual coordenam escritas em transações e bloqueios de usuário/atividade. Confirmação da edição é conferida na transação; atividades legadas sem vínculo usam a edição atual. Categoria que exige inscrição continua rejeitando ausência de inscrição. Lista de espera não permite presença, inclusive em palestra aberta. Check-in repetido retorna conflito sem crédito adicional.

O campo interno nullable `userAtActivity.creditedPoints` registra quanto cada nova presença concedeu. Reversão desconta esse valor, inclusive após alteração dos pontos da atividade; repetição não desconta novamente. Saldo insuficiente retorna 409 e reverte tudo. O campo é removido das respostas consumidas pelos clientes. Exclusões e promoções de fila ficam na mesma transação. Cancelamento anual usa ReadCommitted para contar a ocupação atual após os bloqueios, reverte créditos conhecidos, preserva outras edições e só limpa o perfil quando corresponde à edição cancelada. A fila anual usa seleção bloqueada, mas sincronização do perfil de promovidos e demais mudanças administrativas de status continuam pendentes. Promoções não apagam presença/crédito de registros legados inconsistentes.

**Legado:** a migração não recalcula saldos. `null` significa que o crédito original é desconhecido. Reversão individual mantém a avaliação antiga pelos pontos atuais da atividade, com proteção contra saldo negativo; cancelamento anual preserva créditos desconhecidos, como antes. Sem histórico não se pode prometer reconstrução exata desses valores. Exclusão administrativa da atividade continua sem recalcular pontos históricos.

## Consulta de presentes e compatibilidade web

Endpoint aditivo, restrito a ADMIN autenticado:

`GET /api/v1/checkIn/presentes/:activityId`

```json
{"totalPresentes":1,"presentes":[{"userId":"id","nome":"Participante"}]}
```

Conta somente `presente=true`; atividade vazia retorna total zero e lista vazia, atividade inexistente retorna 404. A listagem anterior de participantes permanece disponível com o contrato de array.

CORS precede os parsers: JSON inválido (400) e corpo excessivo (413) têm cabeçalhos para origens autorizadas. Origens arbitrárias continuam sem autorização CORS. Inclui a origem publicada `https://secomp-app-xiv.vercel.app`. Esses ajustes não comprovam a causa do incidente histórico no iOS.

## Validação e publicação

Validação final local aprovada: `npm run verify` (89 testes aprovados, cinco integrações opt-in omitidas), `npm run build`, `git diff --check` e as quatro integrações MySQL abaixo, executadas separadamente. A prova de fila inclui inscrição concorrente entre a leitura do registro anual e o bloqueio da atividade; ocupação não ultrapassa a capacidade. Banco/processo/diretório temporários removidos após sucesso.

- Testes do agendador com relógio controlado: data nula, fusos, disparo único, atualização/exclusão, callbacks antigos, timers longos e falhas assíncronas.
- Testes HTTP: contratos de check-in, autorização da consulta, preflight e erros 400/413 com CORS restrito.
- MySQL 8.4 isolado: quatro integrações (evento/inscrição, cancelamento anual, recuperação voluntária, presença/pontos). Falhas injetadas após escritas relacionadas preservam snapshots; concorrência não duplica crédito/débito; outra conta permanece intacta. Runner aplica dez migrações e remove o schema temporário.

Aplicar as migrações pendentes antes do código, inclusive `20260930010000_attendance_credit`, seguindo o runbook e conferindo a configuração de segredos já exigida pelo PR #15. Não houve migração em produção, deploy ou rotação de chaves. Não exige novo APK, reset coletivo nem ação dos usuários.

Próximas pendências antes do evento: cotas de cadastro/recuperação em IP compartilhado, estados duplicados da inscrição/edição atual e demais escritas parciais. Ver [revisão por blocos](functional-block-review-2026-09-29.md) e [roadmap](roadmap.md).
