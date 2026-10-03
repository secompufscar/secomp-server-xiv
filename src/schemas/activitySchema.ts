import { z } from "zod";

const activityBaseSchema = z.object({
  nome: z.string().min(1, "Nome é obrigatório").max(255),
  data: z.string().datetime({ offset: true, message: "Data da atividade inválida" }).optional().nullable(),
  palestranteNome: z.string().min(1, "Nome do palestrante é obrigatório").max(255),
  palestranteTitulo: z.enum(["APRESENTADOR", "APRESENTADORA"]).optional(),
  eventId: z.string().uuid("ID de evento inválido").optional(),
  categoriaId: z.string().uuid("ID de categoria inválido"),
  vagas: z.number().int().min(0).max(2147483647).nullable().optional(),
  detalhes: z.string().max(1000).nullable().optional(),
  local: z.string().max(255),
  localLink: z.string().trim().max(2048).url("Link do local inválido")
    .refine(value => /^https?:\/\//i.test(value), "Use um link http ou https")
    .nullable().optional(),
  points: z.number().int().min(0).max(2147483647).optional(),
});

export const createActivitySchema = activityBaseSchema;

export const updateActivitySchema = activityBaseSchema.partial();

export const activityIdSchema = z.object({
  id: z.string().uuid("ID de atividade inválido"),
});
