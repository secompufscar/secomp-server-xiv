import QRCode from "qrcode";
import { prisma } from "../lib/prisma";
import { lockEditionState } from "./editionState";
import { certifiableActivities } from "../services/certificatePolicy";
import { certificateYear, editionPresentation } from "../services/certificateEditions";
import { ApiError, ErrorsCode } from "../utils/api-errors";

export const ADMIN_TEST_CODE = "TESTE-ADMIN-SEM-VALIDADE";

export async function adminCertificatePreview() {
  const data = await prisma.$transaction(async tx => {
    await lockEditionState(tx);
    const event = await tx.event.findUnique({ where: { year: certificateYear() } });
    if (!event) throw new ApiError("Edição de certificados não encontrada.", ErrorsCode.NOT_FOUND);
    const activities = certifiableActivities(event.id, await tx.activity.findMany({
      where: { eventId: event.id }, include: { categoria: true },
    }), "edition");
    return { kind: "admin-test" as const, code: ADMIN_TEST_CODE, participantName: "Certificado Admin [ TESTE ]",
      issuedAt: new Date().toISOString(), totalMinutes: activities.reduce((sum, activity) => sum + activity.minutes, 0),
      event: { year: event.year, startDate: event.startDate.toISOString(), endDate: event.endDate.toISOString() },
      presentation: editionPresentation(event.year),
      activities: activities.map(({ id: _id, source: _source, ...activity }) => activity) };
  }, { maxWait: 10000, timeout: 10000 });
  const url = new URL(process.env.CERTIFICATE_VALIDATION_URL || "https://secomp-app-xiv.vercel.app/certificados");
  if (url.protocol !== "https:" || url.username || url.password || url.hash || url.search) {
    throw new ApiError("Endereço de validação não configurado corretamente.", ErrorsCode.INTERNAL_ERROR);
  }
  // This marker can never match the public validator's 32-character hexadecimal code.
  url.searchParams.set("codigo", ADMIN_TEST_CODE);
  return { ...data, validationUrl: url.toString(),
    qrCode: await QRCode.toDataURL(url.toString(), { errorCorrectionLevel: "M", width: 300, margin: 4 }) };
}
