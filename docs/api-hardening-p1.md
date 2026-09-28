# Endurecimento da API — P1

## Objetivo

Reduzir abuso, vazamento de informações e consumo descontrolado de recursos sem alterar as rotas nem os formatos de sucesso usados pelo aplicativo e pelo site.

## Controles implementados

- `helmet` adiciona cabeçalhos HTTP defensivos. A política CSP permanece desativada para manter o Swagger atual funcional.
- `x-powered-by` foi removido para não divulgar o framework.
- Todo request recebe `x-request-id`; identificadores externos só são aceitos quando usam caracteres seguros e têm até 100 caracteres.
- JSON e formulários têm limite configurável, com padrão de `1mb`.
- Upload de imagem usa memória com limite padrão de 8 MiB, um arquivo por request e MIME declarado como JPEG, PNG, WebP ou GIF.
- Cadastro, login, renovação, logout e recuperação de senha validam e normalizam entrada com Zod.
- Campos desconhecidos no cadastro são descartados, impedindo que o cliente injete propriedades como `tipo: ADMIN`.
- Login e operações de conta possuem limites independentes por IP. Tentativas de login bem-sucedidas não consomem a cota de falhas.
- Recuperação de senha retorna a mesma resposta para e-mails existentes e inexistentes.
- Erros inesperados deixam de expor mensagens internas. O servidor registra o detalhe junto com o `requestId`.
- Conflitos e registros ausentes conhecidos pelo Prisma são convertidos em respostas HTTP consistentes.
- `/api/v1/health/live` verifica o processo e `/api/v1/health/ready` verifica acesso ao banco.

## Compatibilidade

- Rotas públicas e autenticadas existentes foram preservadas.
- Respostas de sucesso não mudaram.
- O login continua aceitando o tamanho de senha legado; novos cadastros e novas senhas mantêm o mínimo de 6 caracteres usado pelo aplicativo e têm limite de 72 caracteres. Revisão identificou que esse limite ainda deve ser convertido para bytes UTF-8 para corresponder ao bcrypt com caracteres multibyte; ver P1-06 do [roadmap](roadmap.md).
- A lista CORS padrão mantém todas as origens que estavam fixas no código.
- O endpoint genérico da raiz foi preservado nesta etapa para evitar mudança de comportamento sem inventário dos consumidores.

## Configuração

| Variável | Padrão | Finalidade |
| --- | ---: | --- |
| `HTTP_BODY_LIMIT` | `1mb` | Limite de JSON e formulário URL encoded |
| `UPLOAD_MAX_MB` | `8` | Limite da imagem de atividade em MiB |
| `TRUST_PROXY_HOPS` | `1` | Proxies confiáveis antes do Express; necessário para IP e rate limit no Railway |
| `CORS_ORIGINS` | lista histórica | Origens permitidas, separadas por vírgula |
| `AUTH_RATE_LIMIT_WINDOW_MINUTES` | `15` | Janela de autenticação |
| `AUTH_RATE_LIMIT_MAX_FAILURES` | `20` | Falhas de autenticação por IP e janela |
| `ACCOUNT_RATE_LIMIT_WINDOW_MINUTES` | `60` | Janela de operações de conta |
| `ACCOUNT_RATE_LIMIT_MAX_REQUESTS` | `20` | Operações de conta por IP e janela |

Valores ausentes ou inválidos usam os padrões seguros. Antes da implantação, confirme `TRUST_PROXY_HOPS` contra a topologia real do proxy para impedir que cabeçalhos de IP sejam interpretados incorretamente.

## Verificação

Execute:

```bash
npm run verify
```

Os testes específicos cobrem normalização e remoção de campos, contrato de validação, não exposição de erro interno e rejeição de payload excessivo.

O build copia os templates EJS com Node.js e funciona da mesma forma em Windows e Linux.

## Dependência transitiva conhecida

`npm audit --omit=dev` registra duas ocorrências moderadas de [GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq) em `uuid@8.3.2`, trazido por `bull@4.16.5`. O Bull já está na versão mais recente publicada e usa `uuid.v4()`; o vetor descrito pelo alerta exige as variantes v3, v5 ou v6 com um buffer fornecido pelo chamador. O risco foi documentado sem executar `npm audit fix --force`, pois a correção proposta pelo npm rebaixa Bull para 1.1.3 e representa uma mudança incompatível.

## Próximas etapas

1. Aplicar validação equivalente às demais rotas de escrita.
2. Padronizar controllers que ainda capturam erros localmente e devolvem `500` para falhas conhecidas.
3. Auditar autorização por recurso e operações administrativas.
4. Revisar consultas, paginação, índices e transações sob carga representativa.
5. Adicionar armazenamento compartilhado ao rate limiter se a API passar a usar mais de uma instância.
6. Validar a assinatura binária das imagens antes do envio ao Cloudinary; o filtro atual valida o MIME informado no multipart.
