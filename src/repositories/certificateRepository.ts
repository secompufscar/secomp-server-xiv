import { randomBytes } from "node:crypto";
import { prisma } from "../lib/prisma";
import { lockEditionState } from "./editionState";
import { certificateActivities, CertificateSnapshot } from "../services/certificatePolicy";
import { ApiError, ErrorsCode } from "../utils/api-errors";

export const CERTIFICATE_YEAR = 2026;
export const CERTIFICATE_CODE = /^[A-F0-9]{32}$/;

export async function issueCertificate(userId: string) {
  return prisma.$transaction(async tx => {
    // Serialize issuance against attendance/edition writes and concurrent retries.
    await lockEditionState(tx, true);
    const event = await tx.event.findUnique({ where: { year: CERTIFICATE_YEAR } });
    if (!event) throw new ApiError("Edição XIV não encontrada.", ErrorsCode.NOT_FOUND);
    const existing = await tx.certificate.findUnique({ where: { userId_eventId: { userId, eventId: event.id } } });
    if (existing) return existing;
    if (process.env.CERTIFICATES_ENABLED !== "true") {
      throw new ApiError("A emissão de certificados ainda não foi liberada pela organização.", ErrorsCode.CONFLICT);
    }
    const user = await tx.user.findUnique({ where: { id: userId }, select: { nome: true } });
    if (!user) throw new ApiError("Participante não encontrado.", ErrorsCode.NOT_FOUND);
    const rows = await tx.userAtActivity.findMany({
      where: { userId, presente: true, activity: { eventId: event.id } },
      include: { activity: { include: { categoria: true } } },
    });
    const activities = certificateActivities(event.id, rows);
    const snapshot: CertificateSnapshot = { version: 1,
      event: { year: event.year, startDate: event.startDate.toISOString(), endDate: event.endDate.toISOString() }, activities };
    const totalMinutes = activities.reduce((sum, a) => sum + a.minutes, 0);
    const code = randomBytes(16).toString("hex").toUpperCase();
    const url = new URL(process.env.CERTIFICATE_VALIDATION_URL || "https://secomp-app-xiv.vercel.app/certificados");
    if (url.protocol !== "https:" || url.username || url.password || url.hash || url.search) {
      throw new ApiError("Endereço de validação não configurado corretamente.", ErrorsCode.INTERNAL_ERROR);
    }
    url.searchParams.set("codigo", code);
    return tx.certificate.create({ data: { code, userId, eventId: event.id, participantName: user.nome,
      totalMinutes, snapshot: { ...snapshot }, validationUrl: url.toString() } });
  }, { maxWait: 10000, timeout: 10000 });
}

export async function findCertificate(code: string) {
  if (!CERTIFICATE_CODE.test(code)) throw new ApiError("Certificado não encontrado.", ErrorsCode.NOT_FOUND);
  const certificate = await prisma.certificate.findUnique({ where: { code } });
  if (!certificate) throw new ApiError("Certificado não encontrado.", ErrorsCode.NOT_FOUND);
  return certificate;
}

export async function setActivityDuration(id: string, durationMinutes: number | null, durationSource: string | null, certificateExcluded = false) {
  return prisma.$transaction(async tx => {
    await lockEditionState(tx, true);
    const activity = await tx.activity.findUnique({ where: { id }, include: { event: true } });
    if (!activity || activity.event?.year !== CERTIFICATE_YEAR) throw new ApiError("Atividade da XIV SECOMP não encontrada.", ErrorsCode.NOT_FOUND);
    return tx.activity.update({ where: { id }, data: { durationMinutes, durationSource, certificateExcluded },
      select: { id: true, durationMinutes: true, durationSource: true, certificateExcluded: true } });
  });
}
