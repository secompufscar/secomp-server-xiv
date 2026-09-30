# Revisão por blocos funcionais — 29/09/2026

Atualização de 30/09: [correções prioritárias](event-critical-fixes.md), [cotas em rede compartilhada](shared-network-rate-limits.md) e [consistência de edição](edition-registration-consistency.md) tratam os blocos de presença/pontos/cancelamento, agendador, HTTP/eduroam e estado das inscrições/edição atual. Os achados abaixo preservam o estado auditado em 29/09; não significam que todos continuam reproduzíveis. Cadastro/QR, troca de e-mail, senha administrativa/sessões, imagens, patrocinadores/tags e persistência/coordenação do agendamento continuam pendentes. Ver o [roadmap atualizado](roadmap.md). Diagnósticos em `scripts/audit` registram o estado anterior e não substituem a suíte de regressão atual.

## Conclusão histórica e prioridades na data da auditoria

**Primeira correção: tornar o agendador tolerante a atividades sem data e a falhas isoladas.** Há um caminho demonstrado de encerramento do processo da API após a inicialização, alimentado por dados que o próprio cadastro aceita. É uma alteração restrita ao servidor e deve preservar o cadastro de atividades ainda sem horário.

**Bloco principal seguinte: presença, pontos e elegibilidade da edição na mesma transação.** Hoje dois scans podem pontuar duas vezes e uma falha pode deixar pontos sem presença. As correções precisam alcançar check-in, edição administrativa e cancelamento, não apenas uma rota. Acrescentar consulta administrativa de nomes e total de presentes sem substituir os arrays já consumidos pelo app/site.

Antes de publicar qualquer conjunto, validar configuração, migrações, CORS, login legado/web e o limite por IP compartilhado na rede do evento. Isso não implica exigir senha nova, novo APK ou logout geral. Não realizar reconciliação automática de pontos históricos ou bloqueio de contas antigas sem regra funcional e ensaio próprios.

## Estado examinado e método

- Checkout XIV em `867c71da1d4bb4e5c739c32b485421df4742b3ad`; inclui PR #15 e #16, ambos **abertos** na consulta desta revisão.
- `origin/main` em `d764a6a`. PR #14 aberto em `15ee7fc`, examinado por `git show`, sem misturar seu código com o checkout. O CORS aditivo e o cancelamento transacional do #14 **não estão no HEAD do #16**.
- Divisão em três revisões paralelas somente leitura (autenticação; integridade/presença; administração/agendador), mais revisão central de HTTP, desempenho, publicação e comparação das branches.
- Inspeção de rota → autorização/validação → controller → serviço → repositório → schema/testes. Conferência cruzada para distinguir correções presentes, lacunas remanescentes e funções sem rota ativa.
- Reproduções com mocks em memória: check-in concorrente/falha, edição cruzada, cadastro parcial, recuperação após troca de e-mail, atividade sem data/horário e perda de imagem. Nenhum banco ou provedor real foi usado nessas reproduções.
- Diagnósticos locais persistidos em `scripts/audit/functional-http-review.cjs`: parser/CORS, cota compartilhada e encerramento de processo pelo scheduler. **Esses testes passam ao demonstrar o defeito**, não são aceite de uma correção nem fazem parte da suíte normal.
- Nenhum deploy, migração em produção, teste de carga online ou ação com contas reais. Não houve novo ensaio MySQL nesta revisão; os testes MySQL anteriores dos PRs mantêm seu escopo documentado. O app iOS e o deploy revertido não foram examinados integralmente nesta rodada.

## A — Identidade, acesso e recuperação

Funções examinadas: `login`, `signup`, `sendConfirmationEmail`, `confirmUser`, `sendForgotPasswordEmail`, `updatePassword`, `updateProfile`; emissão/rotação/revogação de sessões; `authMiddleware`, `adminMiddleware`, `authorizeSelfOrAdmin`, `isAdmin`; CRUD administrativo, schemas, projeções de usuário e configurações de segredos/versão.

