# Correção da edição administrativa de senha — item 4

`PUT /admin/edit` agora aplica bcrypt com custo 10 antes de persistir uma senha nova. Quando `senha` não é enviada, o campo é omitido da atualização e o hash existente permanece intacto.

Os campos opcionais `updatedEmail` e `nome` também são enviados ao Prisma somente quando aparecem na requisição. A resposta continua usando a projeção administrativa segura e não retorna o hash.

Os testes cobrem os dois casos que falhavam: senha fornecida não pode chegar em texto puro ao repositório; senha ausente não pode gerar hash de `undefined` nem impedir a atualização de outros campos.
