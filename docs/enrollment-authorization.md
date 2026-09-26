# Autorização de inscrições e check-in — item 3

As rotas autenticadas aplicam as seguintes regras:

| Operação | Participante | Administrador |
| --- | --- | --- |
| Consultar inscrição ou atividades por `userId` | Somente o próprio `userId` | Qualquer usuário |
| Criar inscrição em atividade | Sempre para o usuário do token; `userId` do corpo é ignorado | Sempre para o usuário do token |
| Remover inscrição em atividade | Somente a própria | Qualquer usuário |
| Listar inscritos de uma atividade | Bloqueado | Permitido |
| Alterar presença, lista de espera ou inscrição prévia | Bloqueado | Permitido |
| Fazer check-in e listar participantes | Bloqueado | Permitido |
| Consultar inscrições no evento anual | Somente as próprias | Qualquer usuário |

Uma tentativa autenticada de acessar outro usuário retorna `403`. Token ausente, inválido ou expirado continua retornando `401`. A remoção da inscrição no evento anual já usa o usuário do token no serviço e permanece protegida por essa verificação.

Os testes HTTP executam as rotas com papéis `USER` e `ADMIN`, verificam que controladores não são chamados após uma negação e confirmam que o `userId` enviado no corpo da inscrição não substitui a identidade do token.