| ID / prioridade | Achado e cenário | Referência | Aceite proposto |
| --- | --- | --- | --- |
| A1 / P1 | Cadastro cria usuário antes de gerar/persistir QR e antes do try de envio. Falha no QR deixa e-mail ocupado, conta não confirmada e nenhum e-mail; repetir cadastro falha. Reproduzido com serviço/hash/QR reais e banco simulado. | `src/services/usersService.ts:88`, `:95`, `:101`; `src/routes/users.ts:47` | Falhas em cada etapa não deixam cadastro irrecuperável; reenvio/retomada segura de confirmação; preservar rota, corpo e resposta. Tratar timeout de e-mail separadamente de rollback local. |
| A2 / P1 | Trocar e-mail conserva `confirmed` e `authVersion`. Link de recuperação entregue ao endereço anterior ainda muda a senha; confirmação também não vincula token ao endereço. Reproduzido: reset emitido → perfil troca e-mail → reset antigo aceito. | `src/services/usersService.ts:117`, `:146`, `:181`, `:227`, `:312` | Mudança pendente/verificada sem bloquear acesso existente; invalidar links do endereço anterior ao concluir a mudança. Edição só do nome não afeta sessões. Não usar simplesmente `confirmed=false`, que interromperia o acesso antes do evento. |
| A3 / P1 condicional | Senha editada por admin é hasheada, mas não incrementa versão/revoga sessões e links. Remanescente explicitamente fora do PR #16, não regressão nova. | `src/controllers/adminController.ts:63`, `src/routes/admin.ts:11` | Somente quando houver senha nova: hash/versão/revogação transacionais; outra conta intacta; edição só do nome sem logout; preservar 201. Priorizar se a equipe usa essa rota para recuperar contas. |
| A4 / P2 | Retry de refresh consumido revoga todas as sessões da mesma versão, inclusive outro dispositivo. Um timeout após sucesso pode causar esse efeito. | `src/services/authSessionsService.ts:51` | Avaliar revogação por família/dispositivo mantendo detecção de replay; testar perda de resposta e dois dispositivos. Não mudar política precipitadamente perto do evento. |

Proteções que continuam válidas: criação pública limitada a USER, projeções sem hash, autorização por titular/admin, hash administrativo e recuperação voluntária de uso único no PR #16. Não foi demonstrada nova regressão na recuperação voluntária. Solicitar e-mail não revoga sessões; recuperação concluída afeta só a conta em questão. A senha administrativa continua sendo outro fluxo.

## B — Edições, inscrição anual e vagas

Funções examinadas: `findCurrent`, `createWithRegistrationReset`, `deleteWithRegistrationClosure`, `createWithUserStatus`, criação/consulta/alteração/cancelamento anual; `createWithCapacity`, `deleteAndPromote`, filtros por usuário/edição e consultas de fila. PR #14 comparado separadamente.

| ID / prioridade | Achado e cenário | Referência | Aceite proposto |
| --- | --- | --- | --- |
| B1 / P1 | Criar edição, inclusive futura `isCurrent:false`, zera `registrationStatus` globalmente. Mais de uma edição pode ter `isCurrent=true`; `findFirst` escolhe uma sem invariante de unicidade. | `src/repositories/eventRepository.ts:19`, `:26`; `prisma/schema.prisma` | Criar edição futura não altera participantes atuais; transição de edição atual exclusiva e transacional; teste simultâneo em MySQL. |
| B2 / P1 | Inscrição/check-in usa inscrição anual da edição atual, sem confrontar `activity.eventId`. Cancelamento anual pode ocorrer entre validação e escrita. Edição cruzada reproduzida com mocks. | `src/services/usersAtActivitiesService.ts:45`, `src/services/checkInService.ts:17`, `src/services/eventService.ts:21` | Validar vínculo e elegibilidade dentro da escrita transacional. Testar duas edições e cancelamento concorrente. Examinar atividades legadas sem `eventId` antes de introduzir uma rejeição nova. |
| B3 / P1 | PR #14 torna cancelamento anual atômico, mas não sincroniza pontos/status/currentEdition nem promove filas de atividades liberadas. Promoções anuais concorrentes podem escolher o mesmo primeiro da fila; esta corrida é inferência do código, não novo teste MySQL. | **PR #14**, `src/repositories/userEventRepository.ts:104` | Definir e preservar invariantes de perfil, pontuação e cada fila; teste de dois cancelamentos simultâneos e duas edições; não anunciar o #14 como solução completa da consistência funcional. |

