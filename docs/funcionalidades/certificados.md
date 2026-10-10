# Certificados individuais da XIV SECOMP

## Regras

A edição é identificada pelo ano 2026, independentemente de qual edição está marcada como atual. A presença no credenciamento dessa edição comprova a doação, inclusive registros legados sem `checkedInAt`. Inscrição, lista de espera sem presença e credenciamento de outro ano não comprovam elegibilidade.

Somente atividades com `presente = true` da mesma edição entram na soma, uma vez por ID, excluindo credenciamento e atividades marcadas com `certificateExcluded`. Abertura e encerramento também são excluídos pelo nome exato, ignorando caixa e espaços externos. Atividades certificáveis precisam de duração inteira positiva em minutos e fonte não vazia. Falta de duração bloqueia a emissão inteira, sem produzir certificado parcial. Somente credenciamento ou atividades excluídas, sem outra atividade, também bloqueia. Pontos e instante do check-in nunca determinam horas.

Definições finais da organização em 10/10/2026: palestras de **60 minutos**, inclusive as das 11h, sem contar almoço; quatro minicursos de **180 minutos**; workshop de Karina Queiroz e Maratona M@U de **150 minutos** cada; mesa-redonda de curricularização de **60 minutos**. Feira da Comp, Camisetas, Coffee, Lual, abertura e encerramento não concedem horas. Mesa Monks mantém **90 minutos** pela regra previamente aprovada de intervalo entre atividades consecutivas no mesmo local. O plano versionado registra os valores por ID, sem depender de inferência durante a emissão.

`durationMinutes` e `durationSource` começam nulos; `certificateExcluded` começa falso. As migrações não preenchem horas nem habilitam emissão. A restrição do banco exige minutos e fonte nulos nas atividades excluídas. A fonte deve registrar a confirmação da organização ou os IDs/horários usados no intervalo aprovado. Evitar informações sigilosas na fonte, pois os endpoints existentes de atividades retornam esses campos.

O [plano de durações](duracoes-certificados-xiv.md) contém todas as definições confirmadas, sem alterar a programação ou o banco de produção. Após publicar a API e suas migrações, executar `node scripts/certificates/configure-durations.cjs --check` no ambiente autorizado. O comando só lê e relata cada alteração proposta, conflitos e atividades fora do plano. `--apply` aplica o plano inteiro numa transação, recusa nomes/valores divergentes ou IDs ausentes e preserva correções manuais posteriores. Repetir o plano já aplicado não altera nada. O credenciamento pode aparecer como atividade fora do plano: sua exclusão é uma regra independente e obrigatória.

## Contrato HTTP

Prefixo `/api/v1/certificates`:

- `POST /mine`: autenticação obrigatória. Emite para `req.user.id`, sem aceitar usuário ou edição escolhidos no corpo. Retorna 200 com o certificado emitido ou previamente existente. Repetições e solicitações concorrentes retornam o mesmo código. 403 sem credenciamento; 409 com emissão desabilitada, duração pendente ou ausência de atividades; 401 sem sessão válida.
- `GET /validate/:code`: público, sem dependência da versão do app ou login. Código hexadecimal maiúsculo de 32 caracteres. Código malformado/desconhecido retorna 404. Não existe listagem pública nem busca por nome/e-mail.
- `PUT /activities/:id/duration`: somente ADMIN autenticado. Corpo `{ "durationMinutes": 150, "durationSource": "Confirmação da organização em 10/10/2026" }`. Aceita 1 a 10080 minutos. Para limpar, ambos os campos devem ser nulos. Para excluir da certificação, enviar ambos nulos e `certificateExcluded: true`. O campo omitido equivale a falso; cadastrar duração reinclui uma atividade previamente excluída, exceto credenciamento/abertura/encerramento. Limitado a atividades da edição 2026. Não recalcula certificados já emitidos.

Resposta de emissão e validação: `code`, `participantName`, `totalMinutes`, `issuedAt`, `event` (ano/início/fim), `activities` (nome/categoria/início/minutos), `validationUrl` e `qrCode` (PNG base64). Não expõe e-mail, ID do usuário, registros de presença, fonte administrativa ou credenciais. QR e link contêm exatamente o mesmo código salvo. Respostas usam `Cache-Control: no-store`; consulta pública e emissão têm limites de requisições.

## Persistência

`certificates` guarda nome, total, data, URL e snapshot versionado da edição e das atividades, incluindo a origem das durações para auditoria. Código aleatório de 128 bits com índice único, além da unicidade `(userId, eventId)`. A transação usa a barreira exclusiva já adotada para edição/presenças, evitando emitir dois registros ou misturar alterações concorrentes. Os vínculos impedem apagar usuário/edição com certificado emitido.

Dados emitidos são imutáveis: mudanças posteriores de nome, programação, duração e presença não reescrevem o documento histórico. A desativação da emissão permite recuperar certificados existentes. Revogação/reemissão não está implementada; correções de certificados emitidos exigem um fluxo específico antes de alterar o registro, nunca edição manual do PDF.

## Publicação

1. Executar `npm run verify`, `npm run build` e `npm run test:db:atomicity` com MySQL local isolado; conferir CI do PR da API.
2. Fazer merge do PR da API antes de publicar a API. Conferir configuração Railway e executar `prisma migrate deploy` no fluxo de publicação. Não publicar um build com Prisma novo antes da migração.
3. Manter `CERTIFICATES_ENABLED` ausente ou `false`. Publicar o app após a API compatível, em PR separado, e conferir `/certificados` sem login.
4. Conferir e aplicar o plano de durações/exclusões aprovado com `configure-durations.cjs`, revisar atividades fora do plano e validar um caso controlado. Configurar `CERTIFICATE_VALIDATION_URL` se necessário (padrão `https://secomp-app-xiv.vercel.app/certificados`, HTTPS, sem query/hash/credenciais).
5. Somente com durações revisadas e validação pública publicada, definir `CERTIFICATES_ENABLED=true` para permitir novas emissões. O bloqueio individual por duração ausente continua ativo.

Não houve migração de produção, alteração de presenças ou emissão real durante a implementação local.
