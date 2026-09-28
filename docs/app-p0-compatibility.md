# Compatibilidade com o aplicativo — P0

## Escopo

Esta entrega cria o contrato necessário para liberar uma versão segura do aplicativo:

- `GET /api/v1/app/version` publica a política de versão por plataforma;
- o middleware global pode responder `426 APP_UPDATE_REQUIRED` a versões abaixo da mínima;
- `GET /api/v1/userAtActivities/activity/:activityId/summary` entrega somente ocupação, tamanho da fila e a posição do usuário autenticado;
- atividades passam a incluir a categoria e seu `requiresEnrollment`, eliminando regras por IDs no cliente.
- categorias possuem `slug` semântico persistido para ícones e agrupamentos, sem depender de UUIDs ou nomes livres;
- login do app recebe access token de 15 minutos e refresh token opaco, armazenado somente como hash na API e rotacionado a cada uso.

O endpoint administrativo que lista participantes continua restrito a administradores. O resumo não retorna nomes, e-mails, IDs de terceiros ou datas de inscrição.

## Configuração

As variáveis estão documentadas em `.env.example`. Mantenha `APP_VERSION_ENFORCEMENT_ENABLED=false` durante a publicação inicial. Configure versões mínimas, versões atuais e URLs oficiais das lojas antes do deploy.

## Ordem segura de publicação

1. Publique a API com a exigência desativada.
   Execute também as migrações que criam `category.slug` e `refreshSessions`.
2. Gere, teste e publique o aplicativo `1.1.0` nas lojas.
3. Confirme que as URLs de atualização estão acessíveis e que a versão aprovada envia os cabeçalhos `X-App-Platform`, `X-App-Version` e `X-App-Build`.
4. Ajuste a versão mínima para a versão que deve permanecer compatível.
5. Ative `APP_VERSION_ENFORCEMENT_ENABLED=true` e reinicie a API.

Ativar a exigência antes de a nova versão estar disponível bloqueará clientes sem os cabeçalhos de versão. Para desativar imediatamente, restaure a variável para `false` e reinicie a API.

Durante a transição, logins sem `X-App-Version` continuam recebendo o token legado de 24 horas e não criam refresh session. O aplicativo 1.1.0 envia o cabeçalho, recebe access token curto e rotaciona o refresh token. Depois que a versão mínima for elevada, clientes antigos serão bloqueados antes do login.

## Respostas

O endpoint de política informa `updateRequired` para indicar defasagem e `force` para indicar bloqueio efetivo. A API só devolve `426` quando a exigência está ativa.

## Verificação

O teste `tests/app-p0-compatibility.test.cjs` cobre comparação numérica, consulta pública da política, bloqueio HTTP 426 e o contrato do resumo sem dados pessoais.

## Dependências de segurança

As dependências diretamente expostas pela API foram atualizadas para Express 4.22.3, Multer 2.4.0 e bcrypt 6.0.0. `lodash` e `sharp` foram removidos porque não eram usados. O envio transacional por Brevo, específico da edição XIV, foi preservado.

Após `npm audit fix`, `npm audit --omit=dev` não informa vulnerabilidades altas ou críticas. Permanecem duas moderadas transitivas em `uuid`, trazidas pelo Bull 4; a correção automática sugerida pelo npm faria downgrade incompatível do Bull e não foi aplicada.

A validação executa Prisma, TypeScript e 38 testes: 37 aprovados e uma integração MySQL opcional ignorada quando não habilitada.
