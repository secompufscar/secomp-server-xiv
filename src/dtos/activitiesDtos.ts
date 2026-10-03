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
}

export interface UpdateActivityDTOS {
  nome: string;
  data: Date | null;
  vagas: number | null;
  palestranteNome: string;
  palestranteTitulo?: SpeakerTitle;
  categoriaId: string;
  eventId?: string;
  detalhes: string | null;
  local: string;
  localLink?: string | null;
  points?: number;
}

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
  categoria?: {
    id: string;
    nome: string;
    slug: string;
    requiresEnrollment: boolean;
  };
}