Não duplicar trabalho já feito: capacidade serializa por atividade e há unicidade `(userId,activityId)`; cancelamento e promoção de vaga de atividade usam transação. `eventService.deactivate` é incompleto, mas não possui rota exposta; prioridade menor que os caminhos ativos. Transação existente não engloba pontos quando o serviço os altera antes de chamá-la.

## C — Presença, pontos e consulta dos presentes

Funções examinadas: `checkIn`, `findUserAtActivity`, `markAsPresent`, `markAsPresentWithoutSubscription`, `usersAtActivitiesService.update/delete`, `addPoints/removePoints`, listagem de participantes e resumo de inscrições; interação com edição de atividades.

| ID / prioridade | Achado e cenário | Referência | Aceite proposto |
| --- | --- | --- | --- |
| C1 / P1 | Duas requisições leem ausência, somam pontos e marcam presença. Reprodução: atividade10 → saldo20, uma presença. Falha na marcação deixou saldo10/presença false. | `src/services/checkInService.ts:22`, `:43`, `:51` | Uma transição e um crédito sob concorrência, com/sem inscrição prévia. Rollback MySQL após cada escrita. Preservar sucesso200 e duplicata409. |
| C2 / P1 | Edição false→true soma antes de update; true→false não debita. Ciclos repetidos acumulam crédito. Delete debita antes da transação de exclusão/fila; cheque de saldo e decremento também são separados. | `src/services/usersAtActivitiesService.ts:73`, `:95`; `src/repositories/usersRepository.ts:76` | Mesma regra transacional de crédito/débito em todas as entradas; concorrência check-in/update/delete e falhas intermediárias preservam saldo, presença e fila. |
| C3 / P1 | Admin pode alterar pontos/edição/categoria com presenças existentes. Retirada usa pontos atuais, não o valor concedido: ganhou10, valor alterado para20, cancelamento debita20 ou falha. | `src/services/activitiesService.ts:71`; `src/services/usersAtActivitiesService.ts:107` | Registrar pontuação concedida e definir alteração histórica; não reprocessar saldos silenciosamente. Não deslocar inscrições históricas de edição sem regra explícita. |
| C4 / P2 requisito | Lista administrativa inclui nomes e `presente`, mas também ausentes/fila; não há resposta explícita de nomes **dos presentes** e total. Resumo de ocupação não é resumo de presença. | `src/repositories/checkInRepository.ts:60`, `src/controllers/checkInController.ts:15` | Manter array atual; acrescentar endpoint admin com total e participantes filtrados por presença. Testar palestra sem inscrição prévia, ausência, fila e proibição para não admin. |

Plano do bloco: definir transições/crédito histórico → transação com verificação de edição e atualização condicional → encaminhar todas as rotas → testes MySQL de concorrência/rollback → resumo aditivo de presentes. O teste anterior de capacidade não prova integridade da pontuação.

## D — Conteúdo administrativo e arquivos

Funções examinadas: create/update/delete/list/findById de atividades/categorias; CRUD/vínculos de patrocinadores/tags; upload/create/update/delete e consultas de imagens; Multer; rotas de autorização e schemas.

