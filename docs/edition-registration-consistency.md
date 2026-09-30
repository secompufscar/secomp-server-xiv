# Consistência da edição e inscrições — 30/09/2026

Implementação na branch `codex/edition-registration-consistency`, sobre as correções dos PRs #17 e #18. Produção, migrações e comportamento online não foram alterados nesta etapa.

## Regra funcional e compatibilidade

- `userEvent.status` é o estado da inscrição naquela edição: 0 pendente/fila, 1 confirmado, 2 encerrado. Resumo do perfil usa os mesmos números; não confirma automaticamente todo vínculo.
- Criar edição futura (`isCurrent:false`) e criar/editar/cancelar inscrição de edição não atual preservam o perfil da edição atual.
- Criar ou selecionar explicitamente uma edição atual desmarca a anterior e projeta o perfil a partir das inscrições da nova edição, na mesma transação. Com vínculo, copia status e ano; sem vínculo, usa 0/null. Não transporta inscrições de outro ano. Alterar o ano da edição atual atualiza também o resumo do perfil. Editar apenas datas não faz reconciliação global.
- Omitir `isCurrent` na criação preserva o padrão anterior `true`. Desmarcar a edição atual permite zero atuais e limpa o resumo correspondente ao ano desmarcado. O banco impede duas atuais, inclusive em SQL direto.
- Criar/editar inscrição atual sincroniza perfil na mesma transação, lendo ano e estado atuais dentro dela. Inscrição encerrada não pode ser reativada. Status inválido é rejeitado.
- Cancelamento anual confirmado promove o primeiro pendente e sincroniza o perfil do promovido somente se essa edição é atual. Cancelar pendente ou inscrição de edição encerrada não promove a fila anual. A retirada da inscrição mantém os controles de presença, créditos e filas já implementados.
- Encerramento geral marca inscrições 2 e fecha novas inscrições na mesma transação. Desativação também altera endDate na transação. Mantém a indicação de edição atual para consulta histórica, como antes; não muda automaticamente para outra edição.
- `registrationsClosed` é interno e começa `false`, sem inferir encerramento de dados legados por datas passadas. Só os fluxos explícitos de encerramento/desativação o ativam; formulário comum não o reabre. Campo omitido das respostas de eventos e eventos aninhados nas inscrições.

Não há recálculo de pontos, troca de senha, revogação geral, novo APK ou ação dos participantes. A migração não reconcilia perfis históricos nem escolhe a edição atual. Projeção global ocorre somente numa transição explícita de edição atual (ou desativação da atual); fechar inscrições em lote atualiza membros daquela edição.

## Transações e concorrência

A linha singleton `editionStateLock.id=1` funciona como barreira compartilhada/exclusiva no MySQL. Check-in, inscrição individual, alterações de presença e escritas de atividade adquirem o lock compartilhado antes de usuário/atividade/vínculos; continuam podendo operar em paralelo em usuários/atividades diferentes. Transições de evento, cancelamento anual e operações em lote adquirem exclusivo desde o início. Não há upgrade de lock nem e-mail/push dentro dessas transações.

Isso impede reprojetar perfis ou mover atividade enquanto o cancelamento lê presenças. Cancelamento exclusivo também evita ciclos entre vários usuários e promovidos. Transações usam ReadCommitted nos fluxos de estado anual/evento; unicidade da atual é reforçada por coluna SQL gerada nullable + UNIQUE. Ausência da linha singleton retorna falha e não prossegue sem proteção.

Operações exclusivas bloqueiam temporariamente os check-ins: duração e volume precisam ser observados no ambiente real. Não é garantia de ausência de todo deadlock com serviços externos/instâncias antigas. Foram removidos dez helpers internos sem consumidores que escreviam pontos/presença/status por caminhos anteriores; rotas existentes continuam usando os serviços atuais.

## Migração e pré-verificação

Antes de publicar, conferir backup e executar consulta somente leitura no banco alvo:

```sql
SELECT id, year, startDate, endDate
FROM events WHERE isCurrent = TRUE ORDER BY year;
```

Se houver mais de uma linha, interromper a publicação e definir explicitamente qual edição deve ficar atual. A migração `20260930020000_edition_state_integrity` **falha por duplicidade**, sem escolher uma nem atualizar isCurrent. Não corrigir automaticamente dados de produção. Ela acrescenta coluna gerada/índice e registrationsClosed em um ALTER, cria a tabela de coordenação e insere a linha 1.

Aplicar com `prisma migrate deploy`, antes do código, seguindo o runbook. Conferir status e constraint antes de liberar escritas. Todas as instâncias precisam do novo protocolo; retirar instâncias antigas antes de considerar a garantia de coordenação efetiva. Não houve deploy nesta etapa.

A coluna gerada `currentEditionKey`/índice `events_single_current` ficam no SQL versionado, fora do modelo público Prisma. Ferramentas de diff/autogeração de migrações devem preservar essa restrição; não usar db push/reset em produção. Rollback da aplicação não remove os objetos aditivos automaticamente.

## Evidências

Validação final local aprovada: `npm run verify` (93 testes, seis integrações opt-in omitidas), build e `git diff --check`. Cinco integrações MySQL aprovadas separadamente, incluindo o ALTER de migração recusando duplicatas em tabela clonada. Onze migrações aplicadas no schema temporário. Runner removeu o banco ao terminar e o helper encerrou o processo MySQL e removeu seu diretório após sucesso. O diretório da primeira execução falha também foi removido após confirmar que não estava em uso. CI e publicação precisam de verificação própria; não houve deploy.

Testes MySQL isolados cobrem criação futura sem tocar perfis, projeção 0/1/2 na troca, promoção condicional, encerramento versus edição individual, trocas concorrentes, troca versus inscrição, ausência do singleton, recusa de segunda atual por SQL e recusa da migração sobre tabela clonada com duplicatas. Falhas após evento, inscrição e projeção de perfil devem restaurar snapshots completos. Corrida entre cancelamento e transferência de atividade é exercitada nas duas ordens.

Runner serial usa schema temporário protegido por nome e loopback; não usa contas reais ou produção. Testes HTTP/contratos e build compõem a CI. Uma colisão de ano entre fixtures da primeira execução foi corrigida usando anos disponíveis.
