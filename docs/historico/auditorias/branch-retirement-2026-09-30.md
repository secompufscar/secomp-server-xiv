# Encerramento de branches incorporadas — 30/09/2026

Registro de implementação/auditoria preservado para rastreabilidade. O estado vigente está no [roadmap](../../roadmap.md).

Após autorização do responsável pelo repositório, sete branches remotas de PRs mergeados foram removidas. Preservadas `main` e `codex/verified-email-change`, do PR #22 ainda aberto na consulta. Não houve alteração de código, merge adicional, deploy ou migração de produção.

## Verificação e referências

O remoto foi atualizado e o GitHub confirmou os PRs #14–20 como mergeados. `origin/main` estava em `8b221cc79113b651e89fbf45ed30021606ed2f24`.

| Branch removida | PR | Último commit remoto | Evidência de incorporação |
| --- | --- | --- | --- |
| `codex/p1-registration-cancellation` | [#14](https://github.com/secompufscar/secomp-server-xiv/pull/14) | `15ee7fccd27849634ff71420b9b3fc4c2734006b` | Ancestral de main |
| `codex/urgent-auth-web-safety` | [#15](https://github.com/secompufscar/secomp-server-xiv/pull/15) | `39f46fafcc5104d61053c03b45dd81eb769b952d` | Só merge adicional do #16; árvore igual a `867c71d`, sem commits técnicos exclusivos em `git cherry` |
| `codex/single-use-password-recovery` | [#16](https://github.com/secompufscar/secomp-server-xiv/pull/16) | `867c71da1d4bb4e5c739c32b485421df4742b3ad` | Ancestral de main |
| `codex/event-critical-fixes` | [#17](https://github.com/secompufscar/secomp-server-xiv/pull/17) | `e67f2f1e1c6b7e2bccfde74d91be21a55966aa91` | Ancestral de main |
| `codex/shared-network-rate-limits` | [#18](https://github.com/secompufscar/secomp-server-xiv/pull/18) | `88f45141014cf7d612a1c0242ef9464e3636b7ab` | Ancestral de main |
| `codex/edition-registration-consistency` | [#19](https://github.com/secompufscar/secomp-server-xiv/pull/19) | `3307eaa14d9bbd3e82b98d8c22d53371bed25ebb` | Ancestral de main |
| `codex/signup-recovery` | [#20](https://github.com/secompufscar/secomp-server-xiv/pull/20) | `50bb744bfaa46cf7ea574fdf0d399fab0fd63c09` | Ancestral de main |

A exclusão foi atômica e condicionada aos SHAs acima (`--force-with-lease` para cada referência): qualquer atualização concorrente impediria a operação. Git confirmou a exclusão dos sete nomes. Os PRs e as mudanças incorporadas permanecem no histórico.

Antes da exclusão foram criadas referências locais `refs/archive/branch-retirement-20260930/<nome-da-branch>` para cada SHA, inclusive o merge adicional `39f46fa`. Branches locais e arquivos de trabalho foram preservados. As referências de arquivo são locais, não backups remotos; este documento também registra os SHAs para consulta nos PRs.

Se necessário, uma branch pode ser recriada a partir da referência local correspondente. Exemplo de recuperação autorizada separadamente:

```sh
git push origin refs/archive/branch-retirement-20260930/codex/urgent-auth-web-safety:refs/heads/codex/urgent-auth-web-safety
```

Eliminar uma branch incorporada não substitui a validação de deploy e banco. O estado operacional continua sendo acompanhado no [roadmap](../../roadmap.md).
