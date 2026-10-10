import { randomBytes } from "node:crypto";
import { Certificate, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { lockEditionState } from "./editionState";
import { certificateActivities, CertificateSnapshot } from "../services/certificatePolicy";
import { ApiError, ErrorsCode } from "../utils/api-errors";

export const CERTIFICATE_YEAR = 2026;
export const CERTIFICATE_CODE = /^[A-F0-9]{32}$/;

function requireActive(certificate: Certificate) {
  if (certificate.revokedAt) throw new ApiError("Certificado revogado. Entre em contato com a organização.", ErrorsCode.GONE);
  return certificate;
}

async function certificateData(tx: Prisma.TransactionClient, userId: string, event: { id: string; year: number; startDate: Date; endDate: Date }) {
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
  return { code, userId, eventId: event.id, participantName: user.nome,
    totalMinutes, snapshot: { ...snapshot }, validationUrl: url.toString() };
}

export async function issueCertificate(userId: string) {
  return prisma.$transaction(async tx => {
    // Serialize issuance against attendance/edition writes and concurrent retries.
    await lockEditionState(tx, true);
    const event = await tx.event.findUnique({ where: { year: CERTIFICATE_YEAR } });
    if (!event) throw new ApiError("Edição XIV não encontrada.", ErrorsCode.NOT_FOUND);
    const existing = await tx.certificate.findFirst({ where: { userId, eventId: event.id }, orderBy: { revision: "desc" } });
    if (existing) return requireActive(existing);
    return tx.certificate.create({ data: await certificateData(tx, userId, event) });
  }, { maxWait: 10000, timeout: 10000 });
}

export async function findCertificate(code: string) {
  if (!CERTIFICATE_CODE.test(code)) throw new ApiError("Certificado não encontrado.", ErrorsCode.NOT_FOUND);
  const certificate = await prisma.certificate.findUnique({ where: { code } });
  if (!certificate) throw new ApiError("Certificado não encontrado.", ErrorsCode.NOT_FOUND);
  return requireActive(certificate);
}

function correctionReason(reason: string) {
  if (!reason.trim() || reason.trim().length > 500) throw new ApiError("Informe o motivo da correção (até 500 caracteres).", ErrorsCode.BAD_REQUEST);
  return reason.trim();
}

async function correctionTarget(tx: Prisma.TransactionClient, code: string) {
  if (!CERTIFICATE_CODE.test(code)) throw new ApiError("Certificado não encontrado.", ErrorsCode.NOT_FOUND);
  const certificate = await tx.certificate.findUnique({ where: { code }, include: { event: true } });
  if (!certificate || certificate.event.year !== CERTIFICATE_YEAR) throw new ApiError("Certificado não encontrado.", ErrorsCode.NOT_FOUND);
  return certificate;
}

export async function revokeCertificate(code: string, adminId: string, reason: string) {
  const revocationReason = correctionReason(reason);
  return prisma.$transaction(async tx => {
    await lockEditionState(tx, true);
    const certificate = await correctionTarget(tx, code);
    if (certificate.revokedAt) return { code, revokedAt: certificate.revokedAt };
    const revoked = await tx.certificate.update({ where: { id: certificate.id }, data: {
      activeSlot: null, revokedAt: new Date(), revokedBy: adminId, revocationReason,
    } });
    return { code: revoked.code, revokedAt: revoked.revokedAt };
  }, { maxWait: 10000, timeout: 10000 });
}

export async function reissueCertificate(code: string, adminId: string, reason: string) {
  const reissueReason = correctionReason(reason);
  return prisma.$transaction(async tx => {
    await lockEditionState(tx, true);
    const certificate = await correctionTarget(tx, code);
    const replacement = await tx.certificate.findUnique({ where: { replacesId: certificate.id } });
    if (replacement) return requireActive(replacement);
    // Prepare and validate first. A failed correction must leave the original valid.
    const data = await certificateData(tx, certificate.userId, certificate.event);
    if (!certificate.revokedAt) await tx.certificate.update({ where: { id: certificate.id }, data: {
      activeSlot: null, revokedAt: new Date(), revokedBy: adminId, revocationReason: reissueReason,
    } });
    return tx.certificate.create({ data: { ...data, revision: certificate.revision + 1,
      replacesId: certificate.id, reissuedBy: adminId, reissueReason } });
  }, { maxWait: 10000, timeout: 10000 });
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
