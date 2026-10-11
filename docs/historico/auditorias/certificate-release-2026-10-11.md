# Certificados por edição: publicação de 11/10/2026

## Estado confirmado

Incremento funcional integrado em PRs separados, com API publicada e validada antes do merge do app:

| Componente | Commit funcional integrado | Publicação |
| --- | --- | --- |
| API, [PR #40](https://github.com/secompufscar/secomp-server-xiv/pull/40) | `28780cc3a70673e56bcb061103514e70c48ecc10` | Railway `68f896cb-16ca-4439-8197-364afaa27a83`, SUCCESS |
| App, [PR #35](https://github.com/secompufscar/secomp-app-xiv/pull/35) | `8337d56942175ae532b55848f709ee3d2ba74b44` | [Vercel de produção](https://vercel.com/secomp-tis-projects/secomp-app-xiv/6gSeEhJVGy4rrJv4stSVr9JGnK3W), success |

Commits de implementação: API `7334849d9732a1b3de45e3ff7aad6e3fc5428965`; app `809712f4d5db0605d1570c66e2eaa9283f587df0`. [CI do PR da API](https://github.com/secompufscar/secomp-server-xiv/actions/runs/38153876555), [CI do merge da API](https://github.com/secompufscar/secomp-server-xiv/actions/runs/38154200323), [CI do PR do app](https://github.com/secompufscar/secomp-app-xiv/actions/runs/38153882905) e [CI do merge do app](https://github.com/secompufscar/secomp-app-xiv/actions/runs/38154430718) concluíram com sucesso. Revisões posteriores apenas documentais podem avançar a main sem modificar esses códigos funcionais; documentos, privados e backups não fazem parte do payload Railway.

O app publicado oferece [Meus certificados](https://secomp-app-xiv.vercel.app/MyCertificates) com autenticação e seletor da última revisão emitida por edição. Abrir, selecionar, atualizar e baixar não emitem. Geração continua explícita e exclusiva da edição configurada. Apenas XIV/2026 está aprovada e cadastrada nesta verificação; XV/2027 dos testes é sintética.

## Preparação e preservação

O responsável autorizou explicitamente um backup SQL completo, inclusive dados pessoais, em pasta local privada. Dump concluído, SHA-256 `a85e0cc510f287396d1b98fee195186893b0a0887f759dc1ba0b57c70c9d3c90`. Conteúdo, credenciais, IDs de contas e arquivos privados não foram incluídos nos commits, PRs, CI ou upload Railway.

Backup restaurado em schema aleatório no MySQL isolado em loopback. `prisma migrate deploy` não teve alterações pendentes; inventários por hash de todas as tabelas permaneceram iguais antes/depois das consultas. O ensaio verificou histórico mesmo com emissão desabilitada e ano configurado não aprovado, propriedade do detalhe e revisão revogada. Não executou emissão, reemissão, revogação ou atualização de duração. Produção usa MySQL 9, ensaio local usa 8.4; somente a cópia em memória do dump recebeu a adaptação conhecida do delimitador/DEFINER dos triggers de presença, sem modificar o backup original. A primeira tentativa restaurou uma cópia, mas não concluiu os testes por caminho incorreto do tsconfig no helper; a repetição com projeto explícito passou. Ambas as cópias foram preservadas e o servidor temporário desligado.

O deploy foi preparado por `git archive` do commit já integrado, em pasta nova. Foram conferidos os arquivos do arquivo de fontes e a exclusão de envs, dumps e backups; nenhuma pasta local de trabalho foi enviada como payload. O serviço/ambiente existentes foram preservados. Start command permaneceu `npx prisma migrate deploy && npm start`.

## Banco e configuração de produção

- 19 migrações concluídas, sem rollback pendente; última `20261010030000_certificate_revisions`. Nenhuma migração adicional neste incremento.
- `CERTIFICATES_ENABLED=true` e ano efetivo 2026 antes/depois, sem modificar variáveis ou segredos nesta rodada.
- Cinco certificados existentes comparados por hash integral antes/depois do deploy, incluindo snapshots e auditorias: todos preservados.
- Nenhuma emissão, reemissão, revogação, alteração de presença, duração, categoria, nome de atividade, senha ou papel em produção nesta rodada.
- Snapshots legados continuam usando a identidade XIV/V1; novas emissões usam apresentação persistida e modelo versionado. Não foi emitido um documento V2 real apenas para testar.

## Verificação da API publicada

Executada dentro do deployment confirmado, por HTTP no serviço em execução e banco de produção, somente com GETs. Tokens de 60 segundos foram gerados no processo remoto usando a conta controlada existente, sem persistência ou exposição das credenciais.

| Caso | Resultado |
| --- | --- |
| Listagem e detalhe sem sessão | 401 |
| Listagem da própria conta | 200, somente resumos próprios e última revisão |
| Detalhe do certificado próprio ativo | 200, XIV/V1, 780 minutos e 11 atividades |
| Mesmo código solicitado por outra conta | 404 |
| Código próprio previamente revogado | 410 |
| Validação pública do ativo | 200, conteúdo/QR iguais ao detalhe privado |
| Validação pública do revogado | 410 |
| Código malformado | 404 |
| Cache das leituras privadas | `Cache-Control: no-store` |

Hashes dos registros permaneceram iguais durante essas leituras e ao baseline anterior ao deploy. Esse ensaio não comprova login interativo com senha nem renovação de sessão no navegador.

## Verificação do app publicado

Domínio de produção conferido com Edge/Playwright em 320 e 1280 px:

- E2E completo do bundle publicado com API interceptada e pessoas/edições sintéticas: seleção, modelo desconhecido, revogação, indisponibilidade/vazio, geração explícita, atualização após reemissão, download e restauração da rota. Nenhuma requisição desse ensaio chegou à API real.
- Ensaio separado da validação pública sem mocks, consultando o certificado controlado real: ativo, 11 atividades/780 minutos, ausência de credenciais, rejeição de código inválido/desconhecido e remoção de download anterior. Rota privada anônima não expôs o seletor.
- Sem overflow horizontal ou erros de página em ambas as larguras; screenshots inspecionados. Logos carregadas.
- PDF baixado do app publicado: duas páginas, 13 horas na capa, 11 atividades exatamente uma vez no anexo. Texto/link/código conferidos, QR de ambas as páginas decodificado independentemente e igual à URL pública. Páginas renderizadas com PDF.js e Poppler e inspecionadas sem sobreposição ou cortes.

Os arquivos e resultados com dados reais ficaram na pasta privada; somente este relato sem dados pessoais foi versionado. Downloads anteriores não foram substituídos. O código/QR do certificado existente não mudou: o download não é reemissão.

## Limites e continuidade

Testes locais: 105 casos do app, TypeScript, exportação e E2E aprovados; API com 144 casos aprovados/14 MySQL ignorados na suíte unitária e 13 casos aprovados no runner isolado. CI remota dos PRs e merges aprovada. Não foram repetidos login por senha, refresh real, capacidade sob carga da Railway, todos os participantes ou todas as regras administrativas em produção. Não há histórico multi-edição real para comprovar; o caso futuro foi sintético. Não houve alteração geral de dependências ou `npm audit fix`; alertas de dependências existentes continuam fora desta comprovação.

Para futuras edições, seguir [cadastro e planos](../../funcionalidades/certificados-proximas-edicoes.md) e o [guia visual do app](https://github.com/secompufscar/secomp-app-xiv/blob/main/docs/certificate-maintenance.md). Não substituir renderizador/assets V1, não regravar snapshots nem inferir cargas horárias. Rollback deve manter os modelos já emitidos e o contrato necessário ao app publicado; não remover migrações, editar histórico ou restaurar o banco por tentativa. Preservar todos os arquivos locais, ignorados e backups.
