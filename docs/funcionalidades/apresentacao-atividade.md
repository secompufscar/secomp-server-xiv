# Apresentação e localização da atividade

`palestranteTitulo` registra a seleção única `APRESENTADOR` ou `APRESENTADORA`. É opcional nas requisições, para compatibilidade com clientes anteriores. A migração define `APRESENTADOR` para registros antigos; uma edição que omite o campo preserva a escolha salva.

`detalhes` aceita texto opcional ou `null` até 1.000 caracteres. O schema e a coluna MySQL usam o mesmo limite. `localLink` aceita HTTP/HTTPS até 2.048 caracteres, é opcional e pode ser removido com `null`. O campo `local` e a data/horário continuam usando o contrato existente; no app, editar apenas o horário preserva a data.

A migração `20261003180000_activity_speaker_title` acrescenta seleção e link e amplia `detalhes` de 500 para 1.000. As escritas seguem restritas a admins autenticados. A foto usa `activityImages` com `typeOfImage=palestrante`. A substituição conclui o upload e persiste a URL antes de remover a foto antiga. Falha de upload preserva a foto; falha de persistência limpa apenas o novo arquivo; falha ao limpar o antigo é registrada sem invalidar o salvamento.

Publicar a API antes do app web. Em 03/10/2026, um backup atualizado foi gerado dentro do MySQL da Railway via SSH/conexão privada e restaurado em MySQL local isolado. O ensaio confirmou preservação de todos os campos e registros anteriores, nova seleção, link e descrição de 1.000 caracteres. O arquivo SQL permanece privado, fora dos repositórios.

Testes em `tests/activity-speaker-profile.test.cjs`: seleção, compatibilidade, descrição, link e upload/persistência/limpeza em sucesso e falha.
