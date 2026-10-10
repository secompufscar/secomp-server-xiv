# Roadmap técnico da API XIV

Última revisão: 07/10/2026. Esta é a lista consolidada de prioridades e estados. Guias de comportamento e operação estão no [índice](README.md); achados/resultados anteriores no [histórico](historico/README.md).

## Estado verificado

Certificados individuais da XIV SECOMP implementados em branch separada em 09/10/2026, com migrações aditivas, código único, snapshot persistente e validação pública. Regras finais de durações e exclusões confirmadas em 10/10/2026, com plano versionado e aplicação transacional. Verificação local: 133 testes ativos da API e 13 integrações MySQL isoladas aprovados, incluindo emissão concorrente/idempotente e aplicação do plano sem sobrescrever correções manuais. Emissão de produção não liberada: faltam revisão/merge dos PRs, publicação ordenada API/app e aplicação/conferência operacional do plano. [Regras e operação](funcionalidades/certificados.md).

A API do [PR #33](https://github.com/secompufscar/secomp-server-xiv/pull/33), commit `dea590e2`, foi mergeada e depois publicada na Railway. A migração do instante de presença teve conclusão/checksum conferidos; consultas online validaram autorização ADMIN, todas as contas, busca, filtros e paginação. O app do [PR #21](https://github.com/secompufscar/secomp-app-xiv/pull/21), commit `96f1b712`, foi publicado automaticamente na Vercel após essa validação. Testes visuais no domínio publicado usaram API fictícia, sem registrar presenças ou excluir participantes reais. [Evidência de 06/10 e revisão de branches](historico/auditorias/participant-directory-release-2026-10-06.md).

A garantia de horário no próprio banco está implementada por `20261007010000_require_attendance_timestamp`, com testes isolados de novas presenças e preservação do legado. Sua aplicação online deve ser conferida separadamente; [comportamento e requisitos](funcionalidades/presenca.md#horário-obrigatório-em-novas-presenças).

### Rodadas anteriores

PRs #10, #11, #13, #14–20, [#22](https://github.com/secompufscar/secomp-server-xiv/pull/22), [#23](https://github.com/secompufscar/secomp-server-xiv/pull/23) e [#25](https://github.com/secompufscar/secomp-server-xiv/pull/25) incorporados ao código publicado `e2080ac`. Troca de e-mail e revogação administrativa estão integradas, com a migração aditiva aplicada. Encerramento anterior de branches e revisão da organização registrados em [30/09](historico/auditorias/branch-retirement-2026-09-30.md) e [01/10](historico/auditorias/work-review-2026-10-01.md).

**Deploy e 12 migrações confirmados em produção em 03/10**, com CI aprovada no commit publicado, health checks/CORS e login web/iOS com conta existente verificados. A correção geral de rotas web do [PR #9 do app](https://github.com/secompufscar/secomp-app-xiv/pull/9) também está publicada: `/SetNewPassword` e `/App/Home` retornam 200 e o documento do app. A conclusão da recuperação de senha continua pendente. Os demais fluxos online continuam pendentes conforme a [evidência da publicação](historico/auditorias/production-deployment-2026-10-03.md). Código publicado não equivale a validação funcional de todas as rotas. Nenhuma etapa autoriza reset coletivo, logout geral, recálculo de pontos ou exigência de APK para mudanças que ficam só na API.

A atualização de atividades do [PR #27](https://github.com/secompufscar/secomp-server-xiv/pull/27) foi integrada e publicada depois, no commit `e4ccb68`, com a migração de apresentação aplicada. O ensaio passou de 12 para 13 migrações e preservou os dados originais. O editor do [PR #10 do app](https://github.com/secompufscar/secomp-app-xiv/pull/10) também está publicado na Vercel, com fila reversível e mínimo de vagas por presenças. Escritas reais desse editor em produção ainda não foram exercitadas. [Evidência da atualização](historico/auditorias/production-deployment-2026-10-03.md#atualização-de-atividades-e-editor-administrativo).

Depois dessa rodada, o [PR #28](https://github.com/secompufscar/secomp-server-xiv/pull/28) ampliou descrições para 1.500 caracteres. A API `633e8c8` foi publicada após o merge, e a migração e o código de validação foram conferidos pela conexão privada. O ensaio preservou dados e passou de 13 para 14 migrações. O [PR #11 do app](https://github.com/secompufscar/secomp-app-xiv/pull/11), integrado e publicado na Vercel, reúne formulário responsivo e recorte de foto. [Registros da rodada](historico/auditorias/production-deployment-2026-10-03.md#descrição-de-1500-caracteres-e-recorte-de-foto).

A recuperação limitada de leituras após desconexão e o diagnóstico seguro do PR #31 foram publicados em `3fa481f`, sem nova migração. [Investigação e limites](historico/auditorias/login-database-connection-2026-10-03.md). Essas evidências anteriores não substituem uma validação dos mesmos fluxos em deployments posteriores.

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
| P0-01 | Cadastro público limitado a USER | Código publicado; fluxo funcional online não exercitado | [Testes de cadastro](../tests/signup.test.cjs), [PR #10](https://github.com/secompufscar/secomp-server-xiv/pull/10) |
| P0-02 | Respostas sem hashes, tokens push e dados indevidos | Código publicado; fluxo funcional online não exercitado | [Contratos](contratos/respostas.md), [testes](../tests/user-data-exposure.test.cjs) |
| P0-03 | Autorização de inscrições e check-in | Código publicado; fluxo funcional online não exercitado | [Autorização](historico/correcoes/enrollment-authorization.md), [testes](../tests/enrollment-authorization.test.cjs) |
| P0-04 | Hash da senha administrativa | Código publicado; alteração administrativa online não exercitada | [Senha administrativa](historico/correcoes/admin-password-update.md), [contas](funcionalidades/contas.md) |
| P0-05 | Capacidade concorrente e unicidade de inscrição | Restrição aplicada; zero duplicatas na conferência. Concorrência validada em teste isolado | [Inscrições](funcionalidades/inscricoes.md), [capacidade](historico/correcoes/activity-capacity.md) |
| P0-06 | Regra por categoria e vínculo atividade/edição | Código publicado; fluxo funcional online não exercitado | [Categorias](historico/correcoes/checkin-category-rule.md), [vínculo de edição](historico/correcoes/activity-event-link.md) |
| P0-07 | Sessões, versão e dependências | Código publicado; login web/iOS confirmado. Renovação/logout online pendentes; exigência de versão desativada | [Compatibilidade](contratos/compatibilidade.md), [publicação](operacao/publicacao.md) |

## P1

| ID | Tema | Estado e pendência | Evidência |
| --- | --- | --- | --- |
| P1-01 | Contratos de escrita após sanitização | Correção mergeada; preservar campos válidos e rejeitar inválidos antes da escrita | [Escritas administrativas](historico/correcoes/admin-write-integrity.md) |
| P1-02 | Exclusão de categorias | Correção mergeada: 200 vazia, 404 ausente, 409 ocupada, FK protege concorrência | [Escritas administrativas](historico/correcoes/admin-write-integrity.md) |
| P1-03 | Escritas parciais | Parcial: eventos, inscrições, presença/pontos, filas e cadastro/QR corrigidos; restam patrocinadores/tags e imagens. E-mail sem fila persistente | [Inscrições](funcionalidades/inscricoes.md), [presença](funcionalidades/presenca.md), [cadastro](historico/correcoes/signup-recovery.md), [auditoria](historico/auditorias/functional-block-review-2026-09-29.md) |
| P1-04 | Edição atual e projeção da inscrição | Migração aplicada; uma edição atual e zero atividades sem edição na conferência. Escritas online não exercitadas | [Inscrições](funcionalidades/inscricoes.md), [detalhes](historico/correcoes/edition-registration-consistency.md) |
| P1-05 | Agendador | Parcial: horários absolutos, disparo único por processo, cancelamento e isolamento corrigidos. Restam persistência, entrega e coordenação entre instâncias | [Implementação](historico/correcoes/event-critical-fixes.md), [testes](../tests/scheduler-safety.test.cjs) |
| P1-06 | Autenticação e credenciais | Parcial: recuperação voluntária, troca de e-mail e revogação administrativa mergeadas. Restam outros logs/consultas e validação online dos demais fluxos; protocolo publicado com chaves legadas preservadas. Link web acessível; troca efetiva de senha online não confirmada | [Contas](funcionalidades/contas.md), [PR #22](https://github.com/secompufscar/secomp-server-xiv/pull/22) |
| P1-07 | Imagens e Cloudinary | Parcial: limites/MIME presentes; substituição da foto de atividade preserva a anterior até a nova persistência. Faltam assinatura binária, limpeza persistente de órfãos e revisão dos demais tipos de imagem | [Atividades](funcionalidades/apresentacao-atividade.md), [auditoria D1](historico/auditorias/functional-block-review-2026-09-29.md), [etapa inicial](historico/correcoes/api-hardening-p1.md) |
| P1-08 | Controles HTTP e dependências | Parcial: cotas separadas mergeadas, 100 contas no mesmo IP testadas. Validar proxy/tráfego, armazenamento por instância e alerta do Bull | [Compatibilidade](contratos/compatibilidade.md), [cotas](historico/correcoes/shared-network-rate-limits.md) |

## P2

| ID | Tema | Pendência | Evidência |
| --- | --- | --- | --- |
| P2-01 | Consultas, paginação e índices | Parcial: lista geral administrativa paginada e validada online. Medições sintéticas disponíveis; otimizações e paginação das demais listas pendentes | [Lista geral](contratos/participantes.md), [auditoria AUD-14](historico/auditorias/security-performance-review-2026-09-28.md), [resultados MySQL](historico/auditorias/evidencias/audit-mysql-results-2026-09-28.json) |
| P2-02 | Observabilidade | Request ID/health checks presentes; métricas, timeouts, alertas e demais logs pendentes | [Diagnóstico](operacao/diagnostico.md), [auditoria F4](historico/auditorias/functional-block-review-2026-09-29.md) |
| P2-03 | Pipeline e carga | CI/TypeScript/build e integrações isoladas presentes; carga representativa pendente | [Testes e CI](operacao/testes.md), [workflow](../.github/workflows/ci.yml) |

## Continuidade recomendada

A investigação de login de 03/10 confirmou falhas intermitentes `P1017` na autenticação. A [proteção de conexão e o diagnóstico](operacao/diagnostico.md) recuperam leituras selecionadas e classificam indisponibilidade persistente; a [evidência do incidente](historico/auditorias/login-database-connection-2026-10-03.md) conserva os limites da conclusão. A origem do encerramento dos sockets e a estabilidade dos demais fluxos continuam a exigir observação em produção.

Completar a validação funcional do código já publicado: renovação/logout web, links de conta e fluxos do evento com contas controladas, sem exigir novo APK ou reset. Acompanhar logs e cotas do eduroam; os avisos de rede da [rodada de publicação](historico/auditorias/production-deployment-2026-10-03.md) ainda não têm causa confirmada. Depois, tratar assinatura binária/limpeza persistente de órfãos e demais imagens, atomicidade/whitelist de patrocinadores e tags, persistência/coordenação de entregas e melhorias medidas de consultas/observabilidade. A substituição da foto de atividade já preserva a anterior até a nova persistência. Consultar [publicação](operacao/publicacao.md) antes de qualquer mudança online.

A [revisão de branches e documentação de 03/10](historico/auditorias/branch-retirement-2026-10-03.md) registra o encerramento das branches incorporadas e a preservação dos demais trabalhos.

A [revisão de 07/10](historico/auditorias/participant-directory-release-2026-10-06.md#revisão-e-limpeza-de-0710) atualiza esse inventário: nenhum PR aberto antes da revisão documental, somente `main` na API e três branches com trabalho não integrado preservadas no app.

As tabelas do índice anterior eram uma ordem histórica de achados, não prioridades P0/P1. Elas foram preservadas no [acompanhamento arquivado](historico/correcoes/acompanhamento-2026-09-30.md), sem manter uma segunda fonte de estados atuais.
