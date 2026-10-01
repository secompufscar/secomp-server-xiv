# Contas

Última revisão: 30/09/2026. Escopo: comportamento integrado em `main` `8b221cc`, com evolução do PR #22 indicada separadamente. Estado de produção: não confirmado. [Prioridades e estados](../roadmap.md).

## Cadastro e login no main

Cadastro público aceita nome, e-mail e senha, cria apenas USER e ignora privilégios/campos internos enviados pelo cliente. UUID, hash e QR são preparados antes da inserção única. Falha de QR não ocupa o e-mail; timeout de confirmação mantém a conta pendente. Repetir o cadastro com a senha original retoma apenas USER não confirmado, sem substituir nome, senha, pontos ou inscrições.

Login exige confirmação do e-mail e senha correta. Clientes legados mantêm token de acesso; o fluxo com refresh é opt-in pelo contrato existente. Perfil próprio mantém o QR; hashes, versões internas e tokens push não entram nas respostas.

Recuperação é voluntária. Solicitar o link não muda senha ou sessões; concluir a recuperação grava senha, versão de autenticação e revogação em transação. Um link antigo não pode ser reutilizado após a troca. Tokens legados de versão zero continuam aceitos conforme regras e expiração até a recuperação da própria conta. Nenhum reset coletivo é exigido.

Evidências: [cadastro](../../tests/signup.test.cjs), [cadastro MySQL](../../tests/signup-recovery.integration.test.cjs), [recuperação](../../tests/password-recovery.test.cjs), [recuperação MySQL](../../tests/password-recovery.integration.test.cjs). Relatos: [cadastro recuperável](../historico/correcoes/signup-recovery.md), [recuperação voluntária](../historico/correcoes/password-recovery-safety.md).

## Evolução do PR #22

A base deste documento ainda altera e-mail diretamente e não revoga sessões na edição administrativa de senha. O [PR #22](https://github.com/secompufscar/secomp-server-xiv/pull/22) implementa:

- Endereço atual funcionando até confirmar o novo; resposta do perfil conserva o e-mail ativo enquanto há pendência.
- Confirmação vinculada à conta, aos endereços, à finalidade e às versões; conclusão invalida links/sessões anteriores apenas daquela conta.
- Edição administrativa de senha com hash, versão e revogação transacionais. Nome sem mudança de credenciais não encerra sessões.
- Reenvio por nova solicitação, substituição e cancelamento de pendência, validação e cotas próprias por participante/rede.

A pessoa que conclui a troca voluntária entra novamente com o novo e-mail e a senha atual. Não há novo APK, reset obrigatório ou logout geral. A migração aditiva precisa preceder o código novo. Evidência e limitações: [relato do PR #22](../historico/correcoes/verified-email-change.md), [testes no commit da implementação](https://github.com/secompufscar/secomp-server-xiv/blob/b360b574a8db4d3febc8984e6c33ab51e1a41ab9/tests/verified-email-change.test.cjs).

## Limitações

Envio aceito não comprova entrega. Não há fila persistente de e-mail/retry automático, nem reparação em massa de contas confirmadas antigas sem QR. Proteções por versão dependem de todas as instâncias executarem o protocolo correspondente. Não há reparação retroativa de endereço omitido em token legado.
