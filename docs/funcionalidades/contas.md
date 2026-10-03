# Contas

Última revisão: 03/10/2026. Escopo: comportamento integrado dos PRs #22 e #25, preservado na API atual `633e8c8`. Login web/iOS com conta existente confirmado na rodada anterior `e2080ac`; os demais fluxos funcionais permanecem pendentes conforme a [evidência de produção](../historico/auditorias/production-deployment-2026-10-03.md). [Prioridades e estados](../roadmap.md).

## Cadastro e login no main

Cadastro público aceita nome, e-mail e senha, cria apenas USER e ignora privilégios/campos internos enviados pelo cliente. UUID, hash e QR são preparados antes da inserção única. Falha de QR não ocupa o e-mail; timeout de confirmação mantém a conta pendente. Repetir o cadastro com a senha original retoma apenas USER não confirmado, sem substituir nome, senha, pontos ou inscrições.

Login exige confirmação do e-mail e senha correta. Clientes legados mantêm token de acesso; o fluxo com refresh é opt-in pelo contrato existente. Perfil próprio mantém o QR; hashes, versões internas e tokens push não entram nas respostas.

Recuperação é voluntária. Os novos links expiram em **uma hora a partir da geração**, conforme `expiresIn: "1h"` no [serviço de contas](../../src/services/usersService.ts). Solicitar o link não muda senha ou sessões; concluir a recuperação grava senha, versão de autenticação e revogação em transação. Um link antigo não pode ser reutilizado após a troca. Tokens legados de versão zero continuam aceitos conforme regras e expiração até a recuperação da própria conta. Nenhum reset coletivo é exigido.

Evidências: [cadastro](../../tests/signup.test.cjs), [cadastro MySQL](../../tests/signup-recovery.integration.test.cjs), [recuperação](../../tests/password-recovery.test.cjs), [recuperação MySQL](../../tests/password-recovery.integration.test.cjs). Relatos: [cadastro recuperável](../historico/correcoes/signup-recovery.md), [recuperação voluntária](../historico/correcoes/password-recovery-safety.md).

A correção geral de hospedagem do [PR #9 do app](https://github.com/secompufscar/secomp-app-xiv/pull/9) já está publicada: o endereço `/SetNewPassword?token=...` do e-mail entrega o app, preservando o token. Links já enviados continuam sujeitos à expiração e à versão da conta; a correção do 404 não exige mudar o endereço. A troca efetiva de senha e o login com a nova senha ainda não foram confirmados em produção. [Evidência e limitações](../historico/auditorias/production-deployment-2026-10-03.md#rotas-web-e-recuperação-de-senha).

## Troca de e-mail e edição administrativa

O [PR #22](https://github.com/secompufscar/secomp-server-xiv/pull/22), já integrado ao main, protege a troca de e-mail e a edição administrativa de credenciais:

- Endereço atual funcionando até confirmar o novo; resposta do perfil conserva o e-mail ativo enquanto há pendência.
- Confirmação vinculada à conta, aos endereços, à finalidade e às versões; conclusão invalida links/sessões anteriores apenas daquela conta.
- Edição administrativa de senha com hash, versão e revogação transacionais. Nome sem mudança de credenciais não encerra sessões.
- Reenvio por nova solicitação, substituição e cancelamento de pendência, validação e cotas próprias por participante/rede.

A pessoa que conclui a troca voluntária entra novamente com o novo e-mail e a senha atual. Não há novo APK, reset obrigatório ou logout geral. A migração aditiva precisa preceder o código novo. Evidência e limitações: [relato do PR #22](../historico/correcoes/verified-email-change.md), [testes de comportamento](../../tests/verified-email-change.test.cjs) e [MySQL isolado](../../tests/verified-email-change.integration.test.cjs).

## Limitações

Envio aceito não comprova entrega. Não há fila persistente de e-mail/retry automático, nem reparação em massa de contas confirmadas antigas sem QR. Proteções por versão dependem de todas as instâncias executarem o protocolo correspondente. Não há reparação retroativa de endereço omitido em token legado.
