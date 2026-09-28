# Auditoria das branches XIV — 28/09/2026

Base: `origin/main` em `d764a6a9428dd12a6e73f680804cc05259a4c2ff`, após `git pull --ff-only`. A API do GitHub confirmou que os PRs #10, #11 e #13 foram mergeados, e não havia PR aberto antes desta rodada. O inventário anterior à limpeza está em [branch-inventory-2026-09-28.json](branch-inventory-2026-09-28.json), com SHA completo para recuperação e indicador de ancestralidade.

## Critério de encerramento

O [GitHub recomenda excluir branches que não são mais necessárias, como trabalho já mergeado ou encerrado](https://docs.github.com/en/pull-requests/how-tos/commit-changes/managing-branches-within-your-repository). A documentação orienta resolver PRs abertos antes da exclusão. Isso não significa que o GitHub recomenda integrar toda implementação antiga: a avaliação de compatibilidade abaixo é uma decisão técnica desta auditoria.

Das 26 branches além de `main`, 25 têm seus commits integralmente contidos em `main`, comprovado por `git merge-base --is-ancestor`. Não há implementação exclusiva a concluir nessas branches; recomenda-se encerrar suas referências remotas. Nenhuma estava protegida ou referenciada por PR aberto na consulta. A exclusão deve usar os SHAs inventariados como condição para evitar remover uma branch que tenha avançado durante a auditoria.

## Experimento BLOB

`feature/add-blob-image-logic` tem dois commits exclusivos: `6d9ca23` e `1701019`. A análise do diff mostra substituição de `activityImage.imageUrl` por `image`/`mimeType`, respostas sem a URL e uma migração com `DROP COLUMN imageUrl`. Isso rompe o contrato atual e elimina referências de imagens, sem migração de conteúdo. O `main` mantém upload Cloudinary e URLs, e já inclui as rotas de imagens, patrocinadores e tags introduzidas também pelo experimento.

Recomendação: encerrar o experimento sem merge, preservando o commit completo `1701019131325934848a5835ef79183740bc0d68` na tag `archive/feature-add-blob-image-logic-2026-09-28` antes de remover a branch. Não aplicar suas migrações. As melhorias compatíveis de upload/substituição continuam no P1-07.

## Limites

Estar contido em `main` comprova integração de commits, não ausência de bugs, deploy ou execução de migrações. As pendências funcionais e de segurança permanecem no [roadmap](roadmap.md). A nova branch de cancelamento deve permanecer enquanto seu PR estiver aberto. O checkout XIII pai e seus diretórios não rastreados não fazem parte desta limpeza.
