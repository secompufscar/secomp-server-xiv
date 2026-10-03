# Testes e CI

Última revisão: 03/10/2026. Configuração integrada até `3f4540a`, incluindo os testes dos PRs #22, #27 e #28. O código funcional publicado é `633e8c8`; os commits seguintes atualizam documentação. [Roadmap](../roadmap.md).

## GitHub Actions

O [workflow](../../.github/workflows/ci.yml) roda em PRs e pushes ao main:

| Job | O que verifica | Evidência/configuração |
| --- | --- | --- |
| Tests and TypeScript | Geração do cliente Prisma, tipos, testes de comportamento e build | [Scripts npm](../../package.json), [testes](../../tests) |
| MySQL integrity and rollback | Migrações em schema temporário e integrações seriais de rollback/concorrência | [Runner isolado](../../scripts/run-isolated-mysql-test.cjs) |

Os testes de integração não usam produção. A camada de envio de e-mail é substituída para impedir entrega real. O runner exige MySQL local e schema com nome protegido; cria e remove o banco temporário. Outros opt-in, como a integração específica de capacidade, não estão automaticamente incluídos no runner; conferir os arquivos e o workflow.

## Execução local

`npm run verify` gera Prisma, verifica TypeScript e executa a suíte padrão. Integrações opt-in aparecem como ignoradas nesse comando; isso não representa sua execução em banco. `npm run build` compila e copia templates.

`npm run test:db:atomicity` precisa de MySQL local e `DATABASE_URL` administrativa de teste. Não usar URL de produção nem copiar segredos para a documentação. O runner rejeita host remoto. Em Windows, encerrar processos que usam a DLL do Prisma antes de regenerá-la, para evitar bloqueio de arquivo.

## Evidência por fluxo

- [Cadastro público](../../tests/signup.test.cjs) testa criação apenas de USER e cadastro recuperável.
- [Cancelamento](../../tests/registration-cancellation.integration.test.cjs), [presença](../../tests/attendance-integrity.integration.test.cjs) e [edição](../../tests/edition-state-integrity.integration.test.cjs) verificam transações e concorrência.
- [Recuperação](../../tests/password-recovery.integration.test.cjs) verifica uso único, revogação e isolamento de outras contas.
- [Troca de e-mail e senha administrativa no MySQL](../../tests/verified-email-change.integration.test.cjs), integrada pelo PR #22, verifica confirmação concorrente, revogação e rollback. Também incluída no runner isolado da CI.
- [Apresentação e descrição](../../tests/activity-speaker-profile.test.cjs) verifica seleção, limite de 1.500, link e falhas da substituição de foto. A [integração MySQL de atividades](../../tests/activity-speaker-profile.integration.test.cjs), também no runner, verifica persistência de 1.500 caracteres, redução/promoção de fila, presenças, rollback e concorrência.

Contagens e resultados de cada rodada estão nos [relatos históricos](../historico/README.md). CI aprovada confirma os cenários executados naquele commit; não comprova ausência de outros bugs, entrega real de e-mail, carga de produção, deploy ou aplicação de migrações online.
