# Roadmap técnico da API XIV

Este documento consolida prioridades e evidências do trabalho no `secomp-server-xiv`. A numeração da tabela histórica em `docs/README.md` era uma ordem de itens, não uma classificação P0/P1. A classificação abaixo permite acompanhar o trabalho sem confundir código implementado com publicação em produção.

Atualização de 28/09/2026: a [revisão abrangente](security-performance-review-2026-09-28.md) identificou 22 grupos de achados. Há problemas herdados e regressões recentes (log de tokens e bloqueio de links web por política de versão), com reproduções e métricas. As correções abaixo não encerram esses achados automaticamente.

## Critérios e estados

Atualização de 30/09/2026: [correções prioritárias](event-critical-fixes.md) implementam agendamento seguro, atomicidade de presença/pontos e reversões, consulta de nomes/total de presentes e CORS em erros de parser. P1-03 continua parcial (estados administrativos/desativação e sincronização de perfis da fila); P1-05 tem correções locais implementadas, mas persistência e coordenação entre instâncias seguem pendentes. Produção não confirmada.

- **P0:** falhas de privilégio, exposição de credenciais/dados e integridade essenciais antes da publicação.
- **P1:** confiabilidade, proteção contra abuso, regressões e operações que podem perder dados.
- **P2:** eficiência, observabilidade e evolução operacional a validar com medições.
- **Implementado na branch:** código e testes presentes; não confirma merge, migrações nem deploy.
- **Parcial:** apenas parte do problema foi resolvida; o restante é indicado.
- **Pendente:** requer implementação ou investigação adicional.

Não há P3+ definido nesta etapa. Novos itens devem incluir evidência, impacto, critério de aceite e referência ao commit/PR.

## P0

| ID | Correção | Estado | Evidência |
| --- | --- | --- | --- |
| P0-01 | Cadastro público limitado a USER | Mergeado no main (PR #10); produção não confirmada | `tests/signup.test.cjs`; PR #10 |
| P0-02 | Projeções de respostas sem hashes, tokens push e dados privados indevidos | Mergeado no main (PR #10); produção não confirmada | [Contratos](user-response-contracts.md) |
| P0-03 | Autorização de inscrições e check-in | Mergeado no main (PR #10); produção não confirmada | [Autorização](enrollment-authorization.md) |
| P0-04 | Hash da senha editada por administrador | Mergeado no main (PR #10); produção não confirmada | [Senha administrativa](admin-password-update.md) |
| P0-05 | Capacidade concorrente e unicidade da inscrição | Implementado; integração MySQL exige execução isolada | [Capacidade](activity-capacity.md) |
| P0-06 | Regra de inscrição por categoria e vínculo atividade/edição | Mergeado no main (PR #10); produção não confirmada | [Categorias](checkin-category-rule.md), [edições](activity-event-link.md) |
| P0-07 | Sessões renováveis, política de versão e atualização de dependências | Implementado; publicação coordenada pendente de validação operacional | [Compatibilidade](app-p0-compatibility.md), [runbook](p0-deployment-runbook.md) |

## P1, na ordem recomendada de continuidade

| ID | Tema | Estado e critério de aceite | Evidência |
| --- | --- | --- | --- |
| P1-01 | Contratos de escrita após sanitização | Corrigido nesta rodada; campos válidos devem chegar ao repositório e entradas inválidas devem falhar antes da escrita | [Escritas administrativas](admin-write-integrity.md) |
| P1-02 | Exclusão de categorias | Corrigido nesta rodada; vazia retorna 200, ausente 404, ocupada 409, FK protege concorrência | [Escritas administrativas](admin-write-integrity.md) |
| P1-03 | Escritas parciais por falta de transação | Parcial: exclusão de atividade, criação/exclusão de evento e criação de inscrição corrigidas. Rollback de evento e inscrição comprovado em MySQL isolado. Cancelamento de inscrição transacionado nesta rodada e validado em MySQL isolado; restam desativação, estados de inscrição, concorrência da fila e pontos | [Integridade de evento e inscrição](event-write-integrity.md), [cancelamento](registration-cancellation.md), `activitiesRepository.ts` |
| P1-04 | Unicidade da edição atual e estado duplicado de inscrição | Pendente: garantir unicidade sob concorrência e não alterar usuários de outras edições | `eventRepository.ts`, `eventService.ts`; item 8 do índice histórico |
| P1-05 | Agendador | Parcial: horários absolutos, disparo único por processo, data nula, cancelamento e falhas assíncronas corrigidos na branch; reinício reconstrói prazos futuros. Restam persistência, entrega e coordenação entre instâncias | [Correções prioritárias](event-critical-fixes.md), `tests/scheduler-safety.test.cjs` |
| P1-06 | Autenticação, reset e validação | Parcial: proteções urgentes e recuperação voluntária de uso único com revogação atômica implementadas em branches de 29/09. Tokens legados preservados até a recuperação da própria conta; rollback/concorrência testados em MySQL isolado. Restam senha administrativa, troca de e-mail verificada, demais logs e consultas redundantes. Conferir configuração e aplicar migração aditiva antes do deploy; produção não confirmada | [Recuperação voluntária](password-recovery-safety.md), [proteções urgentes](urgent-auth-web-safety.md), [etapa inicial](api-hardening-p1.md) |
| P1-07 | Imagens e Cloudinary | Parcial: limites e filtro MIME implementados. Falta validar assinatura binária e garantir substituição/remoção sem perda ou arquivo órfão | [Etapa inicial](api-hardening-p1.md); item 11 do índice histórico |
| P1-08 | Controles HTTP e dependências | Parcial: request ID, headers, health checks e rate limit implementados. Validar proxy real, cotas para usuários em rede compartilhada e armazenamento por instância; reavaliar alerta transitivo do Bull | [Controles e risco conhecido](api-hardening-p1.md) |

## P2

| ID | Tema | Estado e critério de aceite |
| --- | --- | --- |
| P2-01 | Consultas, paginação e índices | Medição sintética realizada: 1.000/5.000 usuários, seis consultas; resultados e limitações na revisão AUD-14. Implementação pendente; definir paginação compatível antes de alterar listas consumidas pelo app |
| P2-02 | Observabilidade | Parcial: request ID e health checks disponíveis. Falta definir métricas, timeouts e alertas sem dados sensíveis |
| P2-03 | Robustez do pipeline | Parcial: testes, TypeScript, build multiplataforma e CI de PRs disponíveis. Integração MySQL isolada de atomicidade adicionada à CI nesta rodada; faltam testes de carga representativos |

## Auditoria e publicação

- [PR #10 — P0](https://github.com/secompufscar/secomp-server-xiv/pull/10).
- [PR #11 — P1](https://github.com/secompufscar/secomp-server-xiv/pull/11), criado sobre a branch do #10.
- Commits iniciais P1: `b7b02b3` (código/testes), `0fa23cd` (documentação), `6682398` (CI).
- Esta revisão de continuidade está documentada em [escritas administrativas](admin-write-integrity.md); seu histórico fica no Git da mesma branch P1.
- Consultar o GitHub para o estado atual de merge e CI. O estado de produção deve ser confirmado seguindo o runbook; presença nesta tabela não é comprovação de deploy.
