# Durações confirmadas da XIV SECOMP

Definições finais da organização recebidas em 10/10/2026, sobre a programação consultada em 09/10. Não há duração pendente nessa programação. As definições não equivalem à aplicação no banco nem à habilitação da emissão.

| Atividades | Minutos certificados |
| --- | --- |
| Palestras em geral, incluindo Monks, Bitcoin e as das 11h | 60 cada, sem almoço |
| SDD (Rogério), Running Bitcoin, PET Cibersegurança, Arquitetura de soluções (Bruno) | 180 cada |
| Workshop da Karina: A Nova Fronteira do Cyber é a Proteção Humana | 150 |
| Maratona M@U | 150 |
| Mesa-redonda de curricularização da extensão | 60 |
| Empreendedorismo & Tecnologia | 60 |
| Mesa Monks | 90, intervalo 19h–20h30 no mesmo local, conforme regra anterior |
| Credenciamento, Feira da Comp, Camisetas, Coffee, Lual, abertura e encerramento | Excluídos da soma e do anexo |

A regra final de palestras de 60 minutos substitui a estimativa anterior de 80 minutos da palestra de Bitcoin. Intervalos de almoço não são contabilizados. Os quatro minicursos ocorreram simultaneamente ao workshop, mas cada atividade mantém sua duração aprovada. O credenciamento continua obrigatório para comprovar a doação.

## Aplicação controlada

O arquivo [xiv-durations.json](../../scripts/certificates/xiv-durations.json) contém os 37 IDs e nomes conferidos, com 28 atividades certificáveis e nove registros excluídos (três Camisetas, três Coffee, Feira, Lual e Encerramento). Credenciamento tem regra própria de exclusão. Abertura não tinha registro separado na consulta; caso exista com o nome `Abertura`, a política a exclui independentemente de duração, ignorando caixa/espaços externos. Outros nomes de abertura devem receber marcação explícita de exclusão.

Após merge/publicação da API e aplicação das migrações, no ambiente autorizado:

```sh
node scripts/certificates/configure-durations.cjs --check
node scripts/certificates/configure-durations.cjs --apply
```

Sem argumento ou com `--check`, nenhuma escrita é realizada. A aplicação exige a edição 2026, todos os IDs/nomes do plano e valores vazios ou já idênticos ao plano. Se encontrar atividade removida, renomeada ou configuração divergente, recusa todas as alterações. A transação usa a barreira de edição/presença; execuções repetidas são idempotentes. Atividades fora do plano são relatadas para revisão e não recebem duração presumida.

O plano não altera horário, categoria, pontuação, presença ou certificados já emitidos. As migrações apenas adicionam armazenamento/restrições. `CERTIFICATES_ENABLED` continua falso até a revisão e publicação da validação pública.
