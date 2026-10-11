# Próximas edições de certificados

Revisão: 11/10/2026. Snapshots por edição e histórico privado integrados no PR #40 e publicados na API `28780cc3`; Meus certificados publicado pelo app do PR #35. [Evidência de produção](../historico/auditorias/certificate-release-2026-10-11.md). O único cadastro aprovado hoje é XIV/2026. XV/2027 aparece somente em testes sintéticos, não é uma programação aprovada. Publicar o suporte a futuras edições não autoriza cadastrar/habilitar uma edição sem revisão oficial.

## Onde alterar

| Elemento | Fonte de verdade |
| --- | --- |
| Ano escolhido para emissão pelo participante | `CERTIFICATE_YEAR` na API; padrão 2026, nunca o relógio ou `event.isCurrent` |
| Número da edição, nome do evento, instituição, cidade e modelo | `src/services/certificateEditions.ts`, registro `certificateEditions` |
| Datas e atividades da edição | Evento e atividades vinculados pelo `eventId` no banco |
| Presença e credenciamento | Registros da mesma edição, avaliados por `src/services/certificatePolicy.ts` |
| Minutos, exclusão e fonte oficial | Atividade no banco; plano aprovado por IDs em `scripts/certificates/` |
| Conteúdo histórico e identidade do modelo | `certificates.snapshot`; consulta não usa o cadastro atual |
| Emissão, recuperação, reemissão e trava transacional | `src/repositories/certificateRepository.ts` |
| Contrato público, QR e código | `src/routes/certificates.ts` |
| Visual, fontes, logos e paginação | [Guia de manutenção do app](https://github.com/secompufscar/secomp-app-xiv/blob/main/docs/certificate-maintenance.md) |

`snapshot.version = 2` é a versão do formato de dados. `presentation.templateId = "secomp-landscape-v1"` é a versão do visual; são conceitos diferentes. Reutilizar o modelo V1 em outra edição é permitido: os textos de identidade vêm do snapshot.

## Preparar uma edição

1. Fazer backup no ambiente autorizado. Preservar documentos baixados, registros antigos, auditorias, arquivos ignorados e backups locais. Não apagar a edição anterior.
2. Cadastrar o evento com ano único, datas e atividades vinculadas ao evento correto. Identificar exatamente uma atividade de credenciamento. Registrar presenças no evento certo; inscrições não substituem presença.
3. Adicionar o ano aprovado a `certificateEditions`, com `edition`, `eventName`, `issuer`, `city`, `location` e `templateId` compatível com o app. Não inferir número romano a partir do ano e não modificar `legacyXivPresentation`. O app aceita edições posteriores com metadados válidos, mas rejeita modelos desconhecidos.
4. Criar outro JSON de durações, sem substituir `xiv-durations.json`. Usar `{ "year": ANO, "source": "Confirmação oficial", "activities": [...] }`; cada item contém `id`, `name`, `minutes`, `excluded` e, opcionalmente, `source`. Para excluir: `minutes: null, excluded: true`. Para incluir: minutos inteiros de 1 a 10080 e `excluded: false`. Conferir IDs, títulos e fonte com a organização. Não copiar as horas da XIV automaticamente.
5. Revisar o plano com os comandos abaixo. A prévia não escreve. A aplicação ocorre numa transação e recusa divergências. `--verify-ready` precisa encerrar com código zero; atividades certificáveis sem duração continuam bloqueando cada emissão. O script de títulos `rename-titles.cjs` é específico da XIV e não deve ser aplicado à nova edição.

```sh
node scripts/certificates/configure-durations.cjs --check --plan scripts/certificates/PLANO-APROVADO.json
node scripts/certificates/configure-durations.cjs --apply --plan scripts/certificates/PLANO-APROVADO.json
node scripts/certificates/configure-durations.cjs --verify-ready --plan scripts/certificates/PLANO-APROVADO.json
```

Sem `--plan`, o script continua usando o plano XIV. A fonte das horas deve ser aprovada antes da emissão; pontos, check-in e intervalos entre atividades não são inferidos pelo sistema.

## Preservar o histórico

- Uma emissão nova copia identidade, datas, atividades, durações e fontes para o snapshot. Alterar o registro de edições posteriormente não modifica essa cópia.
- Consultar um código antigo não depende de `CERTIFICATE_YEAR`, do evento atual ou da flag de emissão. Uma reemissão mantém o evento e a apresentação do original, mas revalida os dados administrativos da mesma edição e cria outra revisão/código.
- Meus certificados usa `GET /mine` para listar a última revisão já emitida por edição da própria conta e `GET /mine/:code` para recuperar o detalhe. Leituras independem da edição habilitada e não emitem. `POST /mine` continua sendo uma ação explícita exclusiva da edição configurada; o seletor não permite primeira emissão retroativa. Uma revisão revogada permanece visível, sem oferecer uma anterior como válida.
- Snapshots V1/2026 possuem fallback explícito e imutável para XIV/V1. Não aplicar substituições globais de XIV por XV e não regravar snapshots para atualizar a marca.
- Preservar os renderizadores e assets antigos no app. Para outra composição visual, criar novo `templateId`, renderizador e pasta de assets; publicar suporte antes de emitir com esse ID.
- O sistema preserva conteúdo e seleção do modelo, não a identidade binária de arquivos regenerados pelo jsPDF. Guardar o PDF originalmente emitido separadamente quando for necessário manter exatamente seus bytes ou a aparência de um modelo anterior ao versionamento.

## Testar e publicar

1. Em homologação isolada, rodar `npm run verify`, `npm run build` e `npm run test:db:atomicity`. Os testes `tests/certificate-editions.test.cjs` cobrem seleção explícita, rejeição de configuração inválida, emissão futura, consulta/reemissão histórica e plano de outra edição.
2. No app, executar TypeScript, testes de PDF e E2E em 320/1280 px. Conferir um certificado da edição nova e um XIV antigo após a troca: título, ano, total/anexo, código, QR, logos e download. Conferir 404, 410 e bloqueios por credenciamento/duração.
3. Abrir PRs separados. Fazer merge da API antes de publicá-la e conferir CI. Publicar a API compatível e o app com todos os modelos necessários. Este incremento não acrescenta migração; publicações futuras com schema novo seguem o fluxo de migrações habitual.
4. Manter `CERTIFICATES_ENABLED=false`, configurar explicitamente `CERTIFICATE_YEAR=ANO_APROVADO` e conferir `CERTIFICATE_VALIDATION_URL`. Aplicar apenas o plano revisado da edição; validar a página pública sem login.
5. Habilitar novas emissões somente após readiness e homologação aprovadas. Registrar commit, configuração, migrações e limitações da verificação no histórico, sem dados pessoais.

Rollback: desabilitar emissão primeiro. Restaurar a configuração anterior somente se aprovada; isso não apaga certificados de nenhum ano. Não retirar do app/API o suporte a um snapshot/modelo que já tenha sido emitido. Código antigo continua validável ou retorna 410 se tiver sido revogado, nunca deve apontar para outro participante ou edição.

## Evidência local de 11/10/2026

### Meus certificados

Rodada posterior: 144 testes da API aprovados e 14 casos MySQL ignorados na suíte unitária; os 13 casos do runner de banco isolado passaram, incluindo última revisão por edição, preservação da identidade histórica, acesso exclusivo pelo proprietário, 404 para outra conta e 410 para código próprio revogado. Repetição focada dos sete casos de edições/histórico aprovada com acesso HTTP em loopback; a tentativa restrita foi bloqueada pelo sandbox com EACCES. Build da API aprovado. App: 105 testes, TypeScript, exportação web e E2E sintético em 320/1280 px aprovados.

O novo datadir de ensaio foi preservado após desligar o MySQL temporário; o runner removeu somente seu schema aleatório. As 19 migrações existentes foram aplicadas apenas nessa base isolada. Sem nova migração, acesso ao banco real, emissão real ou alteração de produção nessa fase local. O caso de capacidade/inscrições fora do runner não foi reexecutado. A integração/publicação posterior está registrada na [evidência de produção](../historico/auditorias/certificate-release-2026-10-11.md), sem confundir resultados locais com online.

### Versionamento de edições

TypeScript e build aprovados. Suíte da API: 141 casos aprovados e 14 casos MySQL ignorados nessa execução; posteriormente, o runner de banco isolado executou seus 13 casos com sucesso, incluindo emissão futura e reemissão histórica mantendo XIV mesmo com outro ano configurado. O teste MySQL de capacidade/inscrições, que não integra esse runner, não foi reexecutado nesta rodada. O teste focado de edições e planos também passou após a validação estrita de IDs.

Foi usado um datadir novo e um schema temporário aleatório no MySQL 8.4 local, com 19 migrações existentes aplicadas; o runner removeu apenas o schema criado para o ensaio. O servidor temporário foi desligado e seus arquivos locais preservados. Não foi adicionada migração, nem acessado/alterado o banco de produção nessa etapa local. CI remota, merge e deploy foram confirmados depois, na evidência de publicação indicada no início do guia.
