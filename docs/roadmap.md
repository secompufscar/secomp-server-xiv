# Roadmap técnico da API XIV

Este documento consolida prioridades e evidências do trabalho no `secomp-server-xiv`. A numeração da tabela histórica em `docs/README.md` era uma ordem de itens, não uma classificação P0/P1. A classificação abaixo permite acompanhar o trabalho sem confundir código implementado com publicação em produção.

## Critérios e estados

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
| P0-01 | Cadastro público limitado a USER | Implementado na branch P0 | `tests/signup.test.cjs`; PR #10 |
| P0-02 | Projeções de respostas sem hashes, tokens push e dados privados indevidos | Implementado na branch P0 | [Contratos](user-response-contracts.md) |
| P0-03 | Autorização de inscrições e check-in | Implementado na branch P0 | [Autorização](enrollment-authorization.md) |
| P0-04 | Hash da senha editada por administrador | Implementado na branch P0 | [Senha administrativa](admin-password-update.md) |
| P0-05 | Capacidade concorrente e unicidade da inscrição | Implementado; integração MySQL exige execução isolada | [Capacidade](activity-capacity.md) |
| P0-06 | Regra de inscrição por categoria e vínculo atividade/edição | Implementado na branch P0 | [Categorias](checkin-category-rule.md), [edições](activity-event-link.md) |
| P0-07 | Sessões renováveis, política de versão e atualização de dependências | Implementado; publicação coordenada pendente de validação operacional | [Compatibilidade](app-p0-compatibility.md), [runbook](p0-deployment-runbook.md) |

## P1, na ordem recomendada de continuidade

| ID | Tema | Estado e critério de aceite | Evidência |
| --- | --- | --- | --- |
| P1-01 | Contratos de escrita após sanitização | Corrigido nesta rodada; campos válidos devem chegar ao repositório e entradas inválidas devem falhar antes da escrita | [Escritas administrativas](admin-write-integrity.md) |
| P1-02 | Exclusão de categorias | Corrigido nesta rodada; vazia retorna 200, ausente 404, ocupada 409, FK protege concorrência | [Escritas administrativas](admin-write-integrity.md) |
| P1-03 | Escritas parciais por falta de transação | Parcial: exclusão de atividade, criação/exclusão de evento e criação de inscrição corrigidas. Rollback de evento e inscrição comprovado em MySQL isolado. Restam cancelamentos, desativação, estados de inscrição e pontos | [Integridade de evento e inscrição](event-write-integrity.md), `activitiesRepository.ts` |
| P1-04 | Unicidade da edição atual e estado duplicado de inscrição | Pendente: garantir unicidade sob concorrência e não alterar usuários de outras edições | `eventRepository.ts`, `eventService.ts`; item 8 do índice histórico |
| P1-05 | Agendador | Pendente: corrigir deslocamento fixo de três horas, recorrência anual, atividades sem data, cancelamento e falhas assíncronas; confirmar comportamento após reinício | `schedulerService.ts`; item 9 do índice histórico |
| P1-06 | Autenticação, reset e validação | Parcial: validação e limites implementados. Rever vazamento em logs, limite bcrypt em bytes, enumeração por tempo/falha de e-mail, revogação de sessões e consultas duplicadas de autorização | [Etapa inicial](api-hardening-p1.md); `errorHandler.ts`, `userSchema.ts`, `usersService.ts`, `adminMiddleware.ts` |
| P1-07 | Imagens e Cloudinary | Parcial: limites e filtro MIME implementados. Falta validar assinatura binária e garantir substituição/remoção sem perda ou arquivo órfão | [Etapa inicial](api-hardening-p1.md); item 11 do índice histórico |
| P1-08 | Controles HTTP e dependências | Parcial: request ID, headers, health checks e rate limit implementados. Validar proxy real, cotas para usuários em rede compartilhada e armazenamento por instância; reavaliar alerta transitivo do Bull | [Controles e risco conhecido](api-hardening-p1.md) |

## P2

| ID | Tema | Estado e critério de aceite |
| --- | --- | --- |
| P2-01 | Consultas, paginação e índices | Pendente: medir latência/volume e definir paginação compatível antes de alterar listas consumidas pelo app |
| P2-02 | Observabilidade | Parcial: request ID e health checks disponíveis. Falta definir métricas, timeouts e alertas sem dados sensíveis |
| P2-03 | Robustez do pipeline | Parcial: testes, TypeScript, build multiplataforma e CI de PRs disponíveis. Falta execução automática de integrações MySQL isoladas e testes de carga representativos |

## Auditoria e publicação

- [PR #10 — P0](https://github.com/secompufscar/secomp-server-xiv/pull/10).
- [PR #11 — P1](https://github.com/secompufscar/secomp-server-xiv/pull/11), criado sobre a branch do #10.
- Commits iniciais P1: `b7b02b3` (código/testes), `0fa23cd` (documentação), `6682398` (CI).
- Esta revisão de continuidade está documentada em [escritas administrativas](admin-write-integrity.md); seu histórico fica no Git da mesma branch P1.
- Consultar o GitHub para o estado atual de merge e CI. O estado de produção deve ser confirmado seguindo o runbook; presença nesta tabela não é comprovação de deploy.
