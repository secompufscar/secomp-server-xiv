# Roadmap técnico da API XIV

Última revisão: 01/10/2026. Esta é a lista consolidada de prioridades e estados. Guias de comportamento e operação estão no [índice](README.md); achados/resultados anteriores no [histórico](historico/README.md).

## Estado verificado

PRs #10, #11, #13, #14–20 e [#22](https://github.com/secompufscar/secomp-server-xiv/pull/22) incorporados ao `main` observado em `ac045eb`. Troca de e-mail verificada e revogação administrativa estão integradas; exigem a migração aditiva correspondente antes da publicação. Sete branches remotas antigas foram removidas com referências de recuperação preservadas: [registro](historico/auditorias/branch-retirement-2026-09-30.md).

Deploy, migrações de produção e rotas online permanecem **não confirmados**. Merge, CI, migração e deploy são evidências distintas. Nenhuma etapa autoriza reset coletivo, logout geral, recálculo de pontos ou exigência de APK para mudanças que ficam só na API.

## Critérios e estados

- **P0:** privilégio, exposição e integridade essenciais.
- **P1:** segurança/confiabilidade e operações que podem perder dados.
- **P2:** eficiência e evolução operacional a medir.
- **Mergeado:** código integrado ao main; não comprova produção.
- **Implementado em PR:** código e testes disponíveis para revisão, fora da base indicada.
- **Parcial/pendente:** falta indicada na linha. Resultados de teste referem-se às rodadas/commits registrados, não a todas as versões futuras.

## P0

| ID | Correção | Estado | Evidência |
| --- | --- | --- | --- |
| P0-01 | Cadastro público limitado a USER | Mergeado; produção não confirmada | [Testes de cadastro](../tests/signup.test.cjs), [PR #10](https://github.com/secompufscar/secomp-server-xiv/pull/10) |
| P0-02 | Respostas sem hashes, tokens push e dados indevidos | Mergeado; produção não confirmada | [Contratos](contratos/respostas.md), [testes](../tests/user-data-exposure.test.cjs) |
| P0-03 | Autorização de inscrições e check-in | Mergeado; produção não confirmada | [Autorização](historico/correcoes/enrollment-authorization.md), [testes](../tests/enrollment-authorization.test.cjs) |
| P0-04 | Hash da senha administrativa | Hash e revogação transacional mergeados; produção não confirmada | [Senha administrativa](historico/correcoes/admin-password-update.md), [contas](funcionalidades/contas.md) |
| P0-05 | Capacidade concorrente e unicidade de inscrição | Mergeado; conferir migrações/produção | [Inscrições](funcionalidades/inscricoes.md), [capacidade](historico/correcoes/activity-capacity.md) |
| P0-06 | Regra por categoria e vínculo atividade/edição | Mergeado; produção não confirmada | [Categorias](historico/correcoes/checkin-category-rule.md), [vínculo de edição](historico/correcoes/activity-event-link.md) |
| P0-07 | Sessões, versão e dependências | Código integrado; validação operacional/distribuição do app são etapas separadas | [Compatibilidade](contratos/compatibilidade.md), [publicação](operacao/publicacao.md) |

## P1

| ID | Tema | Estado e pendência | Evidência |
| --- | --- | --- | --- |
| P1-01 | Contratos de escrita após sanitização | Correção mergeada; preservar campos válidos e rejeitar inválidos antes da escrita | [Escritas administrativas](historico/correcoes/admin-write-integrity.md) |
| P1-02 | Exclusão de categorias | Correção mergeada: 200 vazia, 404 ausente, 409 ocupada, FK protege concorrência | [Escritas administrativas](historico/correcoes/admin-write-integrity.md) |
| P1-03 | Escritas parciais | Parcial: eventos, inscrições, presença/pontos, filas e cadastro/QR corrigidos; restam patrocinadores/tags e imagens. E-mail sem fila persistente | [Inscrições](funcionalidades/inscricoes.md), [presença](funcionalidades/presenca.md), [cadastro](historico/correcoes/signup-recovery.md), [auditoria](historico/auditorias/functional-block-review-2026-09-29.md) |
| P1-04 | Edição atual e projeção da inscrição | Correção mergeada; conferir duplicatas antes da migração, sem reconciliação histórica automática | [Inscrições](funcionalidades/inscricoes.md), [detalhes](historico/correcoes/edition-registration-consistency.md) |
| P1-05 | Agendador | Parcial: horários absolutos, disparo único por processo, cancelamento e isolamento corrigidos. Restam persistência, entrega e coordenação entre instâncias | [Implementação](historico/correcoes/event-critical-fixes.md), [testes](../tests/scheduler-safety.test.cjs) |
| P1-06 | Autenticação e credenciais | Parcial: recuperação voluntária, troca de e-mail e revogação administrativa mergeadas. Restam outros logs/consultas e publicação do protocolo completo | [Contas](funcionalidades/contas.md), [PR #22](https://github.com/secompufscar/secomp-server-xiv/pull/22) |
| P1-07 | Imagens e Cloudinary | Parcial: limites/MIME presentes; faltam assinatura binária e substituição/remoção sem perda ou órfãos | [Auditoria D1](historico/auditorias/functional-block-review-2026-09-29.md), [etapa inicial](historico/correcoes/api-hardening-p1.md) |
| P1-08 | Controles HTTP e dependências | Parcial: cotas separadas mergeadas, 100 contas no mesmo IP testadas. Validar proxy/tráfego, armazenamento por instância e alerta do Bull | [Compatibilidade](contratos/compatibilidade.md), [cotas](historico/correcoes/shared-network-rate-limits.md) |

## P2

| ID | Tema | Pendência | Evidência |
| --- | --- | --- | --- |
| P2-01 | Consultas, paginação e índices | Medições sintéticas disponíveis; otimizações e paginação compatível pendentes | [Auditoria AUD-14](historico/auditorias/security-performance-review-2026-09-28.md), [resultados MySQL](historico/auditorias/evidencias/audit-mysql-results-2026-09-28.json) |
| P2-02 | Observabilidade | Request ID/health checks presentes; métricas, timeouts, alertas e demais logs pendentes | [Diagnóstico](operacao/diagnostico.md), [auditoria F4](historico/auditorias/functional-block-review-2026-09-29.md) |
| P2-03 | Pipeline e carga | CI/TypeScript/build e integrações isoladas presentes; carga representativa pendente | [Testes e CI](operacao/testes.md), [workflow](../.github/workflows/ci.yml) |

## Continuidade recomendada

Validar publicação/compatibilidade do que já foi integrado, incluindo login web/iOS e as migrações do #22, e tratar imagens sem perda. Depois, atomicidade/whitelist de patrocinadores e tags, persistência/coordenação de entregas e melhorias medidas de consultas/observabilidade. Consultar [publicação](operacao/publicacao.md) antes de qualquer mudança online.

As tabelas do índice anterior eram uma ordem histórica de achados, não prioridades P0/P1. Elas foram preservadas no [acompanhamento arquivado](historico/correcoes/acompanhamento-2026-09-30.md), sem manter uma segunda fonte de estados atuais.
