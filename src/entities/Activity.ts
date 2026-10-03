export interface Activity {
  id: string;
  nome: string;
  data: Date | null;
  vagas: number | null;
  detalhes: string | null;
  palestranteNome: string;
  palestranteTitulo?: "APRESENTADOR" | "APRESENTADORA";
  categoriaId: string;
  eventId: string | null;
  localLink?: string | null;
  points: number;
}
