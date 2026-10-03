# Publicação de produção — 03/10/2026

Esta rodada confirma a publicação da API e os fluxos explicitamente verificados abaixo. Não equivale a uma validação funcional de todas as rotas.

## Código e deployment

Esta seção registra a primeira publicação do dia. A atualização de atividades foi publicada depois, conforme a seção abaixo.

- Commit publicado: [`e2080ac858fe1af9e897581738c638bd45de0a08`](https://github.com/secompufscar/secomp-server-xiv/commit/e2080ac858fe1af9e897581738c638bd45de0a08), que incorpora o [PR #25](https://github.com/secompufscar/secomp-server-xiv/pull/25). Checkout limpo e pull realizado antes do upload.
- CI desse commit aprovada: [testes e TypeScript](https://github.com/secompufscar/secomp-server-xiv/actions/runs/37130505067/job/111224491928) e [integridade/rollback MySQL](https://github.com/secompufscar/secomp-server-xiv/actions/runs/37130505067/job/111224492037).
- Ambiente `production`, serviço `secomp-server-xiv`: [deployment `554f6864-2f73-4790-8a23-de03eba45550`](https://railway.com/project/531e115f-bfd5-48ad-a87e-af3807c63129/service/42f9f330-bcec-4077-a343-b8cc73553dc1?id=554f6864-2f73-4790-8a23-de03eba45550), via CLI, estado `SUCCESS`.
- API iniciada às **12:39:32 BRT**. O comando de início foi `npx prisma migrate deploy && npm start`.
- Consulta dentro desse deployment confirmou pacote XIV e hashes correspondentes ao commit para nove arquivos centrais: manifestos, entrada da API, configuração HTTP/segredos, autenticação/sessões e schema Prisma. Essa comparação não cobre todos os arquivos do container.

## Backup, ensaio e migrações

Backup imediatamente anterior ao deploy restaurado em banco local isolado e migrações ensaiadas no mesmo commit. SHA-256 do arquivo: `3F55EEDEC374A6CF68259560AB3A6A9AFB10AAD1ADF6E5A2355F8F5F10EFFFED`. O backup e os relatórios locais não foram versionados nem enviados ao Railway.

A origem era MySQL **9.7.2**, e o ensaio usou **8.4.11**. O ensaio confirmou preservação dos campos originais, deduplicação prevista, inicialização sem revogação coletiva e ausência de recálculo histórico. A diferença de versão limita o ensaio; a execução real foi conferida separadamente em produção.

Os logs de produção registram as **nove migrações pendentes** aplicadas com sucesso. O ledger passou de três para **12 migrações**, sem pendências no `prisma migrate status`.

| Conferência agregada | Antes | Depois |
| --- | ---: | ---: |
| Contas | 247 | 247 |
| Atividades | 39 | 39 |
| Inscrições em atividades | 387 | 386 |
| Inscrições na edição | 187 | 187 |
| Grupos de inscrição duplicada | 1 | 0 |
| Edições atuais | 1 | 1 |

A duplicata era do par participante/atividade, não de contas. A migração retirou uma inscrição redundante; a preservação do registro com presença foi verificada no ensaio. Em produção, atividades sem edição ficaram em zero e nenhuma versão de autenticação foi incrementada na conferência.

A produção não recebeu restauração, seed ou cópia do banco local. As alterações de banco feitas pelo procedimento foram as migrações; o pós-deploy utilizou consultas de leitura. Operações normais dos usuários, como criação de sessão no login, continuam podendo escrever no banco.

## Compatibilidade e rotas verificadas

- Chaves antigas preservadas; chaves fortes adicionais configuradas. Validação da configuração passou no container. Tokens sintéticos antigos e novos foram aceitos para acesso, recuperação e confirmação, em memória e sem escrita no banco. Isso não substitui testar links reais.
- Conexão da API com o MySQL usa domínio interno. Exigência de versão permanece desativada: respostas para web e Android informam `forceUpdate: false` e `enforcementEnabled: false`.
- `GET /api/v1/health/live`, `/health/ready`, `/event/current` e `/activities/` responderam **200**. O teste de prontidão também foi repetido após a consulta dos logs.
- Preflight de login respondeu **204**, com `Access-Control-Allow-Origin: https://secomp-app-xiv.vercel.app`, credenciais permitidas e os cabeçalhos solicitados no teste.
- O responsável confirmou **login com conta existente em aba privada no iOS**, pelo domínio público do app. Os logs HTTP registram `POST /api/v1/users/login` **200** às **12:41:25 BRT**, em **93 ms**, e outro **200** às **13:06:21 BRT**, em **108 ms**. O dispositivo foi confirmado pelo responsável, não inferido desses logs.

## Rotas web e recuperação de senha

O [PR #9 do app](https://github.com/secompufscar/secomp-app-xiv/pull/9) foi mergeado no commit `6d6cc1c2b2f4f033e3287e2936608d7217c824eb` em 03/10, às **14:22:09 BRT**. A correção adiciona a regra geral de hospedagem `/:path*` para servir o documento da SPA sem mudar o caminho ou a query. Configuração e validação local estão no [guia do app](https://github.com/secompufscar/secomp-app-xiv/blob/6d6cc1c2b2f4f033e3287e2936608d7217c824eb/docs/web-routing.md).

Após o merge, consultas de leitura no domínio público `https://secomp-app-xiv.vercel.app` confirmaram **200** e o documento do app na raiz, em `/SetNewPassword?token=diagnostic-invalid-token` e em `/App/Home`, sem redirecionamento para login da Vercel. Isso confirma a publicação da correção do 404 da hospedagem. A regra é geral para os caminhos web; não cria telas, parâmetros ou permissões novos no frontend.

Antes do merge, CI e build do preview da Vercel passaram. No navegador local, o formulário abriu por link direto e recarregou, preservando o token fictício; a chamada de atualização foi interceptada e os arquivos estáticos foram preservados. O preview exigiu autenticação na Vercel; respostas 200 da página de login não foram consideradas evidência do app.

Os novos links de recuperação expiram em **uma hora a partir da geração**, conforme [`expiresIn: "1h"`](../../../src/services/usersService.ts). Concluir a recuperação invalida os links da versão anterior da conta, mesmo antes do prazo; apenas solicitar um link não altera senha ou sessões. Links já enviados mantêm o mesmo endereço e podem funcionar após a correção se ainda válidos.

A leitura das páginas públicas utilizou somente token fictício. **Troca efetiva de senha e login com a nova senha em produção ainda não foram confirmados**. Nenhuma conta foi redefinida por este procedimento.

## Atualização de atividades e editor administrativo

O [PR #27 da API](https://github.com/secompufscar/secomp-server-xiv/pull/27) foi integrado antes do upload do commit `e4ccb682d7efb28bbb282467095094de16b7926f`. O [deployment `0d0e0710-bd22-4d8b-a285-6829d2ef2b01`](https://railway.com/project/531e115f-bfd5-48ad-a87e-af3807c63129/service/42f9f330-bcec-4077-a343-b8cc73553dc1?id=0d0e0710-bd22-4d8b-a285-6829d2ef2b01), criado às 16:03:49 BRT, terminou em `SUCCESS`. A API não iniciou publicação automática com o merge; o upload foi feito pela CLI a partir do checkout limpo do commit integrado.

O backup anterior a essa atualização foi obtido pela conexão privada, dentro do serviço MySQL, sem mudar a exposição da rede. SHA-256: `9a067f3f167ba1304c432887eef87eabf53ac681c5e146daaa257464c09c6d6f`. A restauração e o ensaio em banco local isolado preservaram os dados originais: 250 contas, 39 atividades, 423 inscrições em atividades, 191 inscrições na edição e 16 sessões de refresh. O ledger do ensaio passou de 12 para 13 migrações. Nenhum backup, dado pessoal ou relatório privado foi enviado ao GitHub ou ao deployment.

A conferência privada posterior ao deploy confirmou a migração `20261003180000_activity_speaker_title` concluída, `detalhes` com limite 1.000, o enum de apresentação e `localLink` com limite 2.048. Os dois repositórios compilados responsáveis por capacidade/fila e resumo de inscrições corresponderam ao build do commit publicado após normalizar finais de linha. Essa comparação cobre esses dois arquivos, não todo o container. A listagem pública respondeu 200 com as 39 atividades e os novos campos.

O [PR #10 do app](https://github.com/secompufscar/secomp-app-xiv/pull/10) foi integrado em `69498d8fbe81db7d08a895d97cb3a978758e2789`. A publicação automática GitHub → Vercel terminou com sucesso. O bundle do domínio público contém o editor, descrição de 1.000 caracteres, seleção de apresentação, foto e aviso de mínimo de vagas.

O [guia de atividades](../../funcionalidades/apresentacao-atividade.md) descreve a edição exclusiva de admins na web, a fila reversível e o mínimo de presenças. CI, ensaio MySQL e navegador com dados fictícios verificaram os contratos, falhas, promoção/demissão da fila, rollback e bloqueio prévio de capacidade abaixo das presenças. Não foram feitas edições nem uploads de atividade em produção para validar o fluxo completo; a leitura dos campos públicos não comprova essas escritas online.

## Descrição de 1.500 caracteres e recorte de foto

O [PR #28 da API](https://github.com/secompufscar/secomp-server-xiv/pull/28) foi integrado em `633e8c8fa9922b27a0b4d688199ca924c31bda19` antes da publicação. O [deployment `0c148d97-0b0f-4f55-8e0f-41baf265fe24`](https://railway.com/project/531e115f-bfd5-48ad-a87e-af3807c63129/service/42f9f330-bcec-4077-a343-b8cc73553dc1?id=0c148d97-0b0f-4f55-8e0f-41baf265fe24), criado às 16:52:43 BRT, terminou em `SUCCESS`.

Novo backup privado anterior ao deploy, SHA-256 `e38dbb1bd1fd2f0d4c818f6a5322f18880fa423793c929ce83eb43d492b89a47`, foi restaurado em banco local isolado. O ensaio preservou todos os campos originais das 251 contas, 39 atividades, 423 inscrições em atividades, 192 inscrições na edição e 20 sessões de refresh. A migração posterior amplia a coluna, sem modificar a migração já aplicada de 1.000 caracteres; o ensaio passou de 13 para 14 migrações. O pós-deploy privado confirmou a nova migração concluída, limite 1.500 no banco e código de validação correspondente ao commit publicado (finais de linha normalizados).

O [PR #11 do app](https://github.com/secompufscar/secomp-app-xiv/pull/11) amplia formulário e contador para 1.500, ajusta margens e opções de apresentação por largura e acrescenta recorte com prévia circular, zoom e arraste. No navegador com dados fictícios foram verificados 320, 375, 420, 768 e 1.280 px, além de 768×360, sem overflow horizontal e com ações visíveis. O teste confirmou gravação de 1.500 caracteres e um único upload PNG 512×512 somente após Salvar; cancelar o recorte preservou a foto anterior. Nenhuma atividade real foi editada nesses testes.

## Logs da primeira publicação e limites da observação

Recorte HTTP de **12:40:13 a 13:06:26 BRT**: **46 requisições**, com 16 respostas 200, 15 respostas 204, 11 respostas 304, duas 401 e duas 404. Nenhuma 5xx nem erro de upstream informado nesse recorte.

As duas 404 ocorreram no login antes de uma tentativa bem-sucedida. O [serviço de login](../../../src/services/usersService.ts) retorna 404 para e-mail inexistente ou senha incorreta. Os logs não contêm o corpo da resposta e não permitem distinguir esses casos. Uma das 401 em `/users/me` foi a conferência proposital sem token; as demais respostas sem autorização não foram atribuídas a uma causa específica.

O recorte de fluxos de rede de **12:39:32 a 13:06:30 BRT** contém **202 registros**, sete com `dropCause: NO_SOCKET`. Todos esses sete são de entrada em portas temporárias: seis vindos da porta 3306 e um da 443. Nenhum desses avisos tem destino na porta da API 8080 ou na porta do banco 3306. Isso não elimina a possibilidade de interrupção de uma conexão com o banco: o aviso pode aparecer no caminho da resposta. A causa e o impacto desses avisos não foram confirmados; os logins e a prontidão observados passaram.

Logs de fluxo e logs HTTP têm escopos diferentes. A [referência oficial da CLI](https://docs.railway.com/cli/logs) descreve campos de protocolo, portas, direção e descarte nos fluxos, além dos registros HTTP. Contagens se referem aos recortes consultados, não a uma garantia de ausência de falhas futuras.

## Ainda não confirmado

- Renovação real em `/users/refresh` e logout no novo deployment: nenhuma chamada dessas rotas apareceu no recorte HTTP examinado.
- Cadastro/QR, conclusão da recuperação voluntária com login pela nova senha, confirmação/troca de e-mail, inscrição/fila/cancelamento e check-in com nomes/total em produção. A abertura HTTP do link de recuperação já foi confirmada; testes isolados/CI não comprovam os demais fluxos online.
- Carga representativa do eduroam, limites compartilhados e entregas externas.
- Causa do incidente antigo de login/CORS. A publicação atual funcionando não identifica, por si só, qual código/configuração estava no upload antigo via CLI.

Nenhuma exigência de novo APK, reset coletivo ou recálculo de pontos foi introduzida nesta publicação. Prioridades restantes estão no [roadmap](../../roadmap.md).
