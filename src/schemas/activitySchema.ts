import { z } from "zod";

const activityBaseSchema = z.object({
  nome: z.string().min(1, "Nome é obrigatório").max(255),
  data: z.string().datetime({ offset: true, message: "Data da atividade inválida" }).optional().nullable(),
  palestranteNome: z.string().min(1, "Nome do palestrante é obrigatório").max(255),
  eventId: z.string().uuid("ID de evento inválido").optional(),
  categoriaId: z.string().uuid("ID de categoria inválido"),
  vagas: z.number().int().min(0).max(2147483647).nullable().optional(),
  detalhes: z.string().max(500).nullable().optional(),
  local: z.string().max(255),
  points: z.number().int().min(0).max(2147483647).optional(),
});

export const createActivitySchema = activityBaseSchema;

export const updateActivitySchema = activityBaseSchema.partial();

export const activityIdSchema = z.object({
  id: z.string().uuid("ID de atividade inválido"),
});
