# Revisão dos certificados - 11/10/2026

## Escopo e balanço

Retirada solicitada do fluxo de amostra ADMIN, revisão do contrato/download e limpeza dos artefatos criados durante o trabalho. Preservados os certificados reais, snapshots, planos oficiais, presenças, backups e auditorias reais. Nenhuma alteração de schema, migrações ou flags de emissão é necessária. Os guias de manutenção e próximas edições permanecem; instruções obsoletas e o protótipo Python duplicado saem do checkout. Documentos removidos continuam recuperáveis pelo histórico Git, não por reescrita de commits.

Pontos positivos preservados: emissão explícita e idempotente, credenciamento da mesma edição, durações oficiais, proprietário derivado da sessão, snapshot imutável, revisões auditadas, códigos aleatórios e seleção de modelo persistida. Consultar `docs/funcionalidades/certificados.md` e o mapa visual do app.

## Problemas corrigidos

- Validação pública aceitava um certificado bem formado cujo código fosse diferente do consultado. Agora exige igualdade; teste novo falhou antes da correção.
- Download público reutilizava a consulta anterior sem reconfirmar revogação e sem cancelamento ao editar o código/sair. Agora consulta novamente, descarta respostas canceladas e remove o documento diante de 404/410.
- Download privado não repetia a conferência de ano/edição/modelo do resumo selecionado. A conferência é compartilhada com o carregamento dos detalhes.
- Requisição antiga de download privado mantinha o bloqueio após trocar de edição e podia limpar o estado de outra operação. O controle agora usa identidade do AbortController, sem booleano global de download.
- Contrato aceitava datas de evento/atividade inválidas, categorias ausentes e URL com credenciais, fragmento ou código duplicado. Validação runtime reforçada, sem flexibilizar legado XIV ou modelo desconhecido.

Esses casos são regressões locais reproduzíveis, não evidência de incidente em produção. Nenhum certificado foi emitido, reemitido ou revogado para ensaiá-los.

## Remoção e regressões

API sem rota `/certificates/admin/preview`, repositório ou política de amostra. App sem botão, serviço, contrato, adaptador ou download administrativo. As fixtures sintéticas permanecem nos testes do gerador real, não em uma funcionalidade publicada. Os marcadores fictícios antigos continuam rejeitados antes do banco; testes da rota exigem 404 para ADMIN/USER/anônimo e os dois formatos antigos.

Mantidos os testes reais de duração/exclusões, credenciamento, snapshot, revisão/proprietário, QR, fontes/logos, rodapé, alinhamentos e paginação. Adicionados testes de contrato malformado, divergência do código, revogação antes do download, cancelamento, retry e resposta antiga concorrente. E2E usa APIs totalmente sintéticas em 320/1280 px.

## Verificação e publicação

Verificação local: TypeScript de ambos os projetos aprovado; build da API aprovado; app com 119 testes aprovados; API com 144 aprovados e 14 dependentes de MySQL ignorados na suite comum. O MySQL isolado será confirmado na CI. A primeira execução HTTP da API encontrou EACCES nas conexões localhost do sandbox; a repetição com permissão de rede local passou. Exportação web inicialmente bloqueada por EPERM na leitura de dependência; repetição e E2E em andamento. Não inferir produção a partir de testes ou merge.

Baseline anterior: API `6e7126f6` publicada na Railway (`a168511f-2bbf-47f5-873c-3df7a4e04899`, SUCCESS). App `dacb794f` integrado pelo PR #45 e CI aprovada, mas seu deployment Vercel `A3KgUzduBYK6j6RKeYcMEmRsKmkv` falhou; logs privados não estavam acessíveis. Isso não é prova de publicação do app. A retirada da API deve ser integrada antes do seu deploy; publicar o app em PR separado e conferir o deployment.

## Limites e limpeza

Não há prova de ausência de todos os bugs, login interativo/refresh real, câmera física ou capacidade de carga em produção. Revogação ocorrida depois da última consulta ainda pode tornar inválido um PDF já baixado; a consulta pública é a autoridade atual.

A limpeza usa lista explícita de caminhos conhecidos, resolução absoluta e verificação de contenção no workspace. Nunca excluir todo `tmp`, datadir MySQL, backups SQL, arquivos pessoais, PDFs reais ou o diretório privado de evidências. Remoções remotas de arquivos versionados acontecem por commits/PRs, sem apagar histórico Git. Não apagar deployments ou dados acadêmicos para limpar outputs locais.

Inventário aprovado da primeira limpeza: 159 caminhos, 3520 arquivos, 393215914 bytes (aproximadamente 393 MB decimais). Inclui exports antigos, amostras ilustrativas/ADMIN, relatórios intermediários públicos e scripts auxiliares; exclui todos os datadirs e a pasta privada inteira. Cinco processos de preview obsoletos foram encerrados somente após conferir PID e comando exatos. O build/evidência desta revisão permanece até concluir a verificação.