| ID / prioridade | Achado e cenário | Referência | Aceite proposto |
| --- | --- | --- | --- |
| D1 / P1 | Substituição destrói imagem anterior antes de upload/persistência da nova. Reprodução de upload falho: arquivo anterior destruído, banco ainda referencia URL antiga. Delete também destrói arquivo antes da escrita DB. | `src/controllers/activityImageController.ts:66`, `:149` | Upload novo, troca de referência, limpeza anterior; compensar upload novo se DB falhar e tornar limpeza recuperável. Preservar `imageUrl` e endpoints. |
| D2 / P2 | Patrocinador é criado antes de vincular tags em paralelo; deletes de patrocinador/tag removem vínculos antes da entidade. | `src/services/sponsorService.ts:38`, `src/repositories/sponsorRepository.ts:44`, `src/repositories/tagsRepository.ts:36` | Transações/nested writes; falhas de FK e entre etapas preservam snapshot em MySQL. |
| D3 / P2 | Payload administrativo de patrocinador chega sem filtro runtime ao Prisma, incluindo possíveis campos estruturais/nested writes além do formulário. Não é bypass de autorização: escrita exige ADMIN. | `src/controllers/sponsorController.ts:20`, `src/repositories/sponsorRepository.ts:34` | Schemas de campos permitidos com testes dos payloads reais; impedir alteração estrutural indevida sem cortar campos válidos do painel. |

Excluir atividade já transaciona seus vínculos; excluir categoria ocupada já usa checagem/FK. Limite de arquivo existe; MIME declarado não comprova assinatura binária. Logs brutos de erros ainda existem nesses controllers, fora da sanitização limitada do PR #15.

## E — Agendador e notificações

Funções examinadas: `scheduleNotificationsForActivity`, `scheduleAllActivityNotifications`, callbacks cron; inicialização; `sendNotification`, `sendNotificationToAll`, `sendPushNotification`, histórico e status.

| ID / prioridade | Achado e cenário | Referência | Aceite proposto |
| --- | --- | --- | --- |
| E1 / P1 imediato | Schema aceita data nula; create persiste antes de scheduler lançar400. Startup interrompe lista e deixa rejeição sem tratamento. Diagnóstico com função real e callback HTTP equivalente ao bootstrap encerrou processo filho com código1, sem banco. | `src/schemas/activitySchema.ts:5`, `src/services/activitiesService.ts:42`, `:54`, `src/services/schedulerService.ts:13`, `:73`, `src/index.ts:75` | Data ausente é cadastro válido sem tarefa; limpar data cancela tarefa anterior; falha de uma atividade não para as outras nem a API. Testar create/update/startup e indisponibilidade de banco no carregamento. |
| E2 / P1 | Soma fixa de3h atrasa lembretes. Reprodução UTC: atividade15Z, lembrete de2h vira16Z (1h depois da atividade), em vez de13Z. | `src/services/schedulerService.ts:31` | Calcular instantes absolutos sem compensação fixa; testar UTC/São Paulo e offset explícito; manter contrato da atividade. |
| E3 / P2 | Cron não tem ano nem autodestruição; atividade excluída não cancela jobs; cada instância agenda cópias. Push é chamado sem await; falhas podem escapar do callback. | `src/services/schedulerService.ts:34`, `:44`, `src/services/activitiesService.ts:90` | Disparo único persistente/idempotente, cancelamento, tratamento de falhas e coordenação entre instâncias. Não confundir try/catch com garantia de entrega. |
| E4 / P2 | Status SENT representa aceite inicial; não consulta recibos. Controller retorna sucesso mesmo com falha total registrada pelo serviço. | `src/services/notificationService.ts:21`, `:62`, `src/controllers/notificationsController.ts:32`, `:61` | Distinguir aceite/entrega/falha por dados aditivos, recibos e reconciliação de tokens inválidos, sem trocar abruptamente o contrato do painel. |

## F — HTTP, desempenho e integração das branches

Funções examinadas: bootstrap/middlewares/rotas finais; CORS e políticas de versão; health checks; limitadores; consultas de usuários, ranking, resumo de inscrições e histórico; migrações/CI/runner dos PRs.

