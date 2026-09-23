import { z } from "zod";

const activityBaseSchema = z.object({
  nome: z.string().min(1, "Nome é obrigatório"),
  data: z.string().optional().nullable(), 
  palestranteNome: z.string().min(1, "Nome do palestrante é obrigatório"),
  eventId: z.string().uuid("ID de evento inválido").optional(),
});

export const createActivitySchema = activityBaseSchema.extend({
  points: z.number().int().min(0, "Pontos deve ser um número inteiro não negativo"),
});

export const updateActivitySchema = activityBaseSchema.partial();

export const activityIdSchema = z.object({
  id: z.string().uuid("ID de atividade inválido"),
});
