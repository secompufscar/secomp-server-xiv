import { Router } from "express";
import { Certificate } from "@prisma/client";
import QRCode from "qrcode";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import { authMiddleware, isAdmin } from "../middlewares/authMiddleware";
import { findCertificate, issueCertificate, setActivityDuration, revokeCertificate, reissueCertificate, listMyCertificates, findMyCertificate, certificateExample } from "../repositories/certificateRepository";
import { CertificateSnapshot } from "../services/certificatePolicy";
import { snapshotPresentation } from "../services/certificateEditions";

export async function certificateResponse(certificate: Pick<Certificate, "code" | "participantName" | "totalMinutes" | "issuedAt" | "validationUrl"> & { snapshot: unknown }) {
  const snapshot = certificate.snapshot as unknown as CertificateSnapshot;
  return { code: certificate.code, participantName: certificate.participantName, totalMinutes: certificate.totalMinutes,
    issuedAt: certificate.issuedAt, event: snapshot.event, presentation: snapshotPresentation(snapshot),
    activities: snapshot.activities.map(({ source: _source, id: _id, ...activity }) => activity),
    validationUrl: certificate.validationUrl,
    qrCode: await QRCode.toDataURL(certificate.validationUrl, { errorCorrectionLevel: "M", width: 300, margin: 4 }) };
}

const routes = Router();
routes.use((_req, res, next) => { res.setHeader("Cache-Control", "no-store"); next(); });
routes.get("/validate/:code", rateLimit({ windowMs: 60000, limit: 120, standardHeaders: "draft-8", legacyHeaders: false }), async (req, res) => {
  res.json(await certificateResponse(await findCertificate(req.params.code)));
});
routes.get("/mine", authMiddleware, rateLimit({ windowMs: 60000, limit: 60, standardHeaders: "draft-8", legacyHeaders: false,
  keyGenerator: req => req.user.id! }), async (req, res) => {
  res.json({ certificates: await listMyCertificates(req.user.id!) });
});
routes.get("/mine/:code", authMiddleware, rateLimit({ windowMs: 60000, limit: 60, standardHeaders: "draft-8", legacyHeaders: false,
  keyGenerator: req => req.user.id! }), async (req, res) => {
  res.json(await certificateResponse(await findMyCertificate(req.user.id!, req.params.code)));
});
routes.post("/mine", authMiddleware, rateLimit({ windowMs: 60000, limit: 20, standardHeaders: "draft-8", legacyHeaders: false,
  keyGenerator: req => req.user.id! }), async (req, res) => {
  res.json(await certificateResponse(await issueCertificate(req.user.id!)));
});
routes.get("/admin/example", authMiddleware, isAdmin, rateLimit({ windowMs: 60000, limit: 20, standardHeaders: "draft-8", legacyHeaders: false,
  keyGenerator: req => req.user.id! }), async (_req, res) => {
  res.json(await certificateResponse(await certificateExample()));
});
const durationSchema = z.object({
  durationMinutes: z.number().int().min(1).max(10080).nullable(),
  durationSource: z.string().trim().min(1).max(500).nullable(),
  certificateExcluded: z.boolean().default(false),
}).strict().refine(value => (value.durationMinutes === null) === (value.durationSource === null))
  .refine(value => !value.certificateExcluded || value.durationMinutes === null);
routes.put("/activities/:id/duration", authMiddleware, isAdmin, async (req, res) => {
  const data = durationSchema.safeParse(req.body);
  if (!z.string().uuid().safeParse(req.params.id).success || !data.success) {
    return res.status(400).json({ message: "Informe os minutos e a fonte oficial da duração, ou ambos nulos para limpar." });
  }
  res.json(await setActivityDuration(req.params.id, data.data.durationMinutes, data.data.durationSource, data.data.certificateExcluded));
});
const correctionSchema = z.object({ reason: z.string().trim().min(1).max(500) }).strict();
for (const operation of ["revoke", "reissue"] as const) {
  routes.post(`/:code/${operation}`, authMiddleware, isAdmin, async (req, res) => {
    const data = correctionSchema.safeParse(req.body);
    if (!data.success) return res.status(400).json({ message: "Informe o motivo da correção (até 500 caracteres)." });
    if (operation === "revoke") return res.json(await revokeCertificate(req.params.code, req.user.id!, data.data.reason));
    res.json(await certificateResponse(await reissueCertificate(req.params.code, req.user.id!, data.data.reason)));
  });
}
// Do not let unknown certificate paths reach the application's generic 200 banner.
routes.use((_req, res) => { res.status(404).json({ message: "Rota de certificados não encontrada." }); });
export default routes;
