# Acompanhamento das correções — edição XIV

Esta branch reúne as correções P0 revalidadas sobre o código da edição XIV. Os documentos abaixo descrevem os contratos e as decisões técnicas aplicados neste repositório.

| Prioridade | Tema | Estado | Referência |
| --- | --- | --- | --- |
| 1 | Escalada de privilégio no cadastro público | Implementado nesta branch | Testes de cadastro |
| 2 | Exposição de hashes, tokens push e dados pessoais | Implementado nesta branch | [Documento](user-response-contracts.md) |
| 3 | Acesso indevido a inscrições e check-in | Implementado nesta branch | [Documento](enrollment-authorization.md) |
| 4 | Senha em texto puro na edição administrativa | Implementado nesta branch | [Documento](admin-password-update.md) |
| 5 | Duplicidade e corrida na capacidade das atividades | Implementado nesta branch | [Documento](activity-capacity.md) |
| 6 | ID fixo de categoria no check-in | Implementado nesta branch | [Documento](checkin-category-rule.md) |
| 7 | Ausência de vínculo entre atividade e edição do evento | Implementado nesta branch | [Documento](activity-event-link.md) |
| 8 | Múltiplos eventos atuais e estado duplicado de inscrição | Pendente | — |
| 9 | Agendador: fuso, recorrência, persistência e cancelamento | Pendente | — |
| 10 | Escritas parciais por ausência de transações | Pendente | — |
| 11 | Upload sem limite e substituição insegura no Cloudinary | Pendente | — |
| 12 | Exclusão de categoria com verificação incorreta de array | Pendente | — |
| 13 | Endurecimento de autenticação, validação e reset de senha | Pendente | — |
| 14 | Build, documentação e testes | Parcial: testes e CI adicionados | Documentação deste diretório |

## Compatibilidade com o aplicativo

Os bloqueadores P0 identificados na análise do aplicativo têm um plano de publicação próprio em [app-p0-compatibility.md](app-p0-compatibility.md). A exigência de versão permanece desativada por padrão para permitir a publicação coordenada entre API e lojas.

O procedimento operacional para aplicar migrações, validar a API e liberar o aplicativo está em [p0-deployment-runbook.md](p0-deployment-runbook.md).
