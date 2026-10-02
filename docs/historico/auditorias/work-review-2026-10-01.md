# Revisão do trabalho, branches e documentação — 01/10/2026

Base da API: `b1faa2b71fec7428bf05c5ec21b39cbbacb26a13`, após o merge do PR #23. Base do app: `821019fd03b2952dcdd8ad38dbd4dc21784a658b`, após o merge do PR #7. O estado vigente e as pendências estão no [roadmap](../../roadmap.md).

## O que foi revisto

- Histórico dos PRs produzidos, branches locais/remotas, ancestralidade e equivalência de patches.
- Consistência entre código integrado, guias, roadmap, relatos históricos e links de evidência.
- Configuração e resultado da CI no main da API, contratos preservados e limites da validação operacional.
- Inventário das 25 branches não-main do app e commits exclusivos das três branches divergentes.

Esta revisão não equivale a repetir cada auditoria de segurança nem comprova ausência de vulnerabilidades. As [auditorias de segurança/desempenho](security-performance-review-2026-09-28.md) e [por blocos](functional-block-review-2026-09-29.md) conservam seus escopos e reproduções. Os guias atuais e a suíte de regressão descrevem as correções posteriores; relatos antigos não são uma segunda lista de pendências.

## Resultado da revisão das correções

| Bloco | Código integrado e evidência | Limite restante |
| --- | --- | --- |
| Cadastro, papéis e projeções | USER no cadastro; retomada de conta pendente sem substituição de credenciais; [testes](../../../tests/signup.test.cjs) e [projeções](../../../tests/user-data-exposure.test.cjs) | Envio/entrega real e comportamento publicado ainda precisam de evidência |
| Credenciais e recuperação | Recuperação voluntária de uso único, troca de e-mail verificada e revogação administrativa; [contas](../../funcionalidades/contas.md) | Migrações, configuração e execução de todas as instâncias em produção não confirmadas |
| Presença e pontos | Transações e reversão de créditos conhecidos; consulta ADMIN com nomes e total; [presença](../../funcionalidades/presenca.md) | Sem reconciliação automática dos pontos históricos |
| Inscrições e edição | Cancelamento, promoção e edição atual coordenados; [inscrições](../../funcionalidades/inscricoes.md) | Conferir migrações e dados anteriores à publicação |
| HTTP, web/iOS e eduroam | CORS aditivo antes dos parsers e cotas por operação/identidade; [compatibilidade](../../contratos/compatibilidade.md) | Causa do incidente online, proxy, capacidade e coordenação entre instâncias ainda pendentes |
| Agendamento, imagens, patrocinadores/tags | Agendador corrigido por processo; lacunas já registradas no roadmap | Persistência de entregas, imagens sem perda e atomicidade/whitelist ainda não concluídas |

Os dois jobs da CI do main `b1faa2b` estavam concluídos com sucesso: Tests and TypeScript e MySQL integrity and rollback. O [snapshot](evidencias/work-review-2026-10-01.json) registra URLs e resultados. A CI valida tipos, testes, build e integrações locais isoladas; não comprova deploy, migrações de produção, entrega de e-mail ou capacidade no evento. Não foi necessária uma nova execução manual do banco para esta limpeza de documentação e referências Git.

O [relato Railway/Vercel](railway-vercel-login-2026-10-01.md) agora integra o histórico versionado, incluindo a continuidade após o merge do PR #7. A causa do preflight sem ACAO continua sem confirmação. O problema de acesso direto a `/App/Home` na Vercel é um achado distinto.

## Branches encerradas

As branches dos PRs #22 e #23 permaneciam no remoto mesmo após o merge. Os SHAs foram conferidos como ancestrais do main antes da exclusão, condicionada ao valor exato da referência. A [orientação do GitHub](https://docs.github.com/pt/repositories/configuring-branches-and-merges-in-your-repository/managing-branches-in-your-repository/deleting-and-restoring-branches-in-a-pull-request) permite encerrar branches de PRs mergeados sem outros PRs abertos que as referenciem; os históricos dos PRs permanecem disponíveis.

