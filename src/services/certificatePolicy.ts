import { isCredentialingCategory } from "../repositories/participantDirectoryRepository";
import { ApiError, ErrorsCode } from "../utils/api-errors";
import type { CertificatePresentation } from "./certificateEditions";

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
  version: 1 | 2;
  presentation?: CertificatePresentation;
  event: { year: number; startDate: string; endDate: string };
  activities: { id: string; name: string; category: string; startsAt: string | null; minutes: number; source: string }[];
}

export function certificateActivities(eventId: string, rows: { presente: boolean; activity: CertificateActivity }[]) {
  const present = rows.filter(row => row.presente && row.activity.eventId === eventId);
  if (!present.some(row => isCredentialingCategory(row.activity.categoria))) {
    throw new ApiError("É necessário ter credenciamento confirmado nesta edição para emitir o certificado.", ErrorsCode.FORBIDDEN);
  }
  return certifiableActivities(eventId, present.map(row => row.activity));
}

export function certificateExampleActivities(eventId: string, year: number, rows: CertificateActivity[]) {
  // Approved XIV simultaneous block: one minicourse, without Karina's workshop.
  const minicourses = ["0e565043-6f60-4410-8f00-f0d13b57a252", "383ce644-7adf-488f-a2ff-54cc9a59a25a", "3cedaffd-ecdb-4c63-a21f-d268960eadf5", "57d36c80-a4bd-4371-9eed-b2506f8aedd2"];
  if (year !== 2026) throw new ApiError("Seleção de atividades do exemplo não configurada para esta edição.", ErrorsCode.CONFLICT);
  const selected = minicourses.find(id => rows.some(a => a.id === id && a.eventId === eventId && !a.certificateExcluded));
  if (!selected) throw new ApiError("Não há minicurso do bloco simultâneo disponível para o exemplo.", ErrorsCode.CONFLICT);
  return certifiableActivities(eventId, rows.filter(a => a.id !== "ef2d9f85-77f9-4009-8cc2-aed0f9c3adb2"
    && (!minicourses.includes(a.id) || a.id === selected)));
}

function certifiableActivities(eventId: string, rows: CertificateActivity[]) {
  const activities = [...new Map(rows.filter(activity => activity.eventId === eventId
    && !isCredentialingCategory(activity.categoria) && !activity.certificateExcluded
    && !["abertura", "encerramento"].includes(activity.nome.trim().toLocaleLowerCase("pt-BR")))
    .map(activity => [activity.id, activity])).values()];
  if (!activities.length) throw new ApiError("Não há atividades com presença registrada para certificar.", ErrorsCode.CONFLICT);
  if (activities.some(a => !Number.isInteger(a.durationMinutes) || a.durationMinutes! <= 0 || a.durationMinutes! > 10080 || !a.durationSource?.trim())) {
    throw new ApiError("A organização ainda precisa definir a duração oficial de todas as suas atividades com presença.", ErrorsCode.CONFLICT);
  }
  return activities.sort((a, b) => (a.data?.getTime() ?? 0) - (b.data?.getTime() ?? 0) || a.id.localeCompare(b.id))
    .map(a => ({ id: a.id, name: a.nome, category: a.categoria.nome, startsAt: a.data?.toISOString() ?? null,
      minutes: a.durationMinutes!, source: a.durationSource!.trim() }));
}
