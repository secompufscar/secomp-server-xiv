import { z } from "zod";

const email = z
  .string()
  .trim()
  .email("E-mail inválido")
  .max(254)
  .transform((value) => value.toLowerCase());
const password = z.string().min(6, "A senha deve ter pelo menos 6 caracteres").max(72, "A senha deve ter no máximo 72 caracteres");

export const signupSchema = z
  .object({
    nome: z.string().trim().min(2, "Nome inválido").max(120),
    email,
    senha: password,
  })
  .strip();

export const loginSchema = z
  .object({
    email,
    senha: z.string().min(1, "Senha obrigatória").max(256),
  })
  .strip();

export const refreshSchema = z
  .object({
    refreshToken: z.string().min(32, "Refresh token inválido").max(512),
  })
  .strip();

export const logoutSchema = z
  .object({
    refreshToken: z.string().min(32).max(512).optional(),
  })
  .strip();

export const forgotPasswordSchema = z.object({ email }).strip();
export const updatePasswordSchema = z.object({ senha: password }).strip();
export const resetTokenParamsSchema = z.object({ token: z.string().min(20).max(4096) }).strip();
