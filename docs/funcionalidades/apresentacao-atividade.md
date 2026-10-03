# Apresentação e localização da atividade

`palestranteTitulo` registra a seleção única `APRESENTADOR` ou `APRESENTADORA`. É opcional nas requisições, para compatibilidade com clientes anteriores. A migração define `APRESENTADOR` para registros antigos; uma edição que omite o campo preserva a escolha salva.

`detalhes` aceita texto opcional ou `null` até 1.500 caracteres. O schema e a coluna MySQL usam o mesmo limite. `localLink` aceita HTTP/HTTPS até 2.048 caracteres, é opcional e pode ser removido com `null`. O campo `local` e a data/horário continuam usando o contrato existente; no app, editar apenas o horário preserva a data.

A migração já aplicada `20261003180000_activity_speaker_title` acrescenta seleção e link e amplia `detalhes` de 500 para 1.000. A migração posterior `20261003194000_activity_description_1500` amplia a coluna para 1.500 sem alterar o histórico aplicado nem remover dados. Aplicar ambas antes de publicar o formulário com o novo limite. As escritas seguem restritas a admins autenticados. A foto usa `activityImages` com `typeOfImage=palestrante`. A substituição conclui o upload e persiste a URL antes de remover a foto antiga. Falha de upload preserva a foto; falha de persistência limpa apenas o novo arquivo; falha ao limpar o antigo é registrada sem invalidar o salvamento.

Publicar a API antes do app web. Em 03/10/2026, um backup atualizado foi gerado dentro do MySQL da Railway via SSH/conexão privada e restaurado em MySQL local isolado. O ensaio confirmou preservação de todos os campos e registros anteriores, nova seleção, link e descrição de 1.000 caracteres. O arquivo SQL permanece privado, fora dos repositórios.

## Vagas e fila

`GET /userAtActivities/activity/:activityId/summary` inclui `presentCount`, um total agregado sem nomes, para o formulário mostrar o mínimo permitido antes do envio. Os demais campos do resumo permanecem compatíveis.

Quando a capacidade numérica muda, a atualização bloqueia a atividade e ajusta a fila na mesma transação. Os últimos inscritos confirmados sem presença passam para a espera quando há excesso. Havendo vagas, a fila é promovida por `createdAt ASC, id ASC`. Nenhuma inscrição é excluída, e a data original permanece, permitindo restaurar a ordem após aumento de capacidade. Pessoas com presença registrada permanecem confirmadas; uma redução abaixo desse total retorna 409 e reverte toda a edição. Capacidade omitida, inalterada ou indefinida não reorganiza a fila.

Testes em `tests/activity-speaker-profile.test.cjs`: seleção, compatibilidade, descrição, link e upload/persistência/limpeza. O teste MySQL integrado ao CI verifica redução, promoção em ordem, preservação de vínculo/presença/crédito, recusa de capacidade abaixo das presenças, rollback após falha de escrita e inscrição simultânea à mudança de capacidade.
