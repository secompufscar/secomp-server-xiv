# Certificado ADMIN de teste: publicação de 11/10/2026

Registro histórico da publicação inicial. A [correção posterior](admin-certificate-single-course-2026-10-11.md) seleciona somente SDD no bloco simultâneo e substitui a amostra de 28 atividades/39h30 por 24 atividades/28 horas, sem alterar certificados reais. As evidências abaixo permanecem como ocorreram nesta rodada inicial.

## Escopo e estado

Opção publicada para todas as contas ADMIN na visão administrativa web de [Meus certificados](https://secomp-app-xiv.vercel.app/MyCertificates). Gera PDF transitório com nome **Certificado Admin [ TESTE ]**, todas as atividades certificáveis e avisos **TESTE - SEM VALIDADE** em todas as páginas. Não é emissão real, não altera presenças e não aparece no histórico.

- API: [PR #42](https://github.com/secompufscar/secomp-server-xiv/pull/42), commit funcional `7a8707f2ef9f1bb5fa7ca9daa3e1af686f5adf22`, merge `dd9085ae30a65d28a8846bc0d4e11424c80004a0`.
- Railway: deployment `3052523c-f6b2-452e-8208-a3bc5ce5419c`, **SUCCESS**, iniciado após o merge da API. Upload feito somente de um archive Git do merge, sem `.env`, backups ou arquivos privados.
- App: [PR #37](https://github.com/secompufscar/secomp-app-xiv/pull/37), commit funcional `37446782d4775803eb33bf0ba5fcd314a5a63efc`, merge `bd3a82a7359b3e33496594a2f8a666cba69a88f8`, integrado somente após a API publicada ser validada.
- Vercel: [publicação do merge](https://vercel.com/secomp-tis-projects/secomp-app-xiv/EewQQvD1yXjXS5gGqck1R6bJ9e6h), **success**. CI dos dois PRs e dos dois merges aprovada, separadamente dos resultados dos deployments.

Os guias atualizados posteriormente são revisões documentais, não novos modelos ou emissões. A [rodada anterior](certificate-release-2026-10-11.md) permanece preservada, com seu próprio escopo.

## Comportamento e segurança

`GET /api/v1/certificates/admin/preview` usa autenticação e papel ADMIN confirmado pelo banco; limite de 10 consultas/minuto por conta, `Cache-Control: no-store`. Não aceita usuário, nome ou edição do navegador. Usa `CERTIFICATE_YEAR` aprovado (XIV/2026 nesta publicação), não o ano selecionado no histórico. Não exige presença ou credenciamento do ADMIN e funciona com emissão real desabilitada.

A política comum inclui cada atividade uma vez por ID e exclui credenciamento, `certificateExcluded`, abertura e encerramento. Cada atividade incluída precisa de minutos/fonte oficiais; dados incompletos bloqueiam a amostra inteira. O plano atual tem **28 incluídas e 9 excluídas**, além do credenciamento. A amostra soma **2370 minutos, 39 horas e 30 minutos**, inclusive minicursos/workshop simultâneos; não representa a carga horária possível de um participante.

Nome, `kind: "admin-test"` e código são fixos. O marcador `TESTE-ADMIN-SEM-VALIDADE` não corresponde ao formato hexadecimal de 32 caracteres dos certificados reais. QR legível e link levam à mesma consulta inválida; a API pública retorna 404 antes de procurar no banco. O app usa contrato e gerador separados, sem afrouxar a validação de documentos reais. Renderizador e assets V1 permanecem inalterados. Não há certificado, snapshot, revisão ou auditoria de emissão persistidos para o teste.

## Evidências

- TypeScript/build da API e TypeScript/exportação web do app aprovados. Exports/evidências anteriores preservados em pastas separadas.
- Suíte completa: **111 testes do app aprovados**; **146 testes da API aprovados**, 14 dependentes de MySQL ignorados nessa suíte. Runner MySQL isolado: **13 aprovados**, com as 19 migrações existentes; amostra de 28 atividades sem escrever em certificados, presenças ou atividades. O teste de capacidade fora desse runner não foi reexecutado.
- Testes focados repetidos após ajuste de alinhamento: 13 aprovados. Contrato rejeita código real, nome diferente e total inconsistente. Autorização recusa papel ADMIN forjado no JWT, permite dois ADMIN e bloqueia participante/anônimo. UI cobre falha/retry, clique duplicado e cancelamento ao sair, trocar de conta ou entrar na visão de participante.
- E2E com Edge local e no domínio publicado, API inteiramente sintética, em **320/1280 px**: botão ADMIN, ausência para USER, falha de duração, download de teste, histórico/seleção sem alteração, nenhuma emissão real e rejeição do código de teste. Screenshots inspecionados; sem overflow ou erros de página.
- Endpoint externo real após deploy: anônimo **401**, USER **403**, dois ADMIN **200**, código de teste público **404**, sem cache, 28 atividades/2370 minutos e ausência do teste no histórico. Tokens de 60 segundos criados apenas em memória remota; não houve login por senha, refresh ou sessão persistida.
- PDF gerado localmente com a resposta da API publicada: **4 páginas**, 28 atividades uma vez, total idêntico na capa/anexo, três logos e avisos de teste em todas as páginas. Todas as páginas renderizadas e inspecionadas. QR decodificado independentemente em todas; o leitor sobre a página inteira não localizou o símbolo numa tentativa, então a leitura foi repetida focalizando sua região, sem alterar o documento.
- API pública real e app publicado também conferidos em 320/1280 px: certificado histórico válido com 11 atividades/780 minutos, download, códigos desconhecidos/ inválidos rejeitados e rota privada protegida para anônimo. Isso é leitura, não reemissão.

## Preservação e limites

Comparação antes/depois do deploy e das consultas administrativas: **cinco certificados existentes** com o mesmo hash agregado; atividades e presenças com os mesmos hashes integrais. `CERTIFICATES_ENABLED=true` e `CERTIFICATE_YEAR=2026` preservados, 19 migrações concluídas, nenhuma migração nova. Não houve alteração de conta, presença, duração, título, certificado ou flag de produção.

Backups/PDFs/dados locais anteriores foram mantidos fora dos commits e uploads. Só o schema aleatório criado pelo runner foi removido; o novo MySQL temporário da porta 3314 foi desligado após confirmar seu datadir. Outros processos MySQL não foram reutilizados nem encerrados.

Login interativo/refresh ADMIN no navegador, leitura por câmera física e testes de carga na Railway não foram comprovados. O fluxo visual privado publicado usa API sintética; a autorização e os dados reais foram conferidos separadamente no endpoint externo. A próxima edição continua exigindo aprovação e metadados/modelo compatíveis; esta publicação não habilita outra edição.

## Manutenção e rollback

Ver [contrato](../../funcionalidades/certificados.md), [guia da tela](https://github.com/secompufscar/secomp-app-xiv/blob/main/docs/my-certificates-web.md#certificado-de-teste-para-admin) e [mapa do visual](https://github.com/secompufscar/secomp-app-xiv/blob/main/docs/certificate-maintenance.md). Ajustar somente `certificateAdminPreviewDocument.ts` para o visual administrativo; não alterar o V1 dos documentos reais. Manter os marcadores de teste e a rejeição do código como invariantes.

Rollback conservador: retirar primeiro o app com o botão; depois retirar o endpoint da API, se necessário. A prévia não tem schema ou dados emitidos a desfazer. Não revogar certificados reais nem apagar snapshots como parte desse rollback.
