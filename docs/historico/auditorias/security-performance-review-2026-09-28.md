# Revisão de segurança, integridade e desempenho — XIV

Registro de implementação/auditoria preservado para rastreabilidade. O estado vigente está no [roadmap](../../roadmap.md).

Data: 28/09/2026. Código examinado: `109a4bbbba7396357aeb154128e839560a3161b8`, sobre `main` em `d764a6a`, incluindo o cancelamento transacional do PR #14. Esta revisão encontrou falhas reais e regressões recentes; não há base para afirmar que todas as branches melhoraram o sistema em todos os aspectos.

## Escopo e método

Revisão dos fluxos de rotas, autenticação/autorização, controllers, serviços, repositórios, schemas de entrada, Prisma/migrações, upload, notificações/agendador, respostas, dependências, scripts de teste, build e CI. Foram examinados os módulos atuais que reúnem o trabalho das 25 branches integradas e o diff exclusivo do experimento BLOB. O [inventário](evidencias/branch-inventory-2026-09-28.json) preserva seus SHAs.

- Inspeção estática, busca de chamadores, `git blame`, `git log -S` e comparação com versões anteriores para distinguir regressão de dívida herdada.
- `npm run verify`: 61 testes passaram; três integrações são omitidas na suíte comum. Build passou. Os dois checks do PR #14 no commit `109a4bb` passaram, inclusive MySQL rollback.
- [12 reproduções controladas](../../../scripts/audit/security-reproductions.cjs), todas confirmando o comportamento defeituoso descrito. Esses testes usam mocks das fronteiras externas; **passar significa reproduzir um defeito**, não aprovar a implementação. Não fazem parte da suíte normal de regressão.
- [Auditoria MySQL reproduzível](../../../scripts/audit/mysql-review.cjs): dados sintéticos, MySQL 8.4.11 separado em loopback, schema aleatório, oito migrações e remoção do schema ao final. Confirmou violações de integridade no banco real e mediu seis consultas, com dois tamanhos de base. [Resultados brutos](evidencias/audit-mysql-results-2026-09-28.json).
- `npm audit --omit=dev`: dois alertas moderados na cadeia Bull → uuid; zero altos/críticos nesse levantamento de dependências. Isso não mede vulnerabilidades no código da aplicação.
- TypeScript com `--noUnusedLocals --noUnusedParameters`: 14 diagnósticos adicionais. Parte são parâmetros obrigatórios de handlers; não são 14 vulnerabilidades.
- Busca de arquivos de ambiente/chaves no histórico alcançável encontrou somente `.env.example`. Não equivale a uma varredura certificada de todos os tipos de segredo.

Não foram executados ataques, carga, alterações de configuração ou migrações no serviço online. Não foram auditados o código completo do app/site, configurações reais de proxy, segredos, permissões de produção, backups ou logs remotos. As conclusões de comportamento são sobre o código e os cenários locais. Esta é uma revisão abrangente do repositório, não uma garantia de ausência de outros defeitos.

## Achados prioritários

P1 exige correção prioritária; P2 deve entrar na próxima sequência de confiabilidade/desempenho. As condições de exploração importam: um problema em operação administrativa não implica que um usuário anônimo possa executá-la.

### AUD-01 — P1: confirmação de e-mail aceita chave padrão conhecida

**Local:** `src/config/sendEmail.ts:6`, `src/services/usersService.ts:145`.

Na ausência de `EMAIL_SECRET`, o servidor usa uma constante pública. A reprodução assinou localmente um token com essa constante e confirmou um UUID sintético. O impacto é burlar a prova de posse do e-mail quando a configuração está ausente/padrão e o UUID é conhecido; isso não demonstra que a produção usa essa chave nem que permite login sem conhecer a senha.

**Correção:** falhar na inicialização se os segredos estiverem ausentes/padrão; exigir segredos distintos para acesso, confirmação e reset; invalidar tokens emitidos sob chave comprometida. Aceite: configuração inválida impede o start e token assinado com a constante é rejeitado. Nenhum APK novo é necessário.

### AUD-02 — P1: reset reutilizável e sessões mantidas após troca de senha

**Local:** `src/services/usersService.ts:206`, `src/controllers/adminController.ts:56`, `src/services/authSessionsService.ts`.

