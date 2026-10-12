import { SpeakerTitle } from "@prisma/client";

export interface CreateActivityDTOS {
  nome: string;
  data: Date | null;
  palestranteNome: string;
  palestranteTitulo?: SpeakerTitle;
  categoriaId: string;
  eventId?: string;
  vagas: number | null;
  detalhes: string | null;
  local: string;
  localLink?: string | null;
  points: number;
  durationMinutes: number;
  durationSource: string;
  certificateExcluded: boolean;
}

export type UpdateActivityDTOS = Partial<CreateActivityDTOS>;

export interface ActivityDTOS {
  id: string;
  nome: string;
  data: Date | null;
  vagas: number | null;
  detalhes: string | null;
  palestranteNome: string;
  palestranteTitulo?: SpeakerTitle;
  categoriaId: string;
  eventId: string | null;
  localLink?: string | null;
  points: number;
  durationMinutes: number | null;
  durationSource: string | null;
  certificateExcluded: boolean;
  categoria?: {
    id: string;
    nome: string;
    slug: string;
    requiresEnrollment: boolean;
  };
}
