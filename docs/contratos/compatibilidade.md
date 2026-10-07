# Compatibilidade com app e site

Última revisão documental: 07/10/2026. A API `dea590e2` e o app `96f1b712` estão publicados, com a lista administrativa aditiva validada. [Evidência atual](../historico/auditorias/participant-directory-release-2026-10-06.md). Login web/iOS, CORS, rotas web e editor mantêm as evidências e os limites da [rodada de 03/10](../historico/auditorias/production-deployment-2026-10-03.md). [Roadmap](../roadmap.md).

## Web/iOS e CORS

A origem do app web é `https://secomp-app-xiv.vercel.app`; `/App/Home` é caminho, não parte da origem. A lista publicada permanece permitida, e origens extras são configuráveis sem autorizar qualquer site. CORS precede parsers para erros 400/413 serem legíveis nas origens autorizadas. Preflight e tratamento de versão preservam clientes web sem header mobile. [Relato CORS](../historico/correcoes/web-cors-compatibility.md), [proteções de login web](../historico/correcoes/urgent-auth-web-safety.md).

Na rodada de 03/10, login com conta existente no iOS foi confirmado pelo responsável, e os preflights da origem pública passaram naquele deployment. Esses testes não foram repetidos na rodada da lista geral e não comprovam a causa histórica do incidente antigo de login/CORS.

O [PR #9 do app](https://github.com/secompufscar/secomp-app-xiv/pull/9), mergeado e publicado, configura a regra geral de hospedagem para acesso direto/recarga das rotas da SPA, preservando caminhos, parâmetros e arquivos estáticos. A raiz, `/SetNewPassword` e `/App/Home` retornaram 200 e o documento do app no domínio público. Essa correção trata o 404 da hospedagem antes do JavaScript; CORS continua sendo verificado separadamente nas chamadas à API. [Validação e limites](../historico/auditorias/production-deployment-2026-10-03.md#rotas-web-e-recuperação-de-senha).

## Login legado e evento

Login legado e links web continuam disponíveis. Recuperação é voluntária; não exigir resets, logout geral, novo APK ou rotação de chaves para essas melhorias na API. Sessões anteriores da própria conta são invalidadas somente ao concluir recuperação ou alteração de credenciais protegida, conforme o PR #22 já integrado. Edição apenas do nome preserva acesso.

No evento, participantes compartilham a eduroam. Cotas são separadas por operação/identidade e têm teto amplo por rede. Testes cobrem 100 contas no mesmo IP, sem medir capacidade real da infraestrutura. Proxy, armazenamento por instância e tráfego precisam de validação. [Relato de cotas](../historico/correcoes/shared-network-rate-limits.md).

Inscrição, presença e listas mantêm os contratos; a consulta de nomes/total de presentes é aditiva e administrativa. Ver [respostas](respostas.md) e [presença](../funcionalidades/presenca.md).

O [plano P0 original](../historico/correcoes/app-p0-compatibility.md) registra também evolução do aplicativo. Distribuição de APK e ativação de versão mínima são etapas distintas de melhorias que ficam só na API. Seguir o [procedimento atual de publicação](../operacao/publicacao.md).
