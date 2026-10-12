import { z } from "zod";
import { DEFAULT_DURATION_SOURCE } from "../services/activityCertification";

const activityBaseSchema = z.object({
  nome: z.string().min(1, "Nome é obrigatório").max(255),
  data: z.string().datetime({ offset: true, message: "Data da atividade inválida" }).optional().nullable(),
  palestranteNome: z.string().min(1, "Nome do palestrante é obrigatório").max(255),
  palestranteTitulo: z.enum(["APRESENTADOR", "APRESENTADORA"]).optional(),
  eventId: z.string().uuid("ID de evento inválido").optional(),
  categoriaId: z.string().uuid("ID de categoria inválido"),
  vagas: z.number().int().min(0).max(2147483647).nullable().optional(),
  detalhes: z.string().max(1500).nullable().optional(),
  local: z.string().max(255),
  localLink: z.string().trim().max(2048).url("Link do local inválido")
    .refine(value => /^https?:\/\//i.test(value), "Use um link http ou https")
    .nullable().optional(),
  points: z.number().int().min(0).max(2147483647).optional(),
  durationMinutes: z.number({ required_error: "Informe a duração oficial em minutos" }).int().min(1).max(10080),
  durationSource: z.string().trim().min(1).max(500).default(DEFAULT_DURATION_SOURCE),
  certificateExcluded: z.boolean({ required_error: "Informe se a atividade é certificável" }),
});

export const createActivitySchema = activityBaseSchema;

export const updateActivitySchema = activityBaseSchema.partial().superRefine((data, ctx) => {
  if ([data.durationMinutes, data.durationSource, data.certificateExcluded].some(value => value !== undefined)
    && (data.durationMinutes === undefined || data.certificateExcluded === undefined)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Ao alterar a certificação, informe duração e certificabilidade juntas." });
  }
});

export const activityIdSchema = z.object({
  id: z.string().uuid("ID de atividade inválido"),
});
