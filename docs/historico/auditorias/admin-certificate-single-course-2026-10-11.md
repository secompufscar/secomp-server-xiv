# Amostra ADMIN com um minicurso - 11/10/2026

## Escopo

Correção solicitada pela organização após a publicação da amostra ADMIN: não somar o bloco simultâneo inteiro. SDD é escolhido de forma determinística; os outros três minicursos e o workshop da Karina ficam fora somente desta amostra. Cadastro, durações, presenças e certificados reais permanecem intactos. Resultado esperado com o plano aprovado: 24 atividades, 1680 minutos (28 horas), nome fixo e código/QR sempre inválidos.

A [publicação inicial](admin-certificate-test-release-2026-10-11.md), com 28 atividades e 2370 minutos, é histórica; suas evidências não são reescritas.

## Estado

Correção integrada e publicada, API primeiro, sem migração nova ou operação de escrita em produção.

- API: [PR #44](https://github.com/secompufscar/secomp-server-xiv/pull/44), funcional `10b6f2797a7189b197a571447fbec6c696db22a4`, merge `5bc02005ed21ae7dde5e750c7a9af774b9aefa6a`.
- Railway: `84d93f23-498d-47b3-a97c-9ffd2c102c2d`, SUCCESS, upload somente de archive Git do merge, sem arquivos locais/privados.
- App: [PR #39](https://github.com/secompufscar/secomp-app-xiv/pull/39), funcional `0143c82cf0c9634dba74d6331aafc101cca3e6ad`, merge `5b54707666401510a9899c42e4c5b701d20222e8`, integrado após validar a API publicada.
- Vercel: [deployment do merge](https://vercel.com/secomp-tis-projects/secomp-app-xiv/ASS4NwBSWvjKjk12Zy5mnmJChLZs), success. CI dos dois PRs e dos dois merges aprovada, separadamente dos resultados dos deployments.

Revisões posteriores apenas documentais não mudam código funcional, modelos ou dados. A versão inicial de 28 atividades/39h30 não é mais a amostra atualmente servida.

## Verificação local

- API: TypeScript, build e 147 testes aprovados; 14 casos MySQL separados da suíte comum.
- App: TypeScript, 111 testes e exportação web aprovados. Teste de PDF extenso confirma 28 horas na capa/anexo, QR inválido em todas as páginas e atividades únicas; quatro páginas sintéticas inspecionadas.
- E2E com Edge em 320/1280 px aprovado, somente APIs sintéticas, sem requisições reais. Screenshots administrativos inspecionados; downloads e histórico preservados.
- MySQL isolado: 13/13 testes aprovados e 19 migrações aplicadas. Plano de 37 atividades mantém as 28 certificáveis para a política real; amostra retorna 24/1680, SDD uma vez, sem os outros três minicursos/workshop. Teste compara certificados, atividades e presenças antes/depois da consulta. Somente o schema aleatório do runner foi removido; datadir e evidências locais preservados.
- Arquivos V1, assets congelados, política real e plano de durações sem diff. Produção lida antes da publicação: cinco certificados, 19 migrações, emissão habilitada e ano 2026; baseline privado preservado.

## Manutenção

Política exclusiva da amostra: `src/services/certificateAdminPreviewPolicy.ts`. IDs do bloco de 2026 e prioridade de SDD não dependem dos títulos nem da categoria do workshop, cadastrado como Palestras. Se SDD estiver ausente/excluído, escolhe o primeiro dos demais minicursos na ordem aprovada; sem nenhum, retorna 409. Duração pendente do escolhido bloqueia, sem escolher outro para esconder o problema. As próximas edições exigem revisão dos blocos próprios nessa política. `certificatePolicy.ts`, plano oficial e renderizador real V1 não são alterados.

## Verificação em produção

- Endpoint externo: duas contas ADMIN confirmadas receberam 200, 24 atividades/1680 minutos, somente SDD nesse bloco e sem workshop da Karina. USER 403, anônimo 401, marcador inválido público 404; `no-store` e ausência da amostra no histórico confirmados. Tokens de 60 segundos ficaram somente na memória remota, sem login/refresh interativo ou persistência local de credenciais.
- Cinco certificados, atividades e presenças conservaram os hashes completos da leitura anterior. Mesmas 19 migrações concluídas, `CERTIFICATES_ENABLED=true` e `CERTIFICATE_YEAR=2026`; não houve recadastro, reemissão ou mudança de horas reais.
- PDF gerado com a resposta ADMIN real: quatro páginas inspecionadas; 24 atividades únicas, 28 horas por extenso na capa/anexo, texto de amostra, três logos preservados. QR decodificado independentemente em todas as páginas e aponta para o mesmo marcador inválido rejeitado publicamente.
- App publicado: E2E Edge com APIs sintéticas em 320/1280 px, sem requisições à API real; botão ADMIN, cancelamento/retry, download e preservação de seleção/histórico conferidos. Separadamente, validação pública e download histórico usam API real, sem autenticação: 11 atividades/780 minutos, duas páginas, mesmo código/link/QR; inválido/desconhecido e proteção da rota privada anônima conferidos. Hashes dos PNGs das duas páginas históricas idênticos aos da publicação anterior, sem mudança visual; isso não é comparação binária de PDFs com metadados variáveis.
- Evidências, PDFs e screenshots ficam privados em `tmp/certificate-release-private/`, em pastas novas, preservando arquivos e backups anteriores. MySQL isolado da porta 3315 desligado após conferir seu datadir, que foi preservado; apenas o schema temporário do runner foi removido.

## Limites

Não foi feito login interativo com senha/refresh de ADMIN nem emissão/reemissão real para ensaiar a correção. Teste visual privado com APIs sintéticas não é prova de login real. Não houve teste de carga da Railway ou leitura do QR por câmera física. Só XIV/2026 está aprovada; outras edições usadas no E2E são fictícias. A soma de 28 horas descreve a amostra com o cadastro desta rodada, não uma regra fixa imposta ao total nem uma concessão de horas a administradores.
