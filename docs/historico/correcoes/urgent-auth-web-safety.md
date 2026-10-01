# Proteções urgentes de autenticação e compatibilidade web

Registro de implementação/auditoria preservado para rastreabilidade. O estado vigente está no [roadmap](../../roadmap.md).

Continuidade da auditoria de 28/09/2026, sobre `main` em `d764a6a`. Esta rodada trata AUD-01, AUD-04 (cadastro/reset públicos), AUD-10 (handler central e envio de e-mail) e AUD-11. Não exige mudança no APK nem migração de banco. O PR #14 mantém separadamente o cancelamento transacional e a configuração aditiva de CORS.

## Comportamento

- A inicialização valida `JWT_SECRET`, `JWT_RESET_SECRET` e `EMAIL_SECRET`: obrigatórios, distintos, mínimo de 32 bytes, sem espaços nas extremidades e sem placeholders `your_*`. A confirmação de e-mail também valida sua chave no uso; não existe mais fallback público. O processo recusa iniciar antes de escutar HTTP ou iniciar o agendador se a configuração for inválida.
- Enforcement aplica 426 somente a clientes que declaram `x-app-platform: android` ou `ios`. Clientes web, sem plataforma ou com plataforma desconhecida seguem o contrato anterior. Confirmação e recuperação de senha ficam acessíveis mesmo com headers nativos antigos. A política de atualização não é uma fronteira de autorização; autenticação e permissões continuam nas rotas.
- Cadastro e reset públicos recusam senhas acima de 72 **bytes UTF-8**, antes do hash/escrita. O login mantém a validação anterior para não bloquear senhas legadas. Validação equivalente nas escritas administrativas ainda requer trabalho separado.
- O handler central registra somente request ID, método, padrão estático da rota e categoria do erro. Não registra URL, query, mensagem/stack arbitrária, corpo ou headers. Falhas de envio de e-mail usam códigos estáticos sem o objeto do provedor. Outros logs legados de módulos não alterados ainda devem ser revisados; isto não encerra a sanitização de toda a API.

## Publicação

Conferir os três segredos no ambiente de destino **antes** de publicar, sem copiá-los para logs ou Git. Gerar cada novo valor independentemente com `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Tamanho não comprova aleatoriedade; usar um gerenciador de segredos. Chaves existentes fortes e distintas não precisam ser rotacionadas por este patch.

Se uma chave precisar ser substituída: trocar JWT invalida access tokens existentes; trocar EMAIL invalida links de confirmação pendentes; trocar RESET invalida links de recuperação pendentes. Reemitir os links necessários. A API não deve iniciar com a chave pública antiga. Esta validação pode impedir um deploy mal configurado e não deve ser contornada restaurando placeholders.

O erro de login relatado no iOS ainda não tem causa comprovada: os testes após o rollback não identificam o deploy que falhou. Estas correções removem regressões verificáveis, mas não constituem diagnóstico conclusivo daquele incidente. Deploy e comportamento em produção não foram confirmados.

## Verificação e sequência

`tests/urgent-auth-web-safety.test.cjs` cobre configuração inválida no entrypoint, rejeição de token com chave padrão, limite UTF-8 preservando login legado, HTTP de login/links com enforcement e captura de logs com marcadores sintéticos. As fronteiras de banco/e-mail são simuladas; nenhum teste envia e-mail ou usa credenciais reais.

Validação local em 29/09/2026: `npm run verify` passou (68 testes aprovados, duas integrações MySQL opt-in omitidas); `npm run build` passou. Nenhuma escrita de banco foi alterada nesta rodada. A suíte limita concorrência a dois processos para controlar memória no carregamento do TypeScript, assim como no PR #14.

Permanecem prioritários AUD-02 (reset de uso único e revogação transacional), AUD-03 (troca de e-mail verificada), AUD-05/06/12 (presença/pontos/edição/fila) e consulta de nomes e total de presentes (AUD-21). Não há alegação de encerramento da auditoria ou de todas as prioridades.
