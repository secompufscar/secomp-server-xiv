import { Request, Response } from "express";
import { prisma as prismaClient } from "../lib/prisma";
import { adminUserResponse } from "../dtos/userResponses";
import { hash, hashSync } from "bcrypt";
import { auth } from "../config/auth";
import {
  BadRequestsException,
  NoJWTSecretSpecifiedError,
  UnauthorizedUserError,
} from "../utils/exceptions";

const secret_token = auth.secret_token;


export default {
  async create(req: Request, res: Response) {
    const { email, senha, nome, tipo } = req.body;
    const { authorization } = req.headers;

    try {
      if (!authorization) throw new UnauthorizedUserError("Não autorizado");

      if (!secret_token) throw new NoJWTSecretSpecifiedError("Chave JWT não especificada");

      if (tipo !== "USER" && tipo !== "ADMIN")
        throw new BadRequestsException("Tipo de usuário não reconhecido");

      let user = await prismaClient.user.findFirst({ where: { email } });

      if (user) {
        throw new BadRequestsException("Email já cadastrado");
      }

      user = await prismaClient.user.create({
        data: {
          email,
          senha: hashSync(senha, 10),
          nome,
          tipo,
        },
      });

      res.status(201).json(adminUserResponse({ ...user, registrationStatus: user.registrationStatus as 0 | 1 | 2 }));
    } catch (error: any) {
      console.error("Erro criando usuário: ", error.message);
      res.status(error.statusCode).json({ error: error.message, statusCode: error.statusCode });
    }
  },

  async update(req: Request, res: Response) {
    const { email, updatedEmail, nome, senha } = req.body;
    const { authorization } = req.headers;

    try {
      if (!authorization) throw new UnauthorizedUserError("Não autorizado");

      if (!secret_token) throw new NoJWTSecretSpecifiedError("Chave JWT não especificada");

      let user = await prismaClient.user.findUnique({ where: { email } });

      if (!user) throw new BadRequestsException("Email não existe");

      const updateData: { email?: string; nome?: string; senha?: string } = {};
      if (updatedEmail !== undefined) updateData.email = updatedEmail;
      if (nome !== undefined) updateData.nome = nome;
      if (senha !== undefined) updateData.senha = await hash(senha, 10);

      user = await prismaClient.user.update({
        where: { email },
        data: updateData,
      });

      res.status(201).json(adminUserResponse({ ...user, registrationStatus: user.registrationStatus as 0 | 1 | 2 }));
    } catch (error: any) {
      console.log("Erro em update de usuário: ", error.message);
      res.status(error.statusCode).json({ message: error.message, statusCode: error.statusCode });
    }
  },

  async delete(req: Request, res: Response) {
    const { email } = req.body;

    try {
      if (!secret_token) throw new NoJWTSecretSpecifiedError("Chave JWT não especificada");

      let user = await prismaClient.user.findFirst({ where: { email } });

      if (!user) throw new BadRequestsException("Email não existe");

      user = await prismaClient.user.delete({ where: { email } });

      res.status(201).json(adminUserResponse({ ...user, registrationStatus: user.registrationStatus as 0 | 1 | 2 }));
    } catch (error: any) {
      console.log("Erro deletando usuário: ", error.message);
      res.status(error.statusCode).json({ message: error.message, statusCode: error.statusCode });
    }
  },
};
