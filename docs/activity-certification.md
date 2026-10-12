# Duração e certificados no CRUD de atividades

Criação por ADMIN exige `durationMinutes` (inteiro de 1 a 10080) e `certificateExcluded` (booleano explícito: `false` significa certificável). `durationSource` registra a fonte oficial; quando omitida, identifica a duração como informada pela organização no cadastro. Atividades não certificáveis também conservam sua duração.

Leituras devolvem os três campos. Atividades antigas sem duração mantêm os valores nulos; uma edição de título, descrição, horário ou outros metadados não inventa horas. Para editar a configuração de certificação, envie duração e certificabilidade juntas, com a fonte oficial. O endpoint administrativo de duração continua permitindo limpar duração/fonte juntas para bloquear novas emissões enquanto a organização verifica uma pendência.

Credenciamento, abertura, encerramento, Camisetas, Coffee, Lual/Luau e Feira da Comp permanecem fora da carga horária. A API rejeita a tentativa explícita de certificar esses cadastros e a política de emissão aplica as exclusões independentemente da flag. Continua obrigatório o credenciamento na mesma edição, com cada presença útil contada uma vez e emissão bloqueada por duração/fonte ausente.

Alterações afetam novas emissões e reemissões administrativas. Snapshots, códigos, revisões, validação pública, template V1 e PDFs de certificados já emitidos permanecem intactos. Uma reemissão continua exigindo a ação administrativa própria e seu motivo; editar a atividade nunca reemite automaticamente.

Exclusão retorna 409 quando existe presença ou referência no snapshot de qualquer revisão, inclusive revogada. Credenciamento também permanece protegido quando há certificados na edição. A exclusão permitida remove a atividade, inscrições sem presença e registros de imagens em uma transação; o app não remove imagens antecipadamente. Preservam-se arquivos externos já armazenados. O bloqueio da edição e da atividade usa a mesma ordem do check-in e da emissão. Mudar a edição com inscrições ou histórico é bloqueado, assim como transformar a categoria de/para credenciamento com presença ou certificados.

Migração `20261012020000_activity_duration_without_certificate` remove somente a restrição que obrigava duração nula em atividades excluídas; mantém a restrição de duração/fonte válidas e todos os dados. Publicar a API após merge e antes do app. Ensaiar as migrações em MySQL isolado e comparar presenças/certificados antes e depois da publicação, mantendo backups existentes.
