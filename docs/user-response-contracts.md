# Correção de exposição de dados — item 2

As respostas de usuários usam uma lista explícita de campos permitidos. Campos novos na entidade não entram automaticamente nos perfis.

| Contexto | Campos de usuário retornados |
| --- | --- |
| Login e perfil próprio (incluindo edição e registro de push) | `id`, `nome`, `email`, `tipo`, `createdAt`, `updatedAt`, `confirmed`, `registrationStatus`, `currentEdition`, `points`, `qrCode` |
| Administração: detalhe, criação, edição e exclusão | Mesmos campos do perfil, sem `qrCode` |
| Ranking | `id`, `nome`, `points`, `rank` |
| Participantes de atividades, check-in e eventos | Relação `user` limitada a `id` e `nome` |
| Histórico de notificações | `id`, `title`, `message`, `data`, `status`, `sentAt` e `sender` com `id` e `nome` (ou `null`) |

Hashes de senha e tokens push ficam restritos aos fluxos internos. O histórico não retorna a lista de destinatários nem erros internos de envio. O campo `data` continua sendo o conteúdo da notificação; quem produz notificações deve enviar somente dados destinados aos respectivos usuários.

## Compatibilidade

- `GET /userEvent/event/:eventId` passa a exigir autenticação e papel `ADMIN`: 401 sem autenticação válida, 403 para participantes.
- Clientes que utilizavam campos removidos do ranking, dos participantes ou do histórico precisam adaptar suas telas. O QR do próprio usuário continua disponível para check-in.
- Nenhuma migração de banco é necessária. A ordenação do ranking permanece por pontos, presenças e data de criação.

## Validação e limite do escopo

`npm test` verifica perfis, login, respostas administrativas, seleção SQL do ranking, projeções de participantes e notificações e a autorização HTTP da listagem por evento. Banco, e-mail e serviços externos não são utilizados pelos testes. O servidor HTTP de teste usa uma porta temporária e é encerrado ao concluir.

Esta correção trata os retornos de dados. As permissões de alteração de inscrições/check-in (item 3) e a gravação de senha na edição administrativa (item 4) continuam pendentes e devem ser corrigidas nas próximas etapas.
