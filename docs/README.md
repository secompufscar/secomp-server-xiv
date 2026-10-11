# Documentação da API SECOMP XIV

Entrada da documentação. Use o [roadmap](roadmap.md) para prioridades e estados de implementação, integração e produção. Última revisão: 11/10/2026. Código funcional atual: API `dd9085ae` (PR #42), publicada e validada na Railway antes do app `bd3a82a7` (PR #37), publicado na Vercel. Meus certificados inclui amostra ADMIN sem validade, além de histórico privado e preservação dos modelos, com 19 migrações existentes e sem migração adicional. [Evidência da amostra ADMIN](historico/auditorias/admin-certificate-test-release-2026-10-11.md), [evidência anterior de certificados](historico/auditorias/certificate-release-2026-10-11.md). Os resultados anteriores da lista geral estão na [evidência de 06/10](historico/auditorias/participant-directory-release-2026-10-06.md); login, migrações e editor nas [evidências de 03/10](historico/auditorias/production-deployment-2026-10-03.md). Cada rodada mantém seu escopo e limitações.

| O que você procura | Referência |
| --- | --- |
| Cadastro, login, recuperação e edição de contas | [Contas](funcionalidades/contas.md) |
| Cadastro público limitado a USER | [Testes de cadastro](../tests/signup.test.cjs), [PR #10](https://github.com/secompufscar/secomp-server-xiv/pull/10) |
| Edição atual, inscrições, capacidade, filas e cancelamento | [Inscrições](funcionalidades/inscricoes.md) |
| Edição web de apresentação, foto, horário, local e vagas | [Atividades](funcionalidades/apresentacao-atividade.md) |
| Check-in, pontos, nomes e total de presentes | [Presença](funcionalidades/presenca.md) |
| Certificados individuais, durações, QR e validação pública | [Certificados](funcionalidades/certificados.md) |
| Gerar amostra ADMIN sem validade, sem emitir ou alterar presenças | [Contrato de teste administrativo](funcionalidades/certificados.md#contrato-http), [guia do app](https://github.com/secompufscar/secomp-app-xiv/blob/main/docs/my-certificates-web.md#certificado-de-teste-para-admin) |
| Listar e recuperar certificados da própria conta por edição | [Contrato privado de certificados](funcionalidades/certificados.md#contrato-http), [guia do app](https://github.com/secompufscar/secomp-app-xiv/blob/main/docs/my-certificates-web.md) |
| Publicação de Meus certificados e preservação histórica | [Evidência de 11/10](historico/auditorias/certificate-release-2026-10-11.md) |
| Configurar próximas edições sem alterar certificados antigos | [Edições de certificados](funcionalidades/certificados-proximas-edicoes.md) |
| Todas as contas, busca, status e instante do credenciamento | [Diretório de participantes](contratos/participantes.md) |
| Publicação da lista geral e revisão de branches/documentação | [Evidência de 06/10](historico/auditorias/participant-directory-release-2026-10-06.md) |
| Migrações, publicação e recuperação operacional | [Publicação](operacao/publicacao.md) |
| Deploy, migrações e login web/iOS em produção | [Evidência de 03/10](historico/auditorias/production-deployment-2026-10-03.md) |
| Erros da API e logs no Railway | [Diagnóstico](operacao/diagnostico.md) |
| Arquivos pessoais, backups e exclusões do upload | [Arquivos locais](operacao/diagnostico.md#arquivos-locais-e-upload) |
| CI, testes locais e MySQL isolado | [Testes](operacao/testes.md) |
| Campos retornados e permissões | [Respostas](contratos/respostas.md) |
| Compatibilidade com app, web/iOS, CORS e eduroam | [Compatibilidade](contratos/compatibilidade.md) |
| Link de recuperação, prazo de uma hora e correção do 404 web | [Contas](funcionalidades/contas.md), [evidência online](historico/auditorias/production-deployment-2026-10-03.md#rotas-web-e-recuperação-de-senha) |
| Pendências e evidências por prioridade | [Roadmap](roadmap.md) |
| Implementações anteriores, auditorias e resultados originais | [Histórico](historico/README.md) |
| Revisão do trabalho e encerramento das branches | [Revisão de 01/10](historico/auditorias/work-review-2026-10-01.md) |
| Encontrar um documento pelo endereço antigo | [Mapa de caminhos](historico/caminhos-antigos.md) |

## Como manter

- Atualizar o guia funcional quando o comportamento mudar. Registrar no roadmap se a mudança está implementada, mergeada ou confirmada em produção; esses estados são independentes.
- Guias atuais incluem última revisão, evidência e limitações. Resultados de testes ficam associados à rodada/commit de validação, sem transformar uma contagem antiga em garantia para commits futuros.
- Preservar os relatos de correção e auditoria no histórico. Seus achados descrevem a data examinada; não são uma segunda lista de pendências atuais.
- Manter apenas `README.md` e `roadmap.md` na raiz. Guias ficam nas subpastas por assunto; relatos e snapshots ficam em `historico/`.
- Corrigir links ao mover arquivos e atualizar o [mapa de caminhos](historico/caminhos-antigos.md). Os encaminhamentos antigos e as cópias JSON da raiz foram retirados por escolha do responsável; os commits anteriores conservam seus endereços e âncoras.
- Resultados de novas auditorias locais ficam em `dist/audits/`. Publicar somente evidências revisadas no histórico, com o commit e o escopo da rodada; preservar os snapshots anteriores.

## Acompanhamento das correções — edição XIV

O [índice anterior](historico/correcoes/acompanhamento-2026-09-30.md) foi preservado como registro. Esta reorganização altera somente documentação.

## Compatibilidade com o aplicativo

Consulte o [guia atual de compatibilidade](contratos/compatibilidade.md) e o [procedimento de publicação](operacao/publicacao.md). Este título preserva a âncora do README anterior.
