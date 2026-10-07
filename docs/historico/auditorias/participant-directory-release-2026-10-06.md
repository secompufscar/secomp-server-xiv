# Lista geral: publicação de 06/10 e revisão de 07/10/2026

## Publicação verificada

O [PR #33 da API](https://github.com/secompufscar/secomp-server-xiv/pull/33) foi mergeado em `dea590e2` antes da publicação pela CLI na Railway. O deployment `1b1c21ae-7cca-4773-b461-b01ea616b2c0` terminou com `SUCCESS`. A migração `20261006090000_attendance_timestamp` teve `finished_at` e checksum conferidos pela conexão privada.

Antes da migração, houve backup atualizado por SSH no MySQL e restauração/ensaio em banco local isolado. O ensaio preservou os campos originais e recuperou 251 horários confiáveis de presença. A migração fixa temporariamente o fuso da sessão SQL em UTC e o restaura ao terminar: `createdAt` é DATETIME, enquanto `updatedAt` legado é TIMESTAMP. SQLs, credenciais e dados pessoais permanecem privados.

Consultas à API publicada confirmaram `GET /api/v1/users/directory`: 401 sem autenticação, 403 com participante e 200 com ADMIN. Busca, filtros de status e paginação passaram; o total incluiu todas as contas. Os tokens de teste foram curtos e ficaram somente em memória, sem criação de sessões ou exposição nos relatórios. Não houve escrita funcional em produção nessa validação.

O [PR #21 do app](https://github.com/secompufscar/secomp-app-xiv/pull/21) foi mergeado em `96f1b712` após a validação da API. O status da Vercel e a CI do merge passaram. Sete cenários de navegador também passaram em `https://secomp-app-xiv.vercel.app`, em 320×640 e 1280×900, com contas/API fictícias: busca, filtros, paginação, selos/data, rolagem, histórico sem credenciamento, erro/nova tentativa, vazio, resposta atrasada e visão do participante. Essas verificações visuais não fizeram chamadas à API real.

Na rodada de implementação passaram 135 testes padrão da API (125 aprovados e dez integrações opt-in ignoradas), dez integrações MySQL isoladas, TypeScript e build; os dois jobs da CI do PR #33 passaram. No app, passaram 62 testes, TypeScript e exportação web. Contagens descrevem os commits funcionais daquela rodada, não auditoria contínua.

## Limites

Registros antigos sem instante confiável mantêm presença, com `credentialedAt: null`; o app mostra **Data do credenciamento não disponível**. A consulta da lista não comprova câmera, leitura de QR, nova presença, reversão, exclusão, recuperação de senha ou distribuição Android/iOS. Configurações externas que não foram consultadas não são consideradas confirmadas.

## Revisão e limpeza de 07/10

Na conferência posterior, os dois repositórios estavam sem PRs abertos. As branches dos PRs #33/#21 já haviam sido removidas após merge. `feat/listas-sorteio` também foi removida: o [PR #13 do app](https://github.com/secompufscar/secomp-app-xiv/pull/13) estava mergeado, e a ponta da branch era ancestral de `main`; a exclusão exigiu que essa ponta não tivesse mudado. Foram preservadas `feat/lightmode`, `fix-links` e `fix/fix-activityImage-creation`, com trabalho não integrado. Referências locais foram atualizadas com prune.

Os repositórios ativos tinham somente `main` local e nenhum worktree adicional registrado. Backups, evidências, arquivos não rastreados e demais diretórios pessoais não foram apagados. O MySQL local iniciado para o ensaio foi encerrado, preservando seu diretório. A revisão documental corrigiu estados de publicação, distinção entre horário da atividade e instante de presença, índices e escopo dos resultados históricos.
