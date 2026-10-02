# Investigação de login web — Railway e Vercel

Registro histórico dos testes públicos e locais. O estado vigente está no [roadmap](../../roadmap.md).

Continuidade após a rodada descrita abaixo: o PR #7 do app foi mergeado no main `821019fd03b2952dcdd8ad38dbd4dc21784a658b`. O [deployment do merge](https://vercel.com/secomp-tis-projects/secomp-app-xiv/2DMd79fiLt9fwZkKha1r5XXBTeG9) foi concluído, mas o domínio público continuou carregando o mesmo bundle observado antes. A referência a PR aberto abaixo descreve a consulta anterior; estar aberto não impedia publicação da branch. O merge não comprovou correção do incidente. Nenhum acesso autenticado aos logs ou às migrações de produção foi confirmado nessa continuidade.

Levantamento de 30/09–01/10/2026. Nenhum deployment, configuração de produção, credencial ou banco foi alterado. Causa do incidente original ainda não confirmada.

## Contexto confirmado

- API restaurada que funciona, informada pelo responsável: `117bb79731f8c2a3acb338fee03e56f89bf969a4`.
- Publicação associada à falha: PR #20 da API, merge `8b221cc79113b651e89fbf45ed30021606ed2f24`.
- Imagem: requisição a `https://secomp-server-xiv-production.up.railway.app/api/v1/users/login`, HTTP 204 sem `Access-Control-Allow-Origin`, seguida de erro de rede/status nulo.
- URL usual informada: `https://secomp-app-xiv.vercel.app/App/Home`. O cabeçalho Origin e o identificador da resposta da tentativa original ainda não foram capturados.

## Achados públicos

### Vercel

- `/` responde 200 e a aplicação navega no cliente para `/Welcome`.
- Acesso direto a `/App/Home` responde 404 NOT_FOUND da Vercel. Confirmado no navegador e por HTTP independente. Esse problema é distinto do bloqueio CORS mostrado na imagem.
- O bundle público `index-0999c84ea6ce320366628196ce620947.js` contém o cliente HTTP/fluxo de sessão da branch `codex/fix-p0-release-blockers`, SHA `0c08323a383b7a1db50454adea0e88a01102aa24`, do PR aberto #7 do APP. O main do app inspecionado estava em `7b911cd1`. Isso identifica correspondência de código, não comprova sozinho qual deployment está associado ao alias no painel.
- O status GitHub da branch registra deployment Vercel concluído em 30/09/2026 às 21:22:21 (America/Sao_Paulo). Deployment: https://vercel.com/secomp-tis-projects/secomp-app-xiv/4wUQV2KbsXxUHfobKiu2hP5c1UzK . O painel requer login; a associação atual do domínio ainda não foi consultada.
- O app chama diretamente o domínio Railway. Não há proxy Vercel no fluxo de login inspecionado.
- Cabeçalhos do cliente publicado: `X-App-Platform: web`, `X-App-Version`, `X-App-Build`, Content-Type e eventualmente Authorization. Não configura withCredentials no cliente Axios inspecionado.
- Não há `vercel.json` no main ou no PR #7. O 404 em rota interna e a exportação SPA são compatíveis com falta do fallback para `/`. Confirmar também configuração efetiva do projeto antes de corrigir.

### Railway

- OPTIONS público de login para a origem oficial e para `https://secomp-app-xiv-git-main-secomp-tis-projects.vercel.app` responde 204 com ACAO correto.
- Controles com origem não listada e com Origin literal `null` respondem 204 sem ACAO. Esse comportamento reproduz o padrão da imagem, mas não prova qual Origin o navegador enviou no incidente.
- IDs das quatro respostas no edge gru1: oficial `dj7nl5JTRt609RACljLL4A`; branch main `FNqb_uDFSRq39vGu9fVATg`; origem de controle `DmO_DGLlQKODVY7jlt7tkg`; null `QUTiHAMGTlqrLMqa6WHkDg`.
- Os testes online ocorreram após o rollback e não validam o deployment que falhou.
- Não foi possível inspecionar Deploy Logs, HTTP Logs, build/start command, origem Git e migrações: painel Railway sem sessão autenticada; integração ainda não conectada.

