import { ApiError, ErrorsCode } from "../utils/api-errors";

export type CertificatePresentation = {
  edition: string;
  eventName: string;
  issuer: string;
  city: string;
  location: string;
  templateId: string;
};

export const legacyXivPresentation: Readonly<CertificatePresentation> = Object.freeze({
  edition: "XIV", eventName: "Semana Acadêmica da Computação", issuer: "UFSCar",
  city: "São Carlos", location: "São Carlos - SP", templateId: "secomp-landscape-v1",
});

// Only approved editions belong here; do not derive their numbering from the year.
export const certificateEditions: Record<number, CertificatePresentation> = { 2026: { ...legacyXivPresentation } };

export function certificateYear() {
  const configured = process.env.CERTIFICATE_YEAR ?? "2026";
  if (!/^\d{4}$/.test(configured) || !certificateEditions[Number(configured)]) {
    throw new ApiError("Edição de certificados não configurada pela organização.", ErrorsCode.CONFLICT);
  }
  return Number(configured);
}

export function editionPresentation(year: number): CertificatePresentation {
  const presentation = certificateEditions[year];
  if (!presentation) throw new ApiError("Edição de certificados não configurada pela organização.", ErrorsCode.CONFLICT);
  return { ...presentation };
}

export function snapshotPresentation(snapshot: { version: number; event: { year: number }; presentation?: CertificatePresentation }): CertificatePresentation {
  if (snapshot?.version === 1 && snapshot.event?.year === 2026) return { ...legacyXivPresentation };
  if (snapshot?.version === 2 && snapshot.presentation) return { ...snapshot.presentation };
  throw new ApiError("Versão do certificado não suportada.", ErrorsCode.INTERNAL_ERROR);
}
