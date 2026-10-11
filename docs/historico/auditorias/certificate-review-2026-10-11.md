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
- A verificação online do primeiro deploy desta revisão detectou uma lacuna nos testes: rota removida caía no banner global HTTP 200. O teste agora monta o namespace com esse fallback e reproduziu `200 !== 404` antes da correção. Uma resposta terminal 404 dentro de certificados evita o sucesso falso, sem alterar a raiz ou as outras áreas da API.

Esses casos são regressões locais reproduzíveis, não evidência de incidente em produção. Nenhum certificado foi emitido, reemitido ou revogado para ensaiá-los.

## Remoção e regressões

API sem rota `/certificates/admin/preview`, repositório ou política de amostra. App sem botão, serviço, contrato, adaptador ou download administrativo. As fixtures sintéticas permanecem nos testes do gerador real, não em uma funcionalidade publicada. Os marcadores fictícios antigos continuam rejeitados antes do banco; testes da rota exigem 404 para ADMIN/USER/anônimo e os dois formatos antigos.

Mantidos os testes reais de duração/exclusões, credenciamento, snapshot, revisão/proprietário, QR, fontes/logos, rodapé, alinhamentos e paginação. Adicionados testes de contrato malformado, divergência do código, revogação antes do download, cancelamento, retry e resposta antiga concorrente. E2E usa APIs totalmente sintéticas em 320/1280 px.

## Verificação e publicação

Verificação local: TypeScript de ambos os projetos aprovado; build da API aprovado; app com 119 testes aprovados; API com 144 aprovados e 14 dependentes de MySQL ignorados na suite comum. A primeira execução HTTP da API encontrou EACCES nas conexões localhost do sandbox; a repetição com rede local permitida passou. Exportação web inicialmente bloqueada por EPERM na leitura de dependência; repetição com dois workers aprovada. E2E local aprovado em 320/1280 px, sem requisições à API real; screenshots inspecionados, inclusive ADMIN sem amostra. Depois da descoberta do fallback, os 12 testes focados de certificados/histórico passaram com o prefixo e banner da aplicação. Os testes do PDF decodificam também os QRs de todos os anexos extensos.

Integração separada: [API #47](https://github.com/secompufscar/secomp-server-xiv/pull/47), merge `d82a2f9c`, CI do PR e merge aprovadas, incluindo MySQL isolado (runs `38182260658` e `38182507181`). Railway `1f6b518b-be8e-4e2f-8b5d-d155ea997acb` SUCCESS. A consulta online revelou o fallback 200 citado acima, não uma geração administrativa remanescente. O complemento HTTP e a comprovação final de publicação estão no [PR #48](https://github.com/secompufscar/secomp-server-xiv/pull/48); sua descrição registra o deployment efetivamente verificado, sem inferi-lo do merge.

[App #46](https://github.com/secompufscar/secomp-app-xiv/pull/46), merge `97f8578f`: CI do PR aprovada (`38182350789`), incluindo build/E2E; preview Vercel `9mSzFo15YYaosQFKvTENTKiNAnas` e produção [3RjcGPqURwBPk26YgChDynF5JF4a](https://vercel.com/secomp-tis-projects/secomp-app-xiv/3RjcGPqURwBPk26YgChDynF5JF4a) com sucesso. A CI do merge é conferida separadamente, não substituída pela CI do PR. O balanço final fica na descrição dos PRs vinculados.

Baseline preservado antes do deploy: seis registros de certificado, 19 migrações concluídas, emissão habilitada e ano configurado 2026. Contagens/hashes integrais de certificados, atividades e presenças ficam somente em evidência privada; a verificação final compara-os sem emitir/reemitir/revogar ou alterar configuração. O deployment anterior do app `dacb794f` falhou; a organização apontou possível cota da Vercel, mas não havia acesso aos logs para comprovar a causa. A nova produção confirmou sucesso; nenhuma alteração de plano/cobrança foi feita.

## Limites e limpeza

Não há prova de ausência de todos os bugs, login interativo/refresh real, câmera física ou capacidade de carga em produção. Revogação ocorrida depois da última consulta ainda pode tornar inválido um PDF já baixado; a consulta pública é a autoridade atual.

A limpeza usa lista explícita de caminhos conhecidos, resolução absoluta e verificação de contenção no workspace. Nunca excluir todo `tmp`, datadir MySQL, backups SQL, arquivos pessoais, PDFs reais ou o diretório privado de evidências. Remoções remotas de arquivos versionados acontecem por commits/PRs, sem apagar histórico Git. Não apagar deployments ou dados acadêmicos para limpar outputs locais.

Inventário aprovado da primeira limpeza: 159 caminhos, 3520 arquivos, 393215914 bytes (aproximadamente 393 MB decimais). Inclui exports antigos, amostras ilustrativas/ADMIN, relatórios intermediários públicos e scripts auxiliares; exclui todos os datadirs e a pasta privada inteira. Cinco processos de preview obsoletos foram encerrados somente após conferir PID e comando exatos. O build/evidência desta revisão permanece até concluir a verificação.

Limpeza remota: 35 artefatos sintéticos antigos `certificate-test-evidence` excluídos (76020447 bytes), após conferir ID, nome, data e commit integrado na main. Outputs desta revisão, logs e históricos de execuções/commits permanecem. Branches antigas da amostra e versões já integradas foram removidas somente sem commits exclusivos e sem worktree anexa; branches de outras funcionalidades não são alvo dessa limpeza.
