# Respostas e permissões

Última revisão: 03/10/2026. Contratos da API publicada `3fa481f`, incluindo os PRs #27, #28 e #31. Deploy e leituras públicas conferidos; os demais fluxos online têm evidências e limites próprios na [publicação de 03/10](../historico/auditorias/production-deployment-2026-10-03.md) e na [investigação de conexão](../historico/auditorias/login-database-connection-2026-10-03.md). [Roadmap](../roadmap.md).

| Contexto | Campos de usuário |
| --- | --- |
| Login e perfil próprio | `id`, `nome`, `email`, `tipo`, `createdAt`, `updatedAt`, `confirmed`, `registrationStatus`, `currentEdition`, `points`, `qrCode` |
| Administração | Os mesmos, sem `qrCode` |
| Ranking | `id`, `nome`, `points`, `rank` |
| Participantes | Identidade limitada a `id` e `nome` |

Hashes, tokens push, versões e créditos internos não entram automaticamente nas respostas. História de notificações retorna os campos públicos e identidade do remetente; não retorna destinatários nem erros internos. Evidência: [projeções](../../src/dtos/userResponses.ts), [testes de exposição](../../tests/user-data-exposure.test.cjs), [relato original](../historico/correcoes/user-response-contracts.md).

Participante acessa suas inscrições; ADMIN tem as permissões administrativas das rotas. Cadastro público cria somente USER. `authMiddleware` retorna 401 para token inválido/ausente; `isAdmin` e `authorizeSelfOrAdmin` retornam 403 para acesso autenticado indevido. As rotas que usam o `adminMiddleware` legado retornam 401 também para perfil sem permissão administrativa. Ver [autorização](../historico/correcoes/enrollment-authorization.md) e [testes de cadastro](../../tests/signup.test.cjs).

Consulta de presentes é aditiva, retorna `totalPresentes` e `presentes` com `userId`/`nome`. A listagem anterior mantém o array. Ver [presença](../funcionalidades/presenca.md).

O resumo autenticado de atividade retorna `occupiedCount`, `presentCount`, `waitlistCount` e `waitlistPosition`, sem identidades de outros participantes. `presentCount` permite mostrar o mínimo de vagas no formulário administrativo. Atividades acrescentam `palestranteTitulo` e `localLink`; ambos são opcionais nas escritas para preservar clientes anteriores. Descrição aceita até 1.500 caracteres. Ver [atividades](../funcionalidades/apresentacao-atividade.md).

## Troca de e-mail integrada pelo PR #22

O perfil mantém a mesma projeção pública, mas `email` passa a representar o endereço ativo enquanto o novo aguarda confirmação. Edição administrativa conserva 201. A mudança semântica e o novo login da conta após confirmação estão documentados em [contas](../funcionalidades/contas.md); não exigem novos campos obrigatórios ou APK.

Paginação e mudanças de listas devem preservar clientes existentes e ter medição/contrato explícitos antes da implementação. Permanecem pendentes no roadmap.

## Indisponibilidade do banco

Falhas de conexão reconhecidas que chegam ao handler, inclusive pela autenticação de usuário/admin, retornam 503 com `message`, `errorCode: "DATABASE_UNAVAILABLE"`, `errors: []`, `requestId` e cabeçalho `Retry-After: 1`. Não retornam código Prisma ou mensagem interna. Isso não representa senha inválida nem token expirado. Recuperação e escopo das leituras estão no [diagnóstico](../operacao/diagnostico.md#conexão-intermitente-com-o-banco); não há repetição automática de escrita/commit incerto.