| Repositório | Branch encerrada no remoto | PR | SHA preservado |
| --- | --- | --- | --- |
| API XIV | `codex/verified-email-change` | [#22](https://github.com/secompufscar/secomp-server-xiv/pull/22) | `9013e234257a5890a526a0a7ada986ef1fa461c6` |
| API XIV | `codex/docs-navigation` | [#23](https://github.com/secompufscar/secomp-server-xiv/pull/23) | `b36d5360784ca7f62f6ede8914eb75c318a80650` |
| App XIV | `codex/fix-p0-release-blockers` | [#7](https://github.com/secompufscar/secomp-app-xiv/pull/7) | `0c08323a383b7a1db50454adea0e88a01102aa24` |

Na API, restam main e a branch ativa `codex/docs-root-cleanup` durante a revisão deste PR. Não foram criadas novas branches de implementação da API. A branch desta revisão também deverá ser encerrada depois do merge.

### Branches locais antigas

Doze nomes locais antigos foram encerrados depois de preservar cada SHA em `refs/archive/branch-retirement-20261001/<nome>`. Oito eram ancestrais do main; três continham patches equivalentes aos incorporados; uma era o rascunho inicial da reorganização, sem mudança técnica exclusiva. O rascunho não foi anunciado como mergeado: seu snapshot continua recuperável. Main foi atualizado por fast-forward antes da revisão.

| Nome local | SHA preservado | Critério |
| --- | --- | --- |
| `codex/docs-navigation` | `b36d5360784ca7f62f6ede8914eb75c318a80650` | ancestral |
| `codex/docs-organization` | `12b1fa0b91c251bad2c70844da79415861f0e0e3` | rascunho de documentacao arquivado |
| `codex/edition-registration-consistency` | `f794c00db3d3d4c4cf06304691afea5d0d79f92c` | patch equivalente |
| `codex/event-critical-fixes` | `e67f2f1e1c6b7e2bccfde74d91be21a55966aa91` | ancestral |
| `codex/functional-block-review` | `aeda6ca9d292c0f5a7d0d48081cabc5d811c2929` | ancestral |
| `codex/p1-registration-cancellation` | `15ee7fccd27849634ff71420b9b3fc4c2734006b` | ancestral |
| `codex/p1-write-integrity` | `42c6f4dbaf12e6bd2c7f3c34dff41cd47cbf5e24` | ancestral |
| `codex/shared-network-rate-limits` | `97cfa4446c5a59cadc4da16d13e768340d8d7225` | patch equivalente |
| `codex/signup-recovery` | `cd73da917e2e30249798965c10ab247a9af69457` | patch equivalente |
| `codex/single-use-password-recovery` | `867c71da1d4bb4e5c739c32b485421df4742b3ad` | ancestral |
| `codex/urgent-auth-web-safety` | `b67c79ea575dc6d28ad783806857a6679c1d6947` | ancestral |
| `codex/verified-email-change` | `9013e234257a5890a526a0a7ada986ef1fa461c6` | ancestral |

Para recuperar um nome local, sem publicar nada:

```sh
git branch codex/docs-organization refs/archive/branch-retirement-20261001/codex/docs-organization
```

A referência do app foi preservada no repositório de arquivo local `C:/Users/guilh/secomp-server-xiii/output/app-xiv-branch-archive.git`, sob o mesmo prefixo de referências. Esses arquivos são locais, não backups remotos; os SHAs incorporados também continuam no histórico dos respectivos PRs. Os diretórios anteriores `output/`, `verificador-senhas/` e `server-xiv/` do workspace XIII foram preservados.

## Branches antigas do app que não são deste trabalho

Após retirar a branch do PR #7, permanecem 21 branches antigas integralmente incorporadas ao main e três com commits exclusivos. O inventário e a comparação estão no [snapshot](evidencias/work-review-2026-10-01.json). Não existem PRs abertos no app na consulta. Não foram integradas mudanças antigas ao app durante esta revisão.

| Branch divergente | Commits exclusivos | Conteúdo | Recomendação |
| --- | --- | --- | --- |
| `fix-links` | 1 | Navegação do botão administrativo de patrocinadores | Comparar com a navegação atual antes de selecionar o patch; não mergear a árvore antiga inteira |
| `feat/lightmode` | 1 | Tema claro, ThemeContext, estilos e dependência | Avaliar como evolução visual separada, com regressão web/mobile; não é correção do login |
| `fix/fix-activityImage-creation` | 2 | Formatação e upload de imagens em criação/edição | Conferir o fluxo atual e complementar a prioridade de integridade de imagens; não presume correção do backend |

As 21 branches incorporadas podem ser tratadas numa limpeza do inventário anterior do app. As três divergentes exigem decisão baseada no código atual; exclusão ou merge indiscriminado ocultaria trabalho ou reintroduziria versões antigas. Nenhuma delas é uma implementação nova minha aguardando entrega.

## Organização final e compatibilidade de links

A escolha do responsável foi deixar apenas `README.md` e `roadmap.md` na raiz. Foram retirados 24 encaminhamentos Markdown e quatro cópias JSON. Os relatos completos não foram removidos; os quatro snapshots históricos permanecem byte a byte iguais aos da base anterior.

O [mapa de caminhos antigos](../caminhos-antigos.md) aponta para os documentos completos e para o commit que conserva os endereços retirados. Links internos foram examinados; links externos antigos ao main podem deixar de funcionar, como explicado antes da escolha. Links para commits anteriores mantêm os arquivos e âncoras originais.

Também foram corrigidos dois geradores de auditoria que ainda escreviam na raiz de docs. Novos resultados vão para arquivos com horário em `dist/audits/`, sem sobrescrever evidências versionadas. São scripts históricos de reprodução de achados; não substituem os testes de regressão nem precisam ser executados para validar esta mudança de saída.

Nenhum endpoint, contrato HTTP, migração, segredo, conta, ponto, inscrição ou deployment foi alterado nesta revisão.
