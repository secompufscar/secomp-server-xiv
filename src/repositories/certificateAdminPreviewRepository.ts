import QRCode from "qrcode";
import { prisma } from "../lib/prisma";
import { lockEditionState } from "./editionState";
import { adminPreviewActivities } from "../services/certificateAdminPreviewPolicy";
import { certificateYear, editionPresentation } from "../services/certificateEditions";
import { ApiError, ErrorsCode } from "../utils/api-errors";

export const ADMIN_TEST_CODE = "TESTE-ADMIN-SEM-VALIDADE";
export const ADMIN_EXAMPLE_CODE = "0000000000000000000000000000000G";

export async function adminCertificatePreview(example = false) {
  const data = await prisma.$transaction(async tx => {
    await lockEditionState(tx);
    const event = await tx.event.findUnique({ where: { year: certificateYear() } });
    if (!event) throw new ApiError("Edição de certificados não encontrada.", ErrorsCode.NOT_FOUND);
    const activities = adminPreviewActivities(event.id, event.year, await tx.activity.findMany({
      where: { eventId: event.id }, include: { categoria: true },
    }));
    return { kind: "admin-test" as const, code: example ? ADMIN_EXAMPLE_CODE : ADMIN_TEST_CODE,
      participantName: example ? "Nome de Exemplo" : "Certificado Admin [ TESTE ]",
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
  url.searchParams.set("codigo", data.code);
  return { ...data, validationUrl: url.toString(),
    qrCode: await QRCode.toDataURL(url.toString(), { errorCorrectionLevel: "M", width: 300, margin: 4 }) };
}
