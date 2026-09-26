export interface CreateActivityDTOS {
  nome: string;
  data: Date | null;
  palestranteNome: string;
  categoriaId: string;
  eventId?: string;
  vagas: number | null;
  detalhes: string | null;
  local: string;
  points: number;
}

export interface UpdateActivityDTOS {
  nome: string;
  data: Date | null;
  vagas: number | null;
  palestranteNome: string;
  categoriaId: string;
  eventId?: string;
  detalhes: string | null;
  local: string;
  points?: number;
}

export interface ActivityDTOS {
  id: string;
  nome: string;
  data: Date | null;
  vagas: number | null;
  detalhes: string | null;
  palestranteNome: string;
  categoriaId: string;
  eventId: string | null;
  points: number;
  categoria?: {
    id: string;
    nome: string;
    slug: string;
    requiresEnrollment: boolean;
  };
}
