# Revisão de branches e documentação — 03/10/2026

Após autorização do responsável, foram consultados todos os PRs e branches do app e da API. Não havia PR aberto na consulta. Bases: app `cdee8cde111aa064ffa9b1ac81eeb68d572fdc98` e API `3f4540aede7c00bba673eb59130024ac24e666b1`. O código funcional publicado da API permanece `633e8c8`; os merges posteriores até essa base alteram documentação.

## Branches remotas encerradas

Os oito PRs estavam mergeados e cada SHA era ancestral de `origin/main`. A exclusão foi atômica por repositório e condicionada ao SHA exato de cada referência, impedindo remover atualizações concorrentes. O Git confirmou as oito exclusões.

| Repositório | Branch | PR | SHA preservado |
| --- | --- | --- | --- |
| App | `codex/admin-activity-names-web` | [#8](https://github.com/secompufscar/secomp-app-xiv/pull/8) | `541b11e40a0a9f1adc12cd7c09b9232281c6d59c` |
| App | `codex/fix-web-password-reset-routing` | [#9](https://github.com/secompufscar/secomp-app-xiv/pull/9) | `95e6a2461b96dfc261e9ed0e34e96322be8c683f` |
| App | `codex/activity-speaker-profile` | [#10](https://github.com/secompufscar/secomp-app-xiv/pull/10) | `e072da0909f463afd2421f8904c359a6b034b487` |
| App | `codex/activity-form-responsive` | [#11](https://github.com/secompufscar/secomp-app-xiv/pull/11) | `149bccea482a457ffa040c3639082fe17bf0badf` |
| API | `codex/docs-production-deployment` | [#26](https://github.com/secompufscar/secomp-server-xiv/pull/26) | `e6630dce3f915a849c647b60c48d1de9e71b0d2c` |
| API | `codex/activity-speaker-title` | [#27](https://github.com/secompufscar/secomp-server-xiv/pull/27) | `4d55fb6716f9c47576a5f62f64c9ca087b9577d1` |
| API | `codex/activity-description-1500` | [#28](https://github.com/secompufscar/secomp-server-xiv/pull/28) | `3b8273e8f057ad458889ae1fe4f541b9f277cbf8` |
| API | `codex/docs-description-crop-publication` | [#29](https://github.com/secompufscar/secomp-server-xiv/pull/29) | `41baeaf9ed341db9a9b84102dc796f886ba91258` |

Antes da exclusão, referências locais `refs/archive/branch-retirement-20261003/<branch>` foram criadas nos respectivos repositórios. Os SHAs também continuam no histórico dos PRs e de main. Essas referências de recuperação são locais.

## Arquivos e trabalhos preservados

- Main foi preservada nos dois remotos. No app, `feat/lightmode`, `fix/fix-activityImage-creation` e `fix-links` foram mantidas, conforme o trabalho divergente registrado na [revisão de 01/10](work-review-2026-10-01.md).
- Oito branches locais incorporadas foram removidas com `git branch -d`: três do app e cinco da API, incluindo a branch auxiliar de integração da documentação. A branch local da correção de rotas foi mantida por estar em uso em outro checkout; seus arquivos não foram alterados.
- O checkout principal da API foi atualizado para main. As cinco alterações locais de documentação foram preservadas em stash identificado como `preserve local docs before merged branch cleanup 2026-10-03`; não foram descartadas nem reaplicadas sobre os guias mais novos.
- Checkouts auxiliares da API foram preservados. Não houve remoção de backups, arquivos ignorados, dados pessoais ou bancos locais.

## Revisão da documentação

Os contratos ainda informavam descrição de 1.000 caracteres e alguns guias atuais marcavam produção como não confirmada. Foram alinhados ao limite de 1.500 e às evidências da [publicação](production-deployment-2026-10-03.md), preservando os resultados históricos e as limitações de escritas online.

Também foram atualizados navegação dos guias do app, estado da correção de rotas na Vercel, rótulo de cancelamento do recorte, acesso do participante ao resumo da fila, exceções de versão para web/legado, códigos de autorização por middleware e instrução inicial para aplicar migrações versionadas. A revisão altera somente Markdown; não executa migração nem upload de API.
