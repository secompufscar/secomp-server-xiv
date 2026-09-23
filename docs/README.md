# Acompanhamento das correções

A análise completa original está disponível localmente em `output/pdf/analise-tecnica-secomp-server-xiii.pdf`. Este diretório mantém a documentação técnica versionada de cada correção.

| Prioridade | Tema | Estado | Referência |
| --- | --- | --- | --- |
| 1 | Escalada de privilégio no cadastro público | Concluído e incorporado | [PR 45](https://github.com/secompufscar/secomp-server-xiii/pull/45) |
| 2 | Exposição de hashes, tokens push e dados pessoais | Em revisão | [Documento](user-response-contracts.md) · [PR 46](https://github.com/secompufscar/secomp-server-xiii/pull/46) |
| 3 | Acesso indevido a inscrições e check-in | Em revisão | [Documento](enrollment-authorization.md) · [PR 47](https://github.com/secompufscar/secomp-server-xiii/pull/47) |
| 4 | Senha em texto puro na edição administrativa | Em revisão | [Documento](admin-password-update.md) · [PR 48](https://github.com/secompufscar/secomp-server-xiii/pull/48) |
| 5 | Duplicidade e corrida na capacidade das atividades | Em revisão | [Documento](activity-capacity.md) · [PR 49](https://github.com/secompufscar/secomp-server-xiii/pull/49) |
| 7 | Ausência de vínculo entre atividade e edição do evento | Em implementação | [Documento](activity-event-link.md) |
| 6 | ID fixo de categoria no check-in | Implementado nesta branch | [Documento](checkin-category-rule.md) |
| 8 | Múltiplos eventos atuais e estado duplicado de inscrição | Pendente | — |
| 9 | Agendador: fuso, recorrência, persistência e cancelamento | Pendente | — |
| 10 | Escritas parciais por ausência de transações | Pendente | — |
| 11 | Upload sem limite e substituição insegura no Cloudinary | Pendente | — |
| 12 | Exclusão de categoria com verificação incorreta de array | Pendente | — |
| 13 | Endurecimento de autenticação, validação e reset de senha | Pendente | — |
| 14 | Build, documentação e testes | Parcial: testes e CI adicionados | PR 45 e documentação deste diretório |

Os PRs 47 a 49 estão encadeados para manter cada revisão pequena. Depois que a base anterior for incorporada, o PR seguinte deve ser redirecionado para `main`; nesse momento o CI configurado para PRs destinados à `main` será executado.
