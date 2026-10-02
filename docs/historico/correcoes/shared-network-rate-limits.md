# Limites compatíveis com rede compartilhada — 30/09/2026

Registro de implementação/auditoria preservado para rastreabilidade. O estado vigente está no [roadmap](../../roadmap.md).

O público usa eduroam. Essa informação não confirma quantos IPs públicos a rede usa, mas exige que a API suporte muitas contas pelo mesmo IP. Antes, cadastro e recuperação compartilhavam 20 requisições/IP/hora; login, refresh e reset compartilhavam 20 falhas/IP/15min. Usuários diferentes podiam bloquear uns aos outros e cadastro podia esgotar a recuperação.

Cada operação agora possui dois limitadores e armazenamento separado:

| Operação | Cota específica padrão | Teto amplo por IP/sub-rede |
| --- | --- | --- |
| Cadastro | 20 requisições por e-mail normalizado/hora | 2.000 requisições/hora |
| Solicitação de recuperação | 20 requisições por e-mail normalizado/hora | 2.000 requisições/hora |
| Login | 20 falhas por rede + e-mail/15min | 2.000 falhas/15min |
| Refresh | 20 falhas por rede + refresh token/15min | 2.000 falhas/15min |
| Conclusão do reset | 20 falhas por rede + token/15min | 2.000 falhas/15min |

Sucessos de autenticação não consomem a cota; respostas bloqueadas/falhas consomem. E-mails são trim/lowercase como no schema existente. Cadastro/recuperação limitam o alvo mesmo se mudar de rede; login usa rede+conta para evitar bloqueio global da conta provocado por terceiros. Dados ausentes usam a cota menor por rede. Refresh/reset não usam uma chave por IP comum a todos os tokens. Nenhuma conta, senha ou token é alterado pela decisão de quota.

O teto amplo é uma escolha inicial configurável, não uma medição do tráfego do evento nem garantia de que qualquer volume/ataque não bloqueará o IP. Não há isenção por nome da rede ou confiança em headers enviados pelo cliente. Mantém-se normalização IPv6 da biblioteca e confiança no proxy existente, que deve corresponder à infraestrutura real. Rotacionar e-mails/tokens continua sujeito ao teto da rede.

A cota por e-mail protege o destinatário de spam, mas alguém que conhece o endereço pode gastar essa cota com solicitações válidas e impedir novas solicitações para aquele endereço até a janela renovar. Links já enviados continuam utilizáveis e outras contas não são afetadas. Entradas inválidas nas rotas reais consomem somente o teto da rede: validação precede a cota da identidade, impedindo esgotar uma conta por cadastros com senha inválida.

Chaves específicas são HMAC com segredo aleatório efêmero do processo: e-mails/tokens não são guardados literalmente como chaves e não são registrados. A solução continua com MemoryStore por instância; reinício limpa contadores e múltiplas instâncias não compartilham quotas. Confirmar o proxy e observar 429 na publicação; armazenamento distribuído continua pendente. Não exige Redis, migração, novo APK ou novos headers do app.

## Configuração e compatibilidade

Continuidade de 30/09: [troca de e-mail](verified-email-change.md) acrescenta operação com contadores independentes por ID autenticado/rede, usando os limites existentes de conta. Nome sem e-mail ignora essa cota; 100 contas no mesmo IP testadas. O fluxo administrativo permanece protegido por ADMIN e fora dessa cota de participante. Contadores continuam locais ao processo.

As variáveis existentes de janela e limite menor continuam válidas, agora com o escopo específico da tabela. Novas variáveis `AUTH_NETWORK_RATE_LIMIT_MAX_FAILURES` e `ACCOUNT_NETWORK_RATE_LIMIT_MAX_REQUESTS` definem os tetos amplos e usam 2.000 quando ausentes/invalidas. Usar somente limites positivos. Não reutilizar 20 como teto amplo do eduroam.

Rotas, corpos e respostas de sucesso permanecem iguais. Bloqueio mantém 429, `RATE_LIMIT_EXCEEDED`, request ID e Retry-After. CORS permite ler a resposta para o app web publicado. Solicitar recuperação continua voluntário; não há reset coletivo.

## Evidências

Validação final local: `npm run verify` aprovado (92 testes, cinco integrações opt-in omitidas), build e `git diff --check` aprovados. Uma execução anterior da suíte falhou por resolução transitória da dependência local `has-symbols`; o arquivo foi confirmado presente e a execução completa seguinte passou, sem alterar o lockfile.

`tests/shared-network-rate-limits.test.cjs` exercita as rotas reais com controllers substituídos (sem banco ou envio de e-mails): 100 contas no mesmo IP cadastram, solicitam recuperação, erram login e depois entram; repetição da mesma conta é bloqueada sem bloquear outra conta ou recuperação. Testa e-mail normalizado entre redes, teto amplo com e-mails rotativos, IPv6 na mesma sub-rede, tokens distintos, sucesso não descontado e 429 com CORS. Não é teste de carga da infraestrutura real nem do serviço de e-mail.

Referência da biblioteca: [configuração e combinação de limitadores](https://express-rate-limit.mintlify.app/reference/configuration), [normalização de IP](https://express-rate-limit.mintlify.app/reference/helpers).
