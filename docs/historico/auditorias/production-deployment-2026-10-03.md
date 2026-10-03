# Publicação de produção — 03/10/2026

Esta rodada confirma a publicação da API e os fluxos explicitamente verificados abaixo. Não equivale a uma validação funcional de todas as rotas.

## Código e deployment

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

## Logs e limites da observação

Recorte HTTP de **12:40:13 a 13:06:26 BRT**: **46 requisições**, com 16 respostas 200, 15 respostas 204, 11 respostas 304, duas 401 e duas 404. Nenhuma 5xx nem erro de upstream informado nesse recorte.

As duas 404 ocorreram no login antes de uma tentativa bem-sucedida. O [serviço de login](../../../src/services/usersService.ts) retorna 404 para e-mail inexistente ou senha incorreta. Os logs não contêm o corpo da resposta e não permitem distinguir esses casos. Uma das 401 em `/users/me` foi a conferência proposital sem token; as demais respostas sem autorização não foram atribuídas a uma causa específica.

O recorte de fluxos de rede de **12:39:32 a 13:06:30 BRT** contém **202 registros**, sete com `dropCause: NO_SOCKET`. Todos esses sete são de entrada em portas temporárias: seis vindos da porta 3306 e um da 443. Nenhum desses avisos tem destino na porta da API 8080 ou na porta do banco 3306. Isso não elimina a possibilidade de interrupção de uma conexão com o banco: o aviso pode aparecer no caminho da resposta. A causa e o impacto desses avisos não foram confirmados; os logins e a prontidão observados passaram.

Logs de fluxo e logs HTTP têm escopos diferentes. A [referência oficial da CLI](https://docs.railway.com/cli/logs) descreve campos de protocolo, portas, direção e descarte nos fluxos, além dos registros HTTP. Contagens se referem aos recortes consultados, não a uma garantia de ausência de falhas futuras.

## Ainda não confirmado

- Renovação real em `/users/refresh` e logout no novo deployment: nenhuma chamada dessas rotas apareceu no recorte HTTP examinado.
- Cadastro/QR, recuperação voluntária, confirmação/troca de e-mail, inscrição/fila/cancelamento e check-in com nomes/total em produção. Testes isolados/CI não comprovam esses fluxos online.
- Carga representativa do eduroam, limites compartilhados e entregas externas.
- Causa do incidente antigo de login/CORS. A publicação atual funcionando não identifica, por si só, qual código/configuração estava no upload antigo via CLI.

Nenhuma exigência de novo APK, reset coletivo ou recálculo de pontos foi introduzida nesta publicação. Prioridades restantes estão no [roadmap](../../roadmap.md).