## Código e reprodução local

- PR #20 já inclui `15ee7fc`, que soma CORS_ORIGINS às origens fixas. A regressão histórica de sobrescrever a lista não está nesse merge.
- PR #20 altera cadastro e seus testes, não CORS. Publicá-lo sobre 117bb79 inclui também mudanças anteriores acumuladas.
- Comparação local carrega `src/index.ts` e configurações reais dos dois commits, sem dotenv, banco, scheduler, e-mail ou rede externa. Rotas externas são substituídas por uma falha sintética. Usa dependências instaladas no checkout atual, não reconstrução completa das dependências históricas.
- Quatro cenários: cada commit com CORS_ORIGINS vazio ou parcial. Nos quatro, origens oficiais são aceitas, todos os cabeçalhos do app (inclusive x-app-build) são permitidos, origens de controle são negadas. POST com falha sintética responde 500 conservando ACAO para a origem oficial.
- 16 preflights e quatro POSTs locais verificados. Um quinto cenário confirma que segredo sintético inválido no PR #20 interrompe a inicialização antes de abrir a porta.
- Os três testes existentes de `tests/cors-web-app.test.cjs` também passaram. A configuração e esses testes não diferem entre o checkout testado e o merge do PR #20.
- Helper local ignorado pelo Git: `server-xiv/dist/probe-pr20-bootstrap-cors.cjs`. Não é teste de login real, Safari, migração de produção ou build efetivo do Railway.

## Dependência conjunta entre app e API

O cliente publicado envia x-app-version. No PR #20, `usersController.login` interpreta esse cabeçalho como suporte a refresh e `usersService.login` chama createSession, que grava em refreshSessions. No backend restaurado 117bb79 esse fluxo não existe: a resposta contém user e token.

Logo, é necessário confirmar a migração de refreshSessions e authVersion no banco usado pelo deployment novo. Uma migração ausente pode quebrar o POST de login; isoladamente não explica OPTIONS 204 sem ACAO. De modo semelhante, falha de validação dos segredos pode impedir startup, mas não produz sozinha um OPTIONS 204 da aplicação. Não há prova de que qualquer uma dessas condições aconteceu no ambiente real.

## Evidência necessária para concluir

1. Railway: deployment exato do PR #20, commit/build/start command, Deploy Logs da inicialização e HTTP Logs da tentativa. Correlacionar domínio, método, status, horário e request ID. Conferir migrações existentes por leitura; não executar migrações automaticamente durante o diagnóstico.
2. Vercel: commit/branch/build associado ao alias público, domínio usado ao ocorrer a falha e configuração efetiva de roteamento. A URL de preview pode ter origem diferente da URL de produção.
3. Navegador da falha: Request URL, Origin, Access-Control-Request-Headers, status e response headers de OPTIONS; verificar se o POST foi enviado. Não copiar senha, token ou corpo do login.

## Referências

- API PR #20: https://github.com/secompufscar/secomp-server-xiv/pull/20
- Cliente público do APP PR #7: https://github.com/secompufscar/secomp-app-xiv/pull/7
- Cliente HTTP: https://github.com/secompufscar/secomp-app-xiv/blob/0c08323a383b7a1db50454adea0e88a01102aa24/src/services/api.ts#L8
- Contrato de login: https://github.com/secompufscar/secomp-app-xiv/blob/0c08323a383b7a1db50454adea0e88a01102aa24/src/services/users.ts#L4
- Railway logs: https://docs.railway.com/observability/logs
- Vercel URLs e aliases: https://vercel.com/docs/deployments/generated-urls
- Expo SPA/Vercel: https://docs.expo.dev/guides/publishing-websites/#vercel

Hipóteses não devem ser tratadas como causa confirmada. Não se recomenda ampliar CORS para todas as origens ou rotacionar segredos com base apenas na mensagem do navegador.
