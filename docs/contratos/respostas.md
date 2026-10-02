# Respostas e permissões

Última revisão: 01/10/2026. Contratos da base `main` `ac045eb`; produção desse código não confirmada. [Roadmap](../roadmap.md).

| Contexto | Campos de usuário |
| --- | --- |
| Login e perfil próprio | `id`, `nome`, `email`, `tipo`, `createdAt`, `updatedAt`, `confirmed`, `registrationStatus`, `currentEdition`, `points`, `qrCode` |
| Administração | Os mesmos, sem `qrCode` |
| Ranking | `id`, `nome`, `points`, `rank` |
| Participantes | Identidade limitada a `id` e `nome` |

Hashes, tokens push, versões e créditos internos não entram automaticamente nas respostas. História de notificações retorna os campos públicos e identidade do remetente; não retorna destinatários nem erros internos. Evidência: [projeções](../../src/dtos/userResponses.ts), [testes de exposição](../../tests/user-data-exposure.test.cjs), [relato original](../historico/correcoes/user-response-contracts.md).

Participante acessa suas inscrições; ADMIN tem as permissões administrativas das rotas. Cadastro público cria somente USER. Token inválido/ausente retorna 401; acesso autenticado indevido retorna 403. Ver [autorização](../historico/correcoes/enrollment-authorization.md) e [testes de cadastro](../../tests/signup.test.cjs).

Consulta de presentes é aditiva, retorna `totalPresentes` e `presentes` com `userId`/`nome`. A listagem anterior mantém o array. Ver [presença](../funcionalidades/presenca.md).

## Troca de e-mail integrada pelo PR #22

O perfil mantém a mesma projeção pública, mas `email` passa a representar o endereço ativo enquanto o novo aguarda confirmação. Edição administrativa conserva 201. A mudança semântica e o novo login da conta após confirmação estão documentados em [contas](../funcionalidades/contas.md); não exigem novos campos obrigatórios ou APK.

Paginação e mudanças de listas devem preservar clientes existentes e ter medição/contrato explícitos antes da implementação. Permanecem pendentes no roadmap.
