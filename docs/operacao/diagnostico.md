# Diagnóstico de erros

Última revisão: 30/09/2026. Guia para investigação; não comprova acesso ou inspeção do serviço publicado. [Roadmap](../roadmap.md).

## Railway

No projeto, selecionar o serviço da API, abrir o deployment correspondente e consultar **Deploy Logs** para erros de execução. **Build Logs** mostra instalação/compilação. **Observability → Log Explorer** permite procurar por serviço e período. O Railway captura stdout/stderr, incluindo `console.log` e `console.error`. [Documentação oficial de logs](https://docs.railway.com/observability/logs).

Na CLI vinculada ao projeto, `railway logs` acompanha logs do serviço; `railway logs --since 1h` busca o último período. Selecionar explicitamente serviço/ambiente quando houver mais de um. [Referência oficial da CLI](https://docs.railway.com/cli/logs).

## Investigar uma falha

1. Registrar operação, horário/fuso, status HTTP, mensagem e `requestId` da resposta, quando presente. Verificar o commit do deployment.
2. Reproduzir com conta de teste e procurar o mesmo período/identificador nos logs do serviço correto.
3. Distinguir falha de build/startup, banco/migração, provedor externo, autenticação, validação e cota. CI verde não substitui esse diagnóstico.

O [handler de erros](../../src/middlewares/errorHandler.ts) registra identificador, método, rota e código para erros inesperados. Erros de validação/regras de negócio podem só retornar HTTP, sem linha no console. O serviço também usa códigos como `CONFIRMATION_EMAIL_FAILED`, `PASSWORD_RESET_EMAIL_FAILED` e `SIGNUP_CONFIRMATION_FAILED`; não se pode afirmar que todo erro tem stack trace ou correlação completa.

## Limites

Não incluir senhas, tokens, corpo de recuperação ou credenciais em relatos/logs compartilhados. Sanitização dos demais logs, métricas, timeouts e alertas ainda têm pendências no roadmap. Tráfego real e topologia do proxy devem ser conferidos antes de interpretar cotas; os testes locais não reproduzem a eduroam inteira.
