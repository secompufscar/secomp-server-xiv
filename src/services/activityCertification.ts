import { isCredentialingCategory } from "../repositories/participantDirectoryRepository";
import { ApiError, ErrorsCode } from "../utils/api-errors";

export const DEFAULT_DURATION_SOURCE = "Duração oficial informada pela organização no cadastro da atividade.";

export function isAlwaysNonCertifiable(activity: { nome: string; categoria: { nome: string; slug: string } }) {
  const name = activity.nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
  return isCredentialingCategory(activity.categoria)
    || /^(abertura|encerramento|camisetas?|coff?ee?|lual|luau|feira da comp)(?:$|\b)/.test(name);
}

export function assertCertificationAllowed(activity: { nome: string; categoria: { nome: string; slug: string }; certificateExcluded: boolean }) {
  if (!activity.certificateExcluded && isAlwaysNonCertifiable(activity)) {
    throw new ApiError("Credenciamento, abertura, encerramento, Camisetas, Coffee, Lual e Feira da Comp não são certificáveis.", ErrorsCode.BAD_REQUEST);
  }
}
