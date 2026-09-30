# Compatibilidade CORS do app web XIV

O endereço informado para o iOS é `https://secomp-app-xiv.vercel.app/App/Home`. Sua origem CORS é **`https://secomp-app-xiv.vercel.app`**. O caminho não faz parte da origem.

## Correção

A origem já constava da lista histórica, antes e depois do hardening. Porém, a implementação de `CORS_ORIGINS` substituía integralmente essa lista. Uma configuração parcial poderia remover acidentalmente o app web, o site ou o alias de branch da Vercel.

Agora a variável acrescenta origens, com remoção de duplicatas, espaços e barras finais. As origens históricas permanecem permitidas, incluindo o app Vercel, `app.secompufscar.com.br` e o alias conhecido `secomp-app-xiv-git-main-secomp-tis-projects.vercel.app`. Não há wildcard para `*.vercel.app`. Métodos, credenciais e respostas da API permanecem iguais. A configuração CORS usada pelo servidor é compartilhada com os testes.

`tests/cors-web-app.test.cjs` verifica configuração parcial/vazia, origem do app, preflight de login com Authorization/Content-Type/headers de versão, respostas 200/401 e ausência de autorização CORS para outras origens, inclusive domínios parecidos. `npm run verify` passou com 63 testes e três integrações omitidas da suíte comum.

## Verificação do serviço publicado — 28/09/2026

- A página inicial da Vercel retornou 200. Seu bundle público `index-1e3a415999f5178b57f075da87a568da.js` usa `https://secomp-server-xiv-production.up.railway.app/api/v1`, não o domínio personalizado da API.
- Na Railway, `OPTIONS /api/v1/users/login` retornou 204, `Access-Control-Allow-Origin: https://secomp-app-xiv.vercel.app`, credenciais habilitadas e os headers solicitados permitidos. A leitura de `/api/v1/app/version?platform=web` retornou 200 com CORS, mas corpo genérico da API; isso não comprova que a rota de política de versão esteja publicada.
- O domínio alternativo `api.secompufscar.com.br` retornou 526 e não chegou a expor headers CORS. A [Cloudflare documenta 526 como falha de validação do certificado de origem](https://developers.cloudflare.com/support/troubleshooting/http-status-codes/cloudflare-5xx-errors/error-526/). Esse domínio não era o utilizado pelo bundle examinado.
- O acesso HTTP direto a `/App/Home` retornou 404, enquanto `/` retornou a aplicação. Isso pode afetar recarga/deep link e deve ser tratado na configuração de rotas da hospedagem se reproduzido no navegador; não é corrigido por CORS.
- O bundle examinado não contém os headers `x-app-platform`/`x-app-version`. Não ativar bloqueio por versão sem validar clientes web e links públicos, conforme AUD-11 da [auditoria](security-performance-review-2026-09-28.md).

Essas observações são posteriores ao rollback relatado. **Não confirmam a causa da quebra anterior**. A correção evita a exclusão das origens publicadas por uma variável parcial, mas seu merge/CI não comprova deploy na Railway nem correção das rotas da Vercel. Não foi alterada a configuração online, nem é necessário novo APK para esta correção.
