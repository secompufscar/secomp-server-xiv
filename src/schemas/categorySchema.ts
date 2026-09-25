import { z } from "zod";

const categoryFields = {
  nome: z.string({
    required_error: "Nome é obrigatório",
    invalid_type_error: "Nome deve ser um texto",
  }).min(1, "Nome não pode ser vazio"),
  slug: z.string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug deve conter letras minúsculas, números e hífens")
    .max(80, "Slug deve ter no máximo 80 caracteres")
    .optional(),
  requiresEnrollment: z.boolean({
    invalid_type_error: "requiresEnrollment deve ser booleano",
  }).optional(),
};

export const createCategorySchema = z.object(categoryFields);

export const updateCategorySchema = z.object(categoryFields).partial().refine(
  data => Object.keys(data).length > 0,
  "Informe ao menos um campo para atualizar",
);

export const categoryParamsSchema = z.object({
  id: z.string().uuid("ID de categoria inválido"),
});
