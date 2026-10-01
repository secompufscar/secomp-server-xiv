# Compatibilidade com app e site

Última revisão: 30/09/2026. Referência do código integrado em `main` `8b221cc`, sem confirmação online. [Roadmap](../roadmap.md).

## Web/iOS e CORS

A origem do app web é `https://secomp-app-xiv.vercel.app`; `/App/Home` é caminho, não parte da origem. A lista publicada permanece permitida, e origens extras são configuráveis sem autorizar qualquer site. CORS precede parsers para erros 400/413 serem legíveis nas origens autorizadas. Preflight e tratamento de versão preservam clientes web sem header mobile. [Relato CORS](../historico/correcoes/web-cors-compatibility.md), [proteções de login web](../historico/correcoes/urgent-auth-web-safety.md).

As alterações não comprovaram a causa histórica da falha de login no iOS; a validação do deployment continua necessária.

## Login legado e evento

Login legado e links web continuam disponíveis. Recuperação é voluntária; não exigir resets, logout geral, novo APK ou rotação de chaves para essas melhorias na API. Sessões anteriores da própria conta são invalidadas somente ao concluir recuperação ou, se o PR #22 for integrado, alteração de credenciais protegida. Edição apenas do nome preserva acesso.

No evento, participantes compartilham a eduroam. Cotas são separadas por operação/identidade e têm teto amplo por rede. Testes cobrem 100 contas no mesmo IP, sem medir capacidade real da infraestrutura. Proxy, armazenamento por instância e tráfego precisam de validação. [Relato de cotas](../historico/correcoes/shared-network-rate-limits.md).

Inscrição, presença e listas mantêm os contratos; a consulta de nomes/total de presentes é aditiva e administrativa. Ver [respostas](respostas.md) e [presença](../funcionalidades/presenca.md).

O [plano P0 original](../historico/correcoes/app-p0-compatibility.md) registra também evolução do aplicativo. Distribuição de APK e ativação de versão mínima são etapas distintas de melhorias que ficam só na API. Seguir o [procedimento atual de publicação](../operacao/publicacao.md).
