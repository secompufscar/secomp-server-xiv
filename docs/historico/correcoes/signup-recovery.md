# Cadastro recuperável — 30/09/2026

Registro de implementação/auditoria preservado para rastreabilidade. O estado vigente está no [roadmap](../../roadmap.md).

Continuidade do achado A1 da [auditoria por blocos](../auditorias/functional-block-review-2026-09-29.md), na branch `codex/signup-recovery`, sobre a implementação do PR #19. Código implementado não comprova deploy.

## Comportamento e compatibilidade

- A API gera UUID, hash e QR antes de inserir a conta. Usuário e QR são gravados em uma única escrita; falha na geração não ocupa o e-mail.
- Falha ou timeout de envio da confirmação mantém a conta pendente e retorna o erro 500 existente. Não se exclui a conta: o provedor pode ter aceitado o e-mail antes do timeout, e o link deve continuar válido.
- Repetir o cadastro com e-mail e senha da conta USER ainda não confirmada retoma o envio. Conta antiga sem QR recebe um QR para o ID original. Nome, senha, privilégios, pontos e inscrições existentes não são substituídos.
- Conta confirmada, conta privilegiada ou senha incorreta continua recebendo o erro 400 de e-mail existente. Nenhum token de autenticação é emitido no cadastro.
- A constraint de e-mail resolve concorrência. Em conflito P2002, o serviço consulta novamente e aplica a mesma verificação de senha antes da retomada. Falhas de banco de outro tipo não são tratadas como duplicidade.
- A retomada trava a linha da conta em transação e revalida e-mail, hash, papel, confirmação e QR após o bcrypt. Comparações em JavaScript preservam igualdade exata do hash mesmo com collation MySQL sem distinção de maiúsculas. Conta alterada durante a verificação não recebe escrita da tentativa antiga.
- O envio só começa depois da gravação/reparação. Mantidos rota, corpo, HTTP 200 e resposta `{ message, emailEnviado: true }` no sucesso. As cotas de cadastro por identidade e rede continuam aplicadas, inclusive para retomadas.

Não há migração nova, alteração de origem CORS, reset obrigatório, invalidação geral de sessões ou necessidade de APK novo. As migrações e configurações das branches anteriores continuam sendo pré-requisitos da publicação conjunta.

## Validação

`tests/signup.test.cjs` cobre criação restrita a USER, falha de QR antes da escrita, timeout de e-mail sem exclusão, retomada sem sobrescrever nome, reparação de legado, recusa por senha/papel/confirmação, snapshot alterado e distinção entre conflito único e falha de banco.

`tests/signup-recovery.integration.test.cjs` usa MySQL local isolado, serviço/hash/QR reais e envio simulado. Cobre conta preservada após timeout, duas tentativas com a mesma senha, disputa com senhas diferentes, reparação de legado, mudanças concorrentes de campos e rollback com falha injetada após a atualização do QR. Incluído no runner isolado usado pela CI.

`npm run verify` final: 99 testes aprovados, sete integrações opt-in ignoradas na suíte padrão, zero falhas; build aprovado. As seis integrações MySQL do runner passaram localmente, com aplicação das 11 migrações anteriores. O banco temporário, o servidor auxiliar e seu diretório isolado foram removidos ao final. Uma primeira execução da suíte completa teve erro local de filesystem (`UNKNOWN/lstat` em arquivo de `qrcode`); o teste de recuperação de senha afetado passou isoladamente e a repetição completa passou sem alteração de dependências. CI é verificada separadamente no PR.

Os testes não enviam e-mails reais nem modificam contas de produção e não equivalem a validação do provedor ou das rotas publicadas.

## Limitações e continuidade

- Não há fila persistente nem retry automático de e-mail. O participante pode repetir o cadastro usando as credenciais originais; envio aceito não comprova entrega na caixa postal.
- Tentativas simultâneas válidas podem enviar mais de um e-mail para a mesma conta. As cotas existentes limitam solicitações, mas não oferecem entrega exatamente uma vez. Não se segura transação de banco durante a chamada ao provedor.
- Se o participante não lembra a senha da conta pendente, pode usar a recuperação voluntária existente e então retomar o cadastro. Não é exigido reset das contas já existentes.
- Não há reparação em massa de contas confirmadas antigas sem QR. Este fluxo trata cadastros novos e contas USER pendentes recuperadas voluntariamente.
- Troca de e-mail e vínculo da confirmação ao endereço são tratados na [continuidade posterior](verified-email-change.md), com tokens legados aceitos apenas na versão zero. Não faziam parte desta validação de cadastro.
- Antes do deploy, validar envio/confirmação com conta de teste e o cadastro web/iOS; confirmar migrações anteriores e configuração atual de segredos sem rotacioná-los automaticamente.
