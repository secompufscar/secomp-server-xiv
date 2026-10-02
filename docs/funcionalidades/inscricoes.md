# Inscrições e edições

Última revisão: 01/10/2026. Implementação integrada em `main` `ac045eb`; migrações e comportamento online não confirmados. [Roadmap](../roadmap.md).

## Regras vigentes no código

O banco permite no máximo uma edição atual. Nenhuma edição atual também é um estado possível. Criar edição futura não altera perfis da atual; operações históricas preservam a projeção da atual. A mudança explícita da edição atual sincroniza os perfis conforme as inscrições daquela edição.

Inscrição por atividade é única por usuário/atividade. Escritas concorrentes respeitam a capacidade, encaminham excedentes para espera e coordenam usuários/atividades. A categoria define necessidade de inscrição; atividade deve estar vinculada a uma edição, com tratamento documentado de dados legados.

Criação, mudança de status, cancelamento, promoção e fechamento relacionados usam transações. Promoção anual atualiza inscrição e perfil da edição atual juntos. Cancelar inscrição pendente ou de edição fechada não promove a fila anual. Cancelamento preserva outras edições e reverte somente créditos conhecidos conforme as regras de presença.

Fechamento mantém a edição para consulta, bloqueia novas inscrições e reativação de inscrições fechadas. Não muda automaticamente qual edição é a atual. A barreira de estado coordena mudanças de edição com inscrição, presença e movimentação de atividade.

## Permissões e contratos

Participante consulta suas inscrições e cancela as próprias; administrador tem as permissões ampliadas previstas nas rotas. Criar inscrição em atividade usa o usuário autenticado. Consulta nominal dos inscritos exige ADMIN. Corpo e respostas existentes permanecem conforme [contratos](../contratos/respostas.md).

## Evidência e limites

Testes: [capacidade](../../tests/activity-capacity.test.cjs), [autorização](../../tests/enrollment-authorization.test.cjs), [cancelamento MySQL](../../tests/registration-cancellation.integration.test.cjs), [edições MySQL](../../tests/edition-state-integrity.integration.test.cjs).

Detalhes históricos: [capacidade](../historico/correcoes/activity-capacity.md), [cancelamento](../historico/correcoes/registration-cancellation.md), [consistência de edição](../historico/correcoes/edition-registration-consistency.md).

A migração de unicidade falha se houver edições atuais duplicadas, sem escolher uma automaticamente. Não há reconciliação silenciosa de dados históricos. Conferir duplicatas, migrações e atualização de todas as instâncias no [procedimento de publicação](../operacao/publicacao.md).
