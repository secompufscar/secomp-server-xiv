# Amostra ADMIN com um minicurso - 11/10/2026

## Escopo

Correção solicitada pela organização após a publicação da amostra ADMIN: não somar o bloco simultâneo inteiro. SDD é escolhido de forma determinística; os outros três minicursos e o workshop da Karina ficam fora somente desta amostra. Cadastro, durações, presenças e certificados reais permanecem intactos. Resultado esperado com o plano aprovado: 24 atividades, 1680 minutos (28 horas), nome fixo e código/QR sempre inválidos.

A [publicação inicial](admin-certificate-test-release-2026-10-11.md), com 28 atividades e 2370 minutos, é histórica; suas evidências não são reescritas.

## Estado

Implementação e validação local concluídas; a publicação desta correção ainda não foi confirmada. Não há migração nova nem operação de escrita em produção.

## Verificação local

- API: TypeScript, build e 147 testes aprovados; 14 casos MySQL separados da suíte comum.
- App: TypeScript, 111 testes e exportação web aprovados. Teste de PDF extenso confirma 28 horas na capa/anexo, QR inválido em todas as páginas e atividades únicas; quatro páginas sintéticas inspecionadas.
- E2E com Edge em 320/1280 px aprovado, somente APIs sintéticas, sem requisições reais. Screenshots administrativos inspecionados; downloads e histórico preservados.
- MySQL isolado: 13/13 testes aprovados e 19 migrações aplicadas. Plano de 37 atividades mantém as 28 certificáveis para a política real; amostra retorna 24/1680, SDD uma vez, sem os outros três minicursos/workshop. Teste compara certificados, atividades e presenças antes/depois da consulta. Somente o schema aleatório do runner foi removido; datadir e evidências locais preservados.
- Arquivos V1, assets congelados, política real e plano de durações sem diff. Produção lida antes da publicação: cinco certificados, 19 migrações, emissão habilitada e ano 2026; baseline privado preservado.

## Manutenção

Política exclusiva da amostra: `src/services/certificateAdminPreviewPolicy.ts`. IDs do bloco de 2026 e prioridade de SDD não dependem dos títulos nem da categoria do workshop, cadastrado como Palestras. Se SDD estiver ausente/excluído, escolhe o primeiro dos demais minicursos na ordem aprovada; sem nenhum, retorna 409. Duração pendente do escolhido bloqueia, sem escolher outro para esconder o problema. As próximas edições exigem revisão dos blocos próprios nessa política. `certificatePolicy.ts`, plano oficial e renderizador real V1 não são alterados.
