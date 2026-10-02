# Documentação da API SECOMP XIV

Entrada da documentação. Use o [roadmap](roadmap.md) para prioridades e estados de implementação, integração e produção. Última revisão: 01/10/2026, com `main` em `ac045eb`, incluindo as mudanças de contas do [PR #22](https://github.com/secompufscar/secomp-server-xiv/pull/22). Deploy e migrações desse código em produção não foram confirmados.

| O que você procura | Referência |
| --- | --- |
| Cadastro, login, recuperação e edição de contas | [Contas](funcionalidades/contas.md) |
| Cadastro público limitado a USER | [Testes de cadastro](../tests/signup.test.cjs), [PR #10](https://github.com/secompufscar/secomp-server-xiv/pull/10) |
| Edição atual, inscrições, capacidade, filas e cancelamento | [Inscrições](funcionalidades/inscricoes.md) |
| Check-in, pontos, nomes e total de presentes | [Presença](funcionalidades/presenca.md) |
| Migrações, publicação e recuperação operacional | [Publicação](operacao/publicacao.md) |
| Erros da API e logs no Railway | [Diagnóstico](operacao/diagnostico.md) |
| CI, testes locais e MySQL isolado | [Testes](operacao/testes.md) |
| Campos retornados e permissões | [Respostas](contratos/respostas.md) |
| Compatibilidade com app, web/iOS, CORS e eduroam | [Compatibilidade](contratos/compatibilidade.md) |
| Pendências e evidências por prioridade | [Roadmap](roadmap.md) |
| Implementações anteriores, auditorias e resultados originais | [Histórico](historico/README.md) |

## Como manter

- Atualizar o guia funcional quando o comportamento mudar. Registrar no roadmap se a mudança está implementada, mergeada ou confirmada em produção; esses estados são independentes.
- Guias atuais incluem última revisão, evidência e limitações. Resultados de testes ficam associados à rodada/commit de validação, sem transformar uma contagem antiga em garantia para commits futuros.
- Preservar os relatos de correção e auditoria no histórico. Seus achados descrevem a data examinada; não são uma segunda lista de pendências atuais.
- Corrigir links ao mover arquivos. Os caminhos Markdown antigos mantêm encaminhamentos e títulos para preservar links e âncoras de PRs. Snapshots JSON antigos mantêm cópias idênticas por compatibilidade; a localização organizada está no histórico.

## Acompanhamento das correções — edição XIV

O [índice anterior](historico/correcoes/acompanhamento-2026-09-30.md) foi preservado como registro. Esta reorganização altera somente documentação.

## Compatibilidade com o aplicativo

Consulte o [guia atual de compatibilidade](contratos/compatibilidade.md) e o [procedimento de publicação](operacao/publicacao.md). Este título preserva a âncora do README anterior.
