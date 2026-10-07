# Testes e CI

Última revisão: 07/10/2026. Na rodada do PR #33, publicada em `dea590e2`, a suíte padrão teve 135 testes: 125 aprovados e dez integrações opt-in ignoradas. Passaram separadamente dez integrações MySQL, TypeScript e build, além dos dois jobs da CI do PR. Esses números descrevem aquela rodada, não uma garantia de estabilidade de produção. [Evidência e limites](../historico/auditorias/participant-directory-release-2026-10-06.md), [roadmap](../roadmap.md).

## GitHub Actions

O [workflow](../../.github/workflows/ci.yml) roda em PRs e pushes ao main:

| Job | O que verifica | Evidência/configuração |
| --- | --- | --- |
| Tests and TypeScript | Geração do cliente Prisma, tipos, testes de comportamento e build | [Scripts npm](../../package.json), [testes](../../tests) |
| MySQL integrity and rollback | Migrações em schema temporário e integrações seriais de rollback/concorrência | [Runner isolado](../../scripts/run-isolated-mysql-test.cjs) |

Os testes de integração não usam produção. A camada de envio de e-mail é substituída para impedir entrega real. O runner exige MySQL local e schema com nome protegido; cria e remove o banco temporário. Outros opt-in, como a integração específica de capacidade, não estão automaticamente incluídos no runner; conferir os arquivos e o workflow.

O runner também inclui [recuperação de conexão no login](../../tests/database-connection.integration.test.cjs): encerra somente o socket do cliente de teste, valida login legado/moderno, preservação da conta e ausência de sessões duplicadas. Os [contratos de conexão](../../tests/database-connection.test.cjs) exercitam indisponibilidade persistente, diagnóstico seguro e proibição de repetir escrita/commit incerto.

## Execução local

`npm run verify` gera Prisma, verifica TypeScript e executa a suíte padrão. Integrações opt-in aparecem como ignoradas nesse comando; isso não representa sua execução em banco. `npm run build` compila e copia templates.

`npm run test:db:atomicity` precisa de MySQL local e `DATABASE_URL` administrativa de teste. Não usar URL de produção nem copiar segredos para a documentação. O runner rejeita host remoto. Em Windows, encerrar processos que usam a DLL do Prisma antes de regenerá-la, para evitar bloqueio de arquivo.

## Evidência por fluxo

- [Cadastro público](../../tests/signup.test.cjs) testa criação apenas de USER e cadastro recuperável.
- [Cancelamento](../../tests/registration-cancellation.integration.test.cjs), [presença](../../tests/attendance-integrity.integration.test.cjs) e [edição](../../tests/edition-state-integrity.integration.test.cjs) verificam transações e concorrência.
- [Recuperação](../../tests/password-recovery.integration.test.cjs) verifica uso único, revogação e isolamento de outras contas.
- [Troca de e-mail e senha administrativa no MySQL](../../tests/verified-email-change.integration.test.cjs), integrada pelo PR #22, verifica confirmação concorrente, revogação e rollback. Também incluída no runner isolado da CI.
- [Apresentação e descrição](../../tests/activity-speaker-profile.test.cjs) verifica seleção, limite de 1.500, link e falhas da substituição de foto. A [integração MySQL de atividades](../../tests/activity-speaker-profile.integration.test.cjs), também no runner, verifica persistência de 1.500 caracteres, redução/promoção de fila, presenças, rollback e concorrência.
- [Lista geral](../../tests/participant-directory.test.cjs) verifica projeções, filtros, paginação e autorização; a [integração MySQL](../../tests/participant-directory.integration.test.cjs), incluída no runner, verifica todas as contas, edição atual e ciclo do instante de presença, sem exigir credenciamento prévio.

Contagens e resultados de cada rodada estão nos [relatos históricos](../historico/README.md). CI aprovada confirma os cenários executados naquele commit; não comprova ausência de outros bugs, entrega real de e-mail, carga de produção, deploy ou aplicação de migrações online.
