# Regra de inscrição prévia no check-in — item 6

Categorias agora possuem o campo explícito `requiresEnrollment`. O check-in consulta esse campo em vez de comparar o UUID da categoria com o valor inválido `"1"`.

| Categoria | Inscrição prévia | Registro de presença |
| --- | --- | --- |
| `requiresEnrollment: true` | Obrigatória; lista de espera não entra | Atualiza a inscrição existente para `presente: true` |
| `requiresEnrollment: false` | Dispensada | Cria ou atualiza `UserAtActivity` com `presente: true` |

Portanto, palestras abertas continuam registrando cada pessoa pelo nome e pelo identificador. A rota administrativa `GET /checkIn/participants/:activityId` devolve os registros com `presente` e a identidade mínima `user.id` e `user.nome`. O total de presentes é a quantidade de registros com `presente: true`.

A migração define `requiresEnrollment: true` para categorias existentes cujo nome normalizado seja `Minicurso` ou `Minicursos`. As demais começam como atividades abertas. Administradores podem alterar a regra ao criar ou editar uma categoria.

## Referência da regra

O guia do aplicativo da edição XII informa que apenas minicursos exigem inscrição pelo aplicativo e que palestras são abertas: [eventGuideScreen.tsx](https://github.com/secompufscar/secomp-app-xii/blob/main/src/screens/event/eventGuideScreen.tsx#L47-L85).
