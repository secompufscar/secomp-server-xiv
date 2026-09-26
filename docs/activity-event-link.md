# Vínculo entre atividades e edições — item 7

Cada atividade passa a possuir `eventId`, relacionando sua agenda e suas inscrições a uma edição específica da SECOMP.

Na criação, o administrador pode informar `eventId`. Quando o campo é omitido, a API associa a atividade ao evento marcado como atual. A criação é recusada se não houver evento explícito válido nem evento atual. Uma atividade legada sem vínculo também recebe o evento atual na próxima edição.

Ao cancelar a inscrição no evento anual, a API remove somente os registros `UserAtActivity` cujas atividades pertencem à edição cancelada. Inscrições e presenças históricas de outras edições permanecem preservadas.

## Migração

A migração `20260922140000_link_activities_to_events` mantém `eventId` temporariamente opcional para não rejeitar bases históricas incompletas. O preenchimento segue esta ordem:

1. evento cujo intervalo contém a data da atividade;
2. evento atual mais recente;
3. `null` quando não existe associação segura.

Novas atividades sempre recebem um evento pela camada de serviço. O índice em `eventId` suporta filtros por edição e a chave estrangeira impede referências inválidas.

## Compatibilidade

As respostas de atividade passam a incluir `eventId`. O campo é opcional na criação e atualização para preservar os clientes atuais. Cancelar uma edição deixa de apagar toda a agenda histórica do participante.
