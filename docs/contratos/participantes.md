# Lista geral administrativa

`GET /api/v1/users/directory` exige conta autenticada, confirmada e ADMIN. Inclui todas as contas cadastradas, inclusive quem não tem inscrição na edição ou credenciamento. A presença no credenciamento da **edição atual** define o status; inscrições sem presença e credenciamentos de edições passadas não o tornam verde.

Filtros: `q` (nome/e-mail, até 120 caracteres), `credentialed=all|yes|no`, `page` (a partir de 1). A resposta traz `users` com somente `id`, `nome`, `email`, `credentialed` e `credentialedAt`; também `event`, `activityId`, `page`, `pageSize` (50), `total`, `credentialedCount` e `notCredentialedCount`. As contagens de status respeitam a busca, antes do filtro de status. Consulta e contagens usam a mesma transação. Ausência ou ambiguidade da edição/atividade de credenciamento retorna 409, nunca um falso status vermelho.

`checkedInAt` registra o instante real da transição para presença, tanto pelo leitor como pela atualização administrativa. A transação mantém presença, horário e pontos juntos; repetir presença sem transição preserva a data. Desmarcar presença limpa o horário; excluir o vínculo elimina o credenciamento, sem excluir a conta. O app mostra esse timestamp em São Paulo, separado do horário programado da atividade.

A migração recupera `createdAt` apenas de check-ins diretos com presença, sem inscrição prévia e cujos timestamps diferem no máximo um segundo (variação de relógios na mesma inserção). Para os demais registros antigos, `credentialedAt` permanece nulo: o credenciamento é confirmado, mas o instante exato é desconhecido. Não se usa data da inscrição nem última alteração como data de credenciamento.