O reset valida assinatura/expiração e atualiza a senha, sem consumir o token nem revogar refresh sessions. O mesmo token atualizou a senha duas vezes na reprodução; nenhuma revogação foi chamada. Access tokens também não consultam versão de sessão. A edição administrativa de senha tem a mesma lacuna de revogação.

**Correção:** token de reset de uso único e atualização/revogação em transação; definir invalidação de access tokens existentes por versão de sessão/data de troca. Preservar a rota atual e o login legado. A [OWASP recomenda tokens de reset de uso único e tratamento explícito das sessões existentes](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html). Aceite: segundo uso falha e sessões anteriores não renovam; testar concorrência no uso do token.

### AUD-03 — P1: troca de e-mail conserva confirmação anterior

**Local:** `src/services/usersService.ts:298–324`.

Um usuário autenticado muda o e-mail e permanece `confirmed: true`, sem comprovar posse do novo endereço ou confirmar a senha. Reproduzido. Isso permite representar um endereço não verificado e, com uma sessão comprometida, alterar o canal de recuperação da conta.

**Correção:** mudança pendente com token enviado ao novo endereço, confirmação de credencial para a operação sensível e aviso ao endereço anterior. Não apagar o e-mail atual antes de concluir a confirmação. Validar e normalizar o corpo no servidor. A compatibilidade do fluxo deve ser acordada com o site, sem impor novo APK para os demais ganhos.

### AUD-04 — P2: limite bcrypt em caracteres, não bytes

**Local:** `src/schemas/userSchema.ts:9`.

