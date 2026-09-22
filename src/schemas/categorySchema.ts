import { z } from "zod";

const categoryFields = {
  nome: z.string({
    required_error: "Nome é obrigatório",
    invalid_type_error: "Nome deve ser um texto",
  }).min(1, "Nome não pode ser vazio"),
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
