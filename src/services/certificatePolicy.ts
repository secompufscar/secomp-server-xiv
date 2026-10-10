import { isCredentialingCategory } from "../repositories/participantDirectoryRepository";
import { ApiError, ErrorsCode } from "../utils/api-errors";

export interface CertificateActivity {
  id: string;
  nome: string;
  eventId: string | null;
  data: Date | null;
  durationMinutes: number | null;
  durationSource: string | null;
  certificateExcluded?: boolean;
  categoria: { nome: string; slug: string };
}

export interface CertificateSnapshot {
  version: 1;
  event: { year: number; startDate: string; endDate: string };
  activities: { id: string; name: string; category: string; startsAt: string | null; minutes: number; source: string }[];
}

export function certificateActivities(eventId: string, rows: { presente: boolean; activity: CertificateActivity }[]) {
  const present = rows.filter(row => row.presente && row.activity.eventId === eventId);
  if (!present.some(row => isCredentialingCategory(row.activity.categoria))) {
    throw new ApiError("É necessário ter credenciamento confirmado nesta edição para emitir o certificado.", ErrorsCode.FORBIDDEN);
  }
  const activities = [...new Map(present.filter(row => !isCredentialingCategory(row.activity.categoria)
    && !row.activity.certificateExcluded
    && !["abertura", "encerramento"].includes(row.activity.nome.trim().toLocaleLowerCase("pt-BR")))
    .map(row => [row.activity.id, row.activity])).values()];
  if (!activities.length) throw new ApiError("Não há atividades com presença registrada para certificar.", ErrorsCode.CONFLICT);
  if (activities.some(a => !Number.isInteger(a.durationMinutes) || a.durationMinutes! <= 0 || a.durationMinutes! > 10080 || !a.durationSource?.trim())) {
    throw new ApiError("A organização ainda precisa definir a duração oficial de todas as suas atividades com presença.", ErrorsCode.CONFLICT);
  }
  return activities.sort((a, b) => (a.data?.getTime() ?? 0) - (b.data?.getTime() ?? 0) || a.id.localeCompare(b.id))
    .map(a => ({ id: a.id, name: a.nome, category: a.categoria.nome, startsAt: a.data?.toISOString() ?? null,
      minutes: a.durationMinutes!, source: a.durationSource!.trim() }));
}
