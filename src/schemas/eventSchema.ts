import { z } from "zod";

export const eventParamsSchema = z.object({
  id: z.string().uuid("ID do evento deve ser um UUID válido"),
});

const eventBodySchema = z
  .object({
    isCurrent: z.boolean().optional(),
    year: z
      .number({ required_error: "Ano é obrigatório" })
      .int("Ano deve ser inteiro")
      .min(2000, "Ano mínimo é 2000")
      .max(2100, "Ano máximo é 2100"),
    startDate: z.string({ required_error: "Data de início é obrigatória" })
      .datetime({ offset: true, message: "Formato da data de início inválido" }),
    endDate: z.string({ required_error: "Data de término é obrigatória" })
      .datetime({ offset: true, message: "Formato da data de término inválido" }),
  })
  .refine((data) => new Date(data.endDate) > new Date(data.startDate), {
    message: "Data de término deve ser posterior à data de início",
    path: ["endDate"],
  });

export const createEventSchema = eventBodySchema;
export const updateEventSchema = eventBodySchema;
