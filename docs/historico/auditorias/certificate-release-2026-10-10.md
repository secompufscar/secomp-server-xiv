# Certificados: homologação e publicação de 10/10/2026

## Escopo e sequência

Implementação da API integrada no [PR #36](https://github.com/secompufscar/secomp-server-xiv/pull/36), commit de merge `ca0a504ad245c4ac4fa6fcb1a55e8654121dfbf1`. O merge ocorreu antes do upload à Railway. App integrado depois, em [PR #30 separado](https://github.com/secompufscar/secomp-app-xiv/pull/30), commit `8792266cfbcebd59fb26a29e7a04f8f18bc9ee3d`.

O pacote da API foi produzido por `git archive` do commit integrado, sem arquivos locais, credenciais ou backups. Deployment Railway `3e4e04d5-51ce-426b-a3c9-63bf98e870e3` concluído com SUCCESS. A emissão geral permaneceu desativada durante a migração e a preparação da validação pública.

## Evidências pré-publicação

- CI da API aprovada no head `434b550404467a47e35272e4950f0492b2c16b8f` e no merge. CI do app aprovada no head `64af3769ef21b7f3fb7a5f40ef010148a644d0e0`: inclui exportação web, PDF e E2E sintético em 320/1280 px.
- Backup privado novo: SHA-256 `0adcb36f322fd30827bf3c931e19438cef48266e11f79e88c925ecb838e79d1c`, 1.209.356 bytes. Conteúdo não versionado nem anexado a CI/PR. Backups existentes preservados.
- Restauração em banco novo no MySQL isolado em `127.0.0.1:3310`, sem uso do banco habitual. Migrações preservaram quantidade de registros e hashes dos campos históricos das 15 tabelas restauradas, excluindo a alteração esperada do histórico de migrações.
- Plano aprovado de 37 atividades aplicado e conferido como pronto, sem conflitos; repetição sem alterações. Campos históricos da programação preservados, exceto `updatedAt` esperado pela configuração de durações.
- A organização autorizou sortear uma conta real. Sorteio uniforme com `crypto.randomInt` entre 59 contas USER confirmadas, credenciadas na edição e com presenças certificáveis. A identidade permaneceu nas evidências privadas.
- Conta selecionada: 11 atividades distintas, 780 minutos. Cinco emissões simultâneas na cópia local produziram um único registro/código. Total, anexo, URL, recuperação com flag desativada e rejeição de código malformado conferidos.
- PDF dessa cópia: três páginas, uma principal e duas de anexo. Texto/links inspecionados, todas as atividades exatamente uma vez, total correspondente e QR decodificado independentemente em todas as páginas. Renderizações conferidas visualmente.

## Conferência da produção

Leitura após o deployment confirmou 19 migrações terminadas, incluindo `20261010030000_certificate_revisions`, tabela `certificates` e três novos campos da atividade. Antes do teste controlado não existiam certificados.

Plano aplicado em produção numa transação: 37 alterações, 28 atividades incluídas e 9 excluídas. `--verify-ready` equivalente conferiu ausência de conflitos/atividades desconhecidas, exceto credenciamento. Hash dos demais campos da programação permaneceu igual. As presenças da conta escolhida coincidiram com a seleção, sem qualquer alteração para produzir elegibilidade.

Vercel confirmou SUCCESS no commit integrado do app. CI da main do app também terminou aprovada. Teste público pré-emissão no domínio publicado, sem autenticação e sem mocks, passou em 320/1280 px e rejeitou código inexistente.

Uma emissão real controlada foi realizada para a conta sorteada, sem habilitar a emissão no processo servidor. O processo administrativo temporário habilitou a flag apenas em sua própria memória para criar um registro; o servidor HTTP permaneceu bloqueando novas emissões com 409. Credencial de acesso de 60 segundos foi criada pelo helper normal do servidor somente em memória, sem salvar/exibir token nem alterar senha, papel ou sessões da conta. Isso valida autenticação HTTP, mas não equivale a testar o login interativo com a senha do participante.

Recuperação autenticada e consulta pública retornaram o mesmo certificado com HTTP 200 e `no-store`; emissão anônima retornou 401, código malformado 404 e tentativa de revogação por USER 403, sem revogar o registro. Não houve alteração de presenças ou criação de um certificado para dados artificiais.

Teste Playwright contra app/API publicados, sem mocks, passou em 320/1280 px: nome/13 horas/11 atividades, consulta sem credenciais, logos carregadas, sem overflow horizontal ou erro de página, rejeição de códigos malformados/desconhecidos e remoção do estado válido/download anterior. PDF realmente baixado do app conferido visualmente e por extração: três páginas, 11 atividades uma vez cada, total de 780 minutos, link e QR corretos em todas as páginas. Artefatos com dados pessoais permaneceram privados.

Configuração `CERTIFICATES_ENABLED=true` aplicada somente depois dessas conferências. Deployment Railway `162b2578-17d0-4da2-bba1-d54d13e91541` concluído com SUCCESS; processo ativo confirmou a flag e o plano pronto. Recuperação autenticada retornou o mesmo código/total com 200; consulta pública também 200. Outra conta USER confirmada, sem credenciamento nessa edição e sem certificado anterior, recebeu 403 ao solicitar emissão, e nenhum certificado foi criado para ela. Nenhum nome/ID/token dessa conta é publicado nesta evidência.

Backup privado pós-publicação realizado às 19:39 UTC: SHA-256 `92f5a75b8fab46398b698a4da507b3a739078626f2d270d77ee907fbebfa8413`, 1.221.119 bytes. O backup anterior foi preservado. O MySQL temporário isolado foi desligado após o ensaio; bancos/evidências locais foram mantidos. Emissão geral liberada, permanecendo as regras individuais de elegibilidade e de duração obrigatória.

## Balanço técnico

Pontos positivos: snapshot persistente e imutável; código aleatório único; emissão idempotente; regras explícitas e auditáveis; bloqueio conservador de horas pendentes; revisão administrativa transacional com histórico; API publicada depois de seu merge e antes do app; pacote limpo e ensaio de migração com preservação de dados.

Limitações e riscos remanescentes:

- MySQL local 8.4 difere do 9.7.2 da produção. O dump exigiu adaptação apenas local do terminador do trigger de inserção e do definer dos dois triggers de presença; arquivo original permaneceu intacto. Isso não comprova restauração de desastre numa instância idêntica à Railway.
- Fuso do servidor local inicialmente SYSTEM/Brasil, enquanto Railway usa SYSTEM/UTC. Ensaio repetido após alinhar o MySQL local a UTC; horários conferidos contra a produção. Nenhuma data foi corrigida artificialmente na programação.
- Testes de revogação/reemissão e rollback usam banco isolado; não se revoga um certificado real somente para testar erro 410.
- Medição de concorrência local não comprova capacidade de produção. A trava global conservadora continua e pode limitar carga elevada.
- Dependências existentes continuam com alertas de auditoria; não houve atualização ampla fora do escopo. Logs do build da API reportaram 6 alertas, sendo 1 crítico, no conjunto instalado pelo builder.
- PDF já baixado não pode ser removido do dispositivo. Revogação deve ser consultada pelo código/QR.
- Uma conta controlada não representa todos os participantes. Falta de credenciamento ou duração continua sendo bloqueada individualmente.

## Referências

[Regras e operação](../../funcionalidades/certificados.md), [plano de durações](../../funcionalidades/duracoes-certificados-xiv.md), [CI da API](https://github.com/secompufscar/secomp-server-xiv/actions/runs/38061575157), [CI do app](https://github.com/secompufscar/secomp-app-xiv/actions/runs/38078287214).