O schema aceita duas senhas distintas com 37 caracteres/73 bytes, mas bcrypt as considera iguais porque o primeiro trecho de 72 bytes coincide. Reproduzido com texto UTF-8. A validação adicionada em `b7b02b3` não resolveu o limite real. [A documentação do bcrypt especifica 72 bytes](https://github.com/kelektiv/node.bcrypt.js#security-issues-and-concerns).

**Correção:** validar bytes em novos cadastros/resets e definir migração compatível para credenciais antigas, sem truncar silenciosamente nem impedir logins existentes sem análise. Aceite: entradas acima de 72 bytes recebem 400 antes da escrita.

### AUD-05 — P1: presença e pontos não são uma operação idempotente

**Local:** `src/services/checkInService.ts:17–53`, `src/services/usersAtActivitiesService.ts:73–112`, `src/repositories/usersRepository.ts:74–95`.

A leitura de `presente`, incremento dos pontos e marcação da presença são separados. Dois check-ins concorrentes, sincronizados após a leitura inicial e executados contra MySQL real, deram **20 pontos para uma atividade de 10**, mantendo uma única presença. A reprodução com falha na marcação conservou os pontos já adicionados. Atualizar presença para false e depois true também pode acumular pontos, pois a reversão não debita. A exclusão debita antes da transação que remove a inscrição, e a verificação de saldo separada do decremento admite corrida.

**Correção:** transação e transição condicional de estado, com crédito/débito exatamente uma vez; registrar a pontuação concedida para não recalcular histórico com o valor atual da atividade. Aceite: concorrência, repetição e falha intermediária preservam a mesma pontuação e presença. Manter consulta de nomes e total (AUD-21).

### AUD-06 — P1: inscrição e check-in ignoram a edição da atividade

**Local:** `src/services/usersAtActivitiesService.ts:45–60`, `src/services/checkInService.ts:17`, `src/services/userEventService.ts:29–50`.

As operações verificam inscrição na edição marcada como atual, mas não comparam essa edição com `activity.eventId`. MySQL confirmou inscrição e check-in numa atividade de outra edição usando somente a inscrição na atual. A criação de inscrição anual também aceita qualquer evento existente e escreve seu ano em `User.currentEdition`, sem exigir que seja o atual/aberto.

**Correção:** validar o vínculo real atividade/edição e o estado de inscrição dentro da mesma fronteira transacional da escrita; definir operações administrativas para histórico separadamente. Aceite: usuário da edição A não entra na atividade B, inclusive durante cancelamento concorrente.

### AUD-07 — P1: agendador causa escrita parcial e notificações incorretas

**Local:** `src/services/activitiesService.ts:54`, `src/services/schedulerService.ts:12–82`, `src/index.ts:73`.

O schema permite data nula; a atividade é salva e só depois o agendador lança erro. Reproduzido: a operação persiste e responde como falha. A inicialização itera todas as atividades e também não trata esse caso. Há deslocamento fixo de três horas, expressão cron sem ano, jobs somente em memória, `stop()` sem `destroy()` e envio assíncrono sem `await`. A exclusão da atividade não cancela seus jobs. O efeito de fuso depende da configuração do host, mas a recorrência anual e a ausência de tratamento estão no código.

**Correção:** separar persistência e agendamento confiável, suportar atividade sem data, armazenar disparo único com data absoluta, remover jobs substituídos/excluídos e tratar falhas. Aceite: reinício, mudança/exclusão, horário passado, data nula e limite de ano não duplicam nem perdem lembretes.

### AUD-08 — P1: substituição/exclusão de imagem pode perder o arquivo válido

**Local:** `src/controllers/activityImageController.ts:67–69,153–170`, `src/config/upload.ts`.

A substituição destrói a imagem anterior antes de enviar/persistir a nova. Uma falha de upload foi reproduzida com o arquivo anterior já destruído. A exclusão destrói o arquivo antes da exclusão no banco; a criação faz upload antes de validar/persistir o vínculo e pode deixar órfãos. O filtro local verifica apenas o MIME declarado, não a assinatura binária. Não foi demonstrado upload malicioso no Cloudinary real.

**Correção:** validar conteúdo/vínculos primeiro, criar nova imagem, trocar referência no banco e só então remover a anterior com compensação/retry; armazenar `public_id`. Aceite: falhas em cada etapa não removem a última imagem válida e os órfãos são reconciliados.

### AUD-09 — P2: patrocinadores e tags continuam sujeitos a escritas parciais

**Local:** `src/services/sponsorService.ts:35–42`, `src/repositories/sponsorRepository.ts:44`, `src/repositories/tagsRepository.ts:40`.

Criar patrocinador persiste antes de vincular tags em `Promise.all`; uma tag inválida deixa o patrocinador criado e possivelmente parte dos vínculos. Reproduzido no serviço. Excluir patrocinador/tag remove os vínculos antes de excluir o registro principal, sem transação.

**Correção:** validação de IDs e transação/nested writes; manter formas das respostas. Aceite: rollback MySQL com falhas de FK e falha após desvincular.

### AUD-10 — P1: novo log de erro expõe token presente na URL

**Local:** `src/middlewares/errorHandler.ts:55–60`, `src/services/usersService.ts:138,201`.

O handler registra `req.originalUrl`; o reset usa `/updatePassword/:token`. Um erro inesperado nessa rota grava o token em log — reproduzido com marcador sintético. Essa linha foi introduzida pelo hardening `b7b02b3`: houve ganho na sanitização da resposta, mas uma regressão concreta de confidencialidade do log. Os objetos de erro completos do provedor de e-mail também exigem sanitização; não foi comprovado vazamento de chave real nesses objetos.

**Correção:** logar o padrão da rota e códigos permitidos, com redaction de URL/headers/corpos/erros externos. Aceite: erros de autenticação/reset/upload não deixam tokens, senhas, hashes ou chaves em logs capturados. Evitar mudar imediatamente o contrato de URL do app; redaction fica na API.

### AUD-11 — P1 condicional: bloqueio de versão interrompe confirmação via navegador

**Local:** `src/middlewares/appVersionMiddleware.ts:5–16`, `src/routes/index.ts:22`.

Quando `APP_VERSION_ENFORCEMENT_ENABLED=true`, uma requisição de confirmação de e-mail sem headers do app recebe 426 antes de chegar à rota. Reproduzido. Navegadores que abrem links de e-mail não enviam esses headers. O mesmo tratamento alcança o site que não identifica `x-app-platform`. Introduzido em `efbd3fd`, PR #10; é regressão condicionada à ativação. Header de plataforma é controlado pelo cliente e não deve ser tratado como controle de segurança.

**Correção:** isentar rotas públicas de confirmação e fluxos web necessários, definir escopo explícito da política e testar os links reais. Aceite: enforcement ativo mantém confirmação e recuperação web funcionais. Não ativar em produção antes disso.

### AUD-12 — P1: evento atual e estados duplicados não têm invariantes suficientes

**Local:** `src/repositories/eventRepository.ts:19–33`, `src/repositories/userEventRepository.ts:104–135`, `src/services/userEventService.ts`.

MySQL aceitou dois eventos atuais e a criação do segundo redefiniu o status dos **5.000 usuários** sintéticos. Cancelamento deixou `registrationStatus=1` e pontos existentes, embora os vínculos da edição fossem removidos. Isso já era problema funcional antes do patch transacional; a transação garante atomicidade das escritas escolhidas, não consistência de todos os campos derivados. A fila anual ainda usa leitura seguida de update incondicional e pode promover menos pessoas que o necessário em cancelamentos distintos concorrentes. Algumas operações de desativação/encerramento estão implementadas, mas não expostas pelas rotas atuais.

**Correção:** fonte única de estado ou sincronização transacional, unicidade da edição atual sob concorrência, reset limitado ao escopo aprovado e promoção serializada/condicional. Aceite: criação/cancelamento simultâneos preservam a edição, os status, pontos e fila. Reconciliar dados anteriores após definir a regra funcional.

## Desempenho, manutenção e cobertura

| ID | Prioridade | Evidência, efeito e ação recomendada |
| --- | --- | --- |
| AUD-13 | P2 | Rotas com `authMiddleware` e `adminMiddleware` validam JWT e buscam o usuário duas vezes; `/users/me` busca de novo após autenticar. `adminController.create` usa `hashSync`, bloqueando o event loop. Reutilizar identidade já autenticada e hash assíncrono; preservar consulta atualizada quando necessária. |
| AUD-14 | P2 | Ranking agrega usuários/presenças para cada chamada; resumo carrega todas as inscrições para contar em JS; listas/histórico não têm paginação. Broadcast carrega usuário completo duas vezes no fluxo. Medições abaixo. Usar projeções, contagem no banco e paginação opt-in/novas rotas sem quebrar listas existentes; medir índices compostos antes de migrar. |
| AUD-15 | P2 | `notificationService` trata tickets aceitos como `SENT`, não consulta receipts, não remove tokens inválidos, e os controllers retornam sucesso mesmo quando o serviço grava `FAILED`. Não há idempotência/durabilidade por destinatário; retentar pode duplicar. A [Expo distingue ticket de receipt](https://docs.expo.dev/push-notifications/sending-notifications/). Implementar processamento persistente e reconciliação; distinguir aceito de entregue sem mudar o significado silenciosamente. |
| AUD-16 | P2 condicional | `positiveInteger(...,1)` não permite `TRUST_PROXY_HOPS=0`; configuração padrão confia num hop e rate limit usa memória por instância. A [configuração de proxy precisa corresponder à topologia real](https://expressjs.com/en/guide/behind-proxies/). Acesso direto ou caminhos com menos hops podem permitir IP forjado; não comprovado online. Cotas por IP podem punir rede compartilhada; validar topologia e usar armazenamento compartilhado se houver réplicas. |
| AUD-17 | P2 | Validação runtime desigual em admin/perfil/patrocinadores/tags/notificações/presença. Tipos TypeScript não filtram JSON. Erros Prisma em controllers administrativos usam `res.status(error.statusCode)` quando não há status, e outros controllers retornam mensagens internas. Padronizar schemas e handler, sem atribuir indevidamente 500 a entrada inválida; testar contrato. Rotas de escrita administrativas têm autorização, portanto isso não é prova de escalada pública. |
| AUD-18 | P2 | CI agora cobre rollback, mas não executa `activity-capacity.integration.test.cjs`, build/render de templates ou testes de carga. O teste de capacidade opt-in não verifica prefixo do schema, ao contrário dos novos testes. Incluir no executor isolado com guarda e ampliar cenários de concorrência. A view engine aponta para `src/views` embora build copie para `dist/views`: deploy somente de `dist` pode falhar nas páginas EJS; criar smoke test desse artefato. |
| AUD-19 | P2 | Bull e `@types/bull` constam em dependências sem uso em `src`; trazem o alerta transitivo uuid [GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq). O alerta requer APIs/buffers específicos e não foi encontrado caminho executável pela API atual. Remover dependência sem uso após conferir scripts/integração; não aplicar downgrade major sugerido automaticamente pelo npm. |
| AUD-20 | P2 manutenção | `adminServices.ts` contém só imports/comentários; `createForAllUsers` é vazio; helpers duplicados/sem chamadores incluem `list`/`findAll`, busca de inscrição por par duplicada e exclusão por edição já movida para transação. `findActiveByEvent` no serviço e repositório usam critérios diferentes. Há DTOs/entities duplicados e imports redundantes. Remover código morto após mapear rotas/contratos; não transformar função vazia em sucesso funcional anunciado. |
| AUD-21 | P2 requisito | As listas administrativas retornam nomes e `presente`, mas `/checkIn/participants/:activityId` inclui ausentes e não retorna total explícito. É possível filtrar/contar no consumidor, mas isso não é uma consulta dedicada de presentes. Adicionar resumo administrativo `{totalPresentes, presentes:[{id,nome}]}` ou endpoint equivalente preservando os arrays existentes; paginar nomes com total estável. Testar palestra sem inscrição prévia, ausentes e não administrador. |
| AUD-22 | P2 operacional | Migrações deduplicam presenças e atribuem edição/categoria por heurísticas; aplicação em base vazia não comprova validade nos dados reais. Revisar amostra de legado e pontuação antes de migrar, especialmente atividades sem data/evento e nomes de minicurso fora das grafias previstas. Backup/ensaio em cópia sanitizada e relatório de reconciliação são pré-condições para produção. |

Outros pontos observados: login evita bcrypt para e-mail inexistente (diferença de tempo); recuperação pode distinguir conta existente quando o provedor falha; QR contém UUID estático e não é prova criptográfica de identidade; presença baseada em QR depende da conferência do operador. Rankings individual/top50 usam regras de empate diferentes (`COUNT+1` versus `ROW_NUMBER`) sem desempate final por ID. Não foram demonstrados ataques online por esses caminhos. Devem ser tratados nas revisões de autenticação, presença e ranking, respectivamente.

## Medições locais

MySQL 8.4.11, Node 24.13.0, Windows, Ryzen 5 5500U. Bases de 1.000/5.000 usuários com 5 vínculos por usuário (5.000/25.000 linhas), QR sintético de 4 KiB por usuário. Três aquecimentos, 20 amostras sequenciais por consulta. Mediana e p95 amostral; não são latência HTTP de produção, carga concorrente ou capacidade máxima. `jsonBytes` mede a serialização do resultado em memória, não bytes medidos no protocolo MySQL.

| Consulta | Mediana: 1.000 usuários | Mediana: 5.000 | p95: 5.000 | Resultado serializado: 5.000 |
| --- | ---: | ---: | ---: | ---: |
| Top 50 | 24,85 ms | 149,01 ms | 171,11 ms | 4.581 B |
| Ranking individual | 33,53 ms | 124,45 ms | 147,41 ms | 4 B |
| Resumo de inscrições | 15,27 ms | 68,69 ms | 113,06 ms | 65 B |
| Participantes com nomes | 44,90 ms | 188,64 ms | 261,13 ms | 1.800.391 B |
| Usuários completos para broadcast | 33,59 ms | 209,67 ms | 278,83 ms | 22.238.391 B |
| Comparação: somente ID/pushToken | 5,57 ms | 21,50 ms | 23,33 ms | 315.001 B |

A projeção reduziu o volume serializado em aproximadamente 70,6 vezes e a mediana dessa consulta em 9,8 vezes nesse ensaio. Isso não significa aceleração de 9,8 vezes no envio completo, que depende do provedor externo. A lista atual de participantes não expôs hashes no ensaio; a consulta completa de usuários é interna, mas carrega campos desnecessários e aumenta memória/risco de exposição acidental.

`SHOW INDEX` confirmou índice único `(userId, activityId)` e índice de FK em `activityId`. Não há índice composto com estado/ordem da fila; não se deve afirmar ausência de todo índice em `activityId`. A decisão sobre novos índices precisa de EXPLAIN e distribuição real, especialmente porque o ranking global ainda agrega todas as linhas.

## O que as branches fizeram

O [registro de origem](evidencias/audit-code-origins-2026-09-28.json) traz linhas, último commit que as tocou e histórico por conteúdo. `blame` não prova autoria inicial: commits de formatação e refatoração aparecem como último toque. A tabela abaixo associa os grupos históricos aos fluxos atuais examinados; não atribui cada problema exclusivamente ao último nome de branch que o contém.

| Branches/grupo do inventário | Resultado da revisão |
| --- | --- |
| `codex/fix-p0-release-blockers` | Proteções reais de privilégio, identidade mínima, autorização, unicidade/capacidade e hash administrativo. A política de versão introduziu AUD-11; o vínculo da atividade foi adicionado, mas a autorização ainda não o usa em AUD-06. |
| `codex/api-hardening-p1` | Validação, limites, respostas sanitizadas e CI são ganhos; `b7b02b3` introduziu o log de URL de AUD-10. O limite em caracteres de AUD-04 é proteção incompleta, não uma solução do limite bcrypt. |
| `codex/p1-write-integrity` | Transações corrigem rollback de evento/criação de inscrição. Estados duplicados/reset global de AUD-12 foram preservados, não inventados pela transação. |
| `codex/p1-registration-cancellation` (nova) | Corrige atomicidade e acrescenta CI MySQL; não resolve pontos/status/fila concorrente de AUD-05/AUD-12. Sem alteração do contrato HTTP. |
| `feature/add-blob-image-logic` | Experimento incompatível com URLs e com migração destrutiva; arquivado sem merge. |
| `feature/add-image-logic` | Upload funciona, mas substituição/exclusão têm AUD-08. |
| `feature/add-point-system`, `feature/implement-scoring-system` | Pontuação existe, mas integridade e concorrência de AUD-05 permanecem. |
| `feature/add-user-ranking` | Ranking existe; custo global, regras de empate e volume devem ser revistos (AUD-14). Projeções posteriores melhoraram privacidade. |
| `feature/notification-system`, `fix-notification-api`, `hotfix/notifications-system`, `feature/scheduler-notification` | Funcionalidades implementadas com problemas de durabilidade, resultado, agendamento e memória (AUD-07/AUD-14/AUD-15). |
| `feat-add-qrcode-logic`, `feature/read-qrcode-logic`, `feat-implement-event-registration-and-attendance-tracking-for-Secomp-(issue-#21)` | Presença/inscrição/QR disponíveis; verificar AUD-05/AUD-06/AUD-12/AUD-21 e identidade na leitura do QR. |
| `feat/crud-sponsors`, `feature/sponsors-api` | CRUD e vínculos existem, mas não têm atomicidade completa (AUD-09) nem validação uniforme (AUD-17). |
| `feature/update-user-profile`, `feature/user-activity-count`, `feature/user-details-endpoint` | Recursos presentes; troca de e-mail tem AUD-03 e consultas/código redundante estão em AUD-13/AUD-20. |
| `Issue-in-the-password-recovery-flow-–-link-redirection`, `feature/refactor-password-recovery-function` | Link/fluxo de recuperação evoluiu, mas reset continua reutilizável e sem revogação (AUD-02); confirmação/configuração em AUD-01. |
| `fix/add-error-codes`, `fix/fixed-signup`, `fix/fixed-updateActivity` | Correções locais não garantem uniformidade de erro/validação; persistem AUD-07/AUD-17 e falhas parciais do cadastro em geração de QR/e-mail. |
| `refactor/secomp-xiv` | Agrega boa parte do histórico e adequação XIV; melhorias de e-mail/URLs/privacidade não equivalem a resolver todas as falhas herdadas. |

Recomendação: manter os ganhos de P0/P1 e corrigir os achados pontualmente. Reverter branches inteiras traria de volta exposições e falhas já corrigidas. As 26 referências antigas foram encerradas conforme a [auditoria de branches](branch-audit-2026-09-28.md), com SHAs preservados; isso não eliminou o código integrado.

## Sequência de correção e aceite

1. Segredos e autenticação: AUD-01/02/03/04/10/11; testes de replay, revogação, troca de e-mail, Unicode e links web. Correções de API/configuração primeiro.
2. Integridade de inscrição/presença: AUD-05/06/12; testes MySQL de falha e concorrência, regra de edição e reconciliação de pontos/status. Incluir AUD-21 para nomes e total sem exigir APK novo.
3. Agendador/upload e demais transações: AUD-07/08/09/15; falhas de provedores simuladas, entrega idempotente e persistência de agendamento.
4. Eficiência/limpeza/CI: AUD-13/14/16–20/22; projeções primeiro, limites/paginação compatíveis, ensaio de carga e migrações em cópia sanitizada.

Os achados desta revisão **não foram corrigidos automaticamente**. As mudanças executáveis de produção desta rodada continuam sendo as do cancelamento e sua CI. Os scripts de auditoria, métricas e este relatório tornam o restante verificável e priorizado. Deploy, migrações de produção e comportamento das rotas publicadas permanecem não confirmados.
