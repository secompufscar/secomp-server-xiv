import { Router } from "express";
import { Certificate } from "@prisma/client";
import QRCode from "qrcode";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import { authMiddleware, isAdmin } from "../middlewares/authMiddleware";
import { findCertificate, issueCertificate, setActivityDuration } from "../repositories/certificateRepository";
import { CertificateSnapshot } from "../services/certificatePolicy";

export async function certificateResponse(certificate: Certificate) {
  const snapshot = certificate.snapshot as unknown as CertificateSnapshot;
  return { code: certificate.code, participantName: certificate.participantName, totalMinutes: certificate.totalMinutes,
    issuedAt: certificate.issuedAt, event: snapshot.event,
    activities: snapshot.activities.map(({ source: _source, id: _id, ...activity }) => activity),
    validationUrl: certificate.validationUrl,
    qrCode: await QRCode.toDataURL(certificate.validationUrl, { errorCorrectionLevel: "M", width: 300, margin: 4 }) };
}

const routes = Router();
routes.use((_req, res, next) => { res.setHeader("Cache-Control", "no-store"); next(); });
routes.get("/validate/:code", rateLimit({ windowMs: 60000, limit: 120, standardHeaders: "draft-8", legacyHeaders: false }), async (req, res) => {
  res.json(await certificateResponse(await findCertificate(req.params.code)));
});
routes.post("/mine", authMiddleware, rateLimit({ windowMs: 60000, limit: 20, standardHeaders: "draft-8", legacyHeaders: false,
  keyGenerator: req => req.user.id! }), async (req, res) => {
  res.json(await certificateResponse(await issueCertificate(req.user.id!)));
});
const durationSchema = z.object({
  durationMinutes: z.number().int().min(1).max(10080).nullable(),
  durationSource: z.string().trim().min(1).max(500).nullable(),
}).strict().refine(value => (value.durationMinutes === null) === (value.durationSource === null));
routes.put("/activities/:id/duration", authMiddleware, isAdmin, async (req, res) => {
  const data = durationSchema.safeParse(req.body);
  if (!z.string().uuid().safeParse(req.params.id).success || !data.success) {
    return res.status(400).json({ message: "Informe os minutos e a fonte oficial da duração, ou ambos nulos para limpar." });
  }
  res.json(await setActivityDuration(req.params.id, data.data.durationMinutes, data.data.durationSource));
});
export default routes;