| ID / prioridade | Achado e cenário | Referência | Aceite proposto |
| --- | --- | --- | --- |
| F1 / P1 antes do evento | Cota padrão compartilhada de20 solicitações por IP/hora para cadastro e recuperação. Diagnóstico local:20 cadastros com200 → 21º cadastro429 e recuperação429. NAT/Wi-Fi do evento pode reunir usuários distintos no mesmo IP. | `src/middlewares/rateLimits.ts:23`, `src/config/http.ts:33`, `src/routes/users.ts:47`, `:286` | Política que suporte volume legítimo da rede compartilhada sem retirar proteção contra abuso; separar operações e testar muitos usuários no mesmo IP, além de repetição abusiva. Confirmar configuração real antes do deploy. |
| F2 / P2 compatibilidade | Parsers executam antes de CORS. JSON inválido/excessivo responde400/413 sem ACAO, mesmo para origem permitida; navegador não consegue ler erro. Reproduzido. Não comprova causa do incidente iOS, pois um login normal não deveria gerar esses erros. | `src/index.ts:36`, `:38` | CORS nas respostas de erro para origens permitidas, sem abrir origem arbitrária; testar preflight e erros de parser com o mesmo bootstrap usado em produção. |
| F3 / P2 | Broadcast lê usuários completos duas vezes, incluindo dados internos desnecessários. Resumo de inscrições materializa lista para três números; ranking agrega base global; histórico não pagina. | `src/controllers/notificationsController.ts:48`, `src/services/notificationService.ts:15`, `src/repositories/usersRepository.ts:25`, `:181`, `src/repositories/usersAtActivitiesRepository.ts:102` | Projeção id/pushToken, lotes, contagens no banco e paginação opt-in. Preservar respostas; medir latência/volume antes/depois. Não demonstrado vazamento HTTP dessas leituras internas. |
| F4 / P2 operacional | `TRUST_PROXY_HOPS=0` cai no fallback1; rate limits usam memória por processo. Readiness consulta SELECT1, não o schema necessário; GET inexistente cai em resposta genérica200. Views ainda apontam `src/views`, problema condicional para pacote só com dist. | `src/config/http.ts:10`, `src/routes/health.ts:4`, `src/index.ts:24`, `:65` | Conferir topologia/proxy e contrato de readiness; smoke test do artefato publicado e conteúdo de `/app/version`, não só status200. Não afirmar que Railway já apresenta esses cenários. |

### Integração pendente dos PRs

`git merge-tree --write-tree HEAD origin/codex/p1-registration-cancellation` confirmou conflitos em `.github/workflows/ci.yml` e `scripts/run-isolated-mysql-test.cjs`. A operação não modificou checkout/índice; somente simulou a integração. CI verde de cada branch não comprova o resultado combinado.

Ao integrar, preservar os testes de evento, cancelamento e recuperação e evitar jobs MySQL redundantes; conferir CORS aditivo do #14 mais autenticação/recuperação do #15/#16. Exigir CI no commit combinado. Conferir segredos existentes e migrações antes do deploy, sem rotacioná-los automaticamente. Não encerrar branches só porque os testes isolados passaram.

## Ordem recomendada

1. **Agendador:** data nula, isolamento de falhas/startup e horário absoluto (E1/E2). Evita indisponibilidade e lembretes incorretos sem exigir ação do usuário.
2. **Presença/pontos/edição:** C1/C2/C3 e B2, com rollback e concorrência MySQL; incluir consulta aditiva de nomes/total (C4).
3. **Publicação compatível:** resolver integração #14–16, validar login web/legado e ajustar cota compartilhada antes da rede do evento (F1/F2). Esta etapa é requisito antes de publicar os itens anteriores, não autorização automática de deploy.
4. **Inscrição anual/cadastro:** B1/B3 e A1; eliminar perfis divergentes e contas presas, preservando estado histórico.
5. **Contas e arquivos:** A2/A3 e D1; fluxos verificados e transações/compensações que preservem acesso e imagem válida.
6. **Desempenho e entrega:** F3, E3/E4, D2/D3, demais logs e limpeza. Não fazer refatoração ampla perto do evento sem ganho mensurado.

Não há recomendação de forçar recuperação de senha, encerrar todas as sessões, exigir APK novo ou reverter todos os PRs. Esta análise é mais detalhada por fluxo, mas não certifica ausência de outras falhas.
