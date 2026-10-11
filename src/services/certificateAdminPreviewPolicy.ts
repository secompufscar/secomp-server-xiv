import { certifiableActivities, type CertificateActivity } from "./certificatePolicy";
import { ApiError, ErrorsCode } from "../utils/api-errors";

// Approved XIV test-only selection; IDs avoid depending on mutable titles/categories.
const xivMinicourses = [
  "0e565043-6f60-4410-8f00-f0d13b57a252", // SDD (preferred)
  "383ce644-7adf-488f-a2ff-54cc9a59a25a",
  "3cedaffd-ecdb-4c63-a21f-d268960eadf5",
  "57d36c80-a4bd-4371-9eed-b2506f8aedd2",
];
const xivWorkshop = "ef2d9f85-77f9-4009-8cc2-aed0f9c3adb2";

export function adminPreviewActivities(eventId: string, year: number, rows: CertificateActivity[]) {
  if (year !== 2026) return certifiableActivities(eventId, rows, "edition");
  const selected = xivMinicourses.find(id => rows.some(activity => activity.id === id
    && activity.eventId === eventId && !activity.certificateExcluded));
  if (!selected) {
    throw new ApiError("Não há minicurso do bloco simultâneo da XIV SECOMP disponível para gerar o teste.", ErrorsCode.CONFLICT);
  }
  return certifiableActivities(eventId, rows.filter(activity => activity.id !== xivWorkshop
    && (!xivMinicourses.includes(activity.id) || activity.id === selected)), "edition");
}
