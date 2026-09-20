import * as jwt from "jsonwebtoken";
import * as nodemailer from "nodemailer";
import _ from "lodash";
import { compare, hash } from "bcrypt";
import { auth } from "../config/auth";
import { email } from "../config/sendEmail";
import { User } from "../entities/User";
import { ApiError, ErrorsCode } from "../utils/api-errors";
import { generateQRCode } from "../utils/qrCode";
import { CreateUserDTOS, UpdateProfileDTO } from "../dtos/usersDtos";
import { promises as fs } from "fs";
import path from "path";
import usersRepository from "../repositories/usersRepository";
import usersAtActivitiesRepository from "../repositories/usersAtActivitiesRepository";
import { BrevoClient } from "@getbrevo/brevo";

const brevo = new BrevoClient({
  apiKey: process.env.BREVO_API_KEY || "",
});

const port = Number(process.env.SMTP_PORT) || 587;
const secure = port === 465;

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true, 
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  connectionTimeout: 15000, 
  greetingTimeout: 15000,
});

// Carrega o html do email
export async function loadTemplate(templateName: string, data: Record<string, string>) {
  const templatePath = path.join(__dirname, "..", "views", templateName);
  let html = await fs.readFile(templatePath, "utf-8");

  for (const [key, value] of Object.entries(data)) {
    const regex = new RegExp(`{{\\s*${key}\\s*}}`, "g");
    html = html.replace(regex, value);
  }

  return html;
}

function isValidUUID(uuid: string) {
  const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return regex.test(uuid);
}

export default {
  async login({ email, senha }: User) {
    const user = await usersRepository.findByEmail(email);

    if (!user) {
      throw new ApiError("Email ou senha incorreto!", ErrorsCode.NOT_FOUND);
    }

    const verifyPsw = await compare(senha, user.senha);
    if (!verifyPsw) {
      throw new ApiError("Email ou senha incorreto!", ErrorsCode.NOT_FOUND);
    }

    if (!user.confirmed) {
      throw new ApiError("Por favor, verifique o seu email e tente novamente!", ErrorsCode.BAD_REQUEST);
    }

    const token = jwt.sign({ userId: user.id }, auth.secret_token, { expiresIn: "24h" });

    const { senha: _, ...userLogin } = user;

    return {
      user: userLogin,
      token: token,
    };
  },

  async signup({ nome, email, senha, tipo = "USER" }: CreateUserDTOS) {
    const userExists = await usersRepository.findByEmail(email);

    if (userExists) {
      throw new ApiError("Este email já existe na base de dados!", ErrorsCode.BAD_REQUEST);
    }

    const hashedPassword = await hash(senha, 10);
    const user = await usersRepository.create({
      nome,
      email,
      senha: hashedPassword,
      tipo,
    });

    const qrCode = await generateQRCode(user.id);
    await usersRepository.updateQRCode(user.id, { qrCode });
    user.qrCode = qrCode;

    const token = jwt.sign({ userId: user.id }, auth.secret_token, { expiresIn: "24h" });

    const { senha: _, ...userLogin } = user;
    try {
      const emailEnviado = await this.sendConfirmationEmail(user);

      return {
        message: "Usuário criado com sucesso. Email de confirmação enviado.",
        emailEnviado,
      };
    } catch (err) {
      await usersRepository.delete(user.id);
      console.error(err);

      throw new ApiError("Erro ao enviar email de confirmação!", ErrorsCode.INTERNAL_ERROR);
    }
  },

  async sendConfirmationEmail(user: User): Promise<boolean> {
    try {
      const emailToken = jwt.sign({ userId: user.id }, email.email_secret, { expiresIn: "1d" });
      const BASE_URL = process.env.NODE_ENV === "production" ? process.env.BASE_URL_PROD : process.env.BASE_URL_DEV;
      const url = `${BASE_URL}/users/confirmation/${emailToken}`;

      const htmlContent = await loadTemplate("email-confirmation.html", { url });

      const result = await brevo.transactionalEmails.sendTransacEmail({
        subject: "SECOMP UFSCar - Confirmação de e-mail",
        htmlContent: htmlContent,
        sender: {
          name: "SECOMP UFSCar",
          email: "secomp.ti@secompufscar.com.br",
        },
        to: [
          {
            email: user.email,
            name: user.nome,
          },
        ],
      });

      console.log("E-mail enviado com sucesso via Brevo! MessageID:", result.messageId);
      return true;
    } catch (err) {
      console.error("FALHA DETALHADA NO BREVO:", err);
      throw new ApiError("Erro ao enviar email", ErrorsCode.INTERNAL_ERROR);
    }
  },

  async confirmUser(token: string) {
    try {
      const decoded = jwt.verify(token, email.email_secret) as jwt.JwtPayload;

      if (typeof decoded !== "string" && decoded.userId) {
        const id = decoded.userId;

        const user = await usersRepository.update(id, { confirmed: true });
        const { senha: _, ...confirmedUser } = user;

        return {
          user: confirmedUser,
        };
      }

      throw new ApiError("token de validacao invalido", ErrorsCode.INTERNAL_ERROR);
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) {
        throw new ApiError("Token expirado. Solicite um novo.", ErrorsCode.UNAUTHORIZED);
      }
      throw new ApiError("Erro ao confirmar e-mail!", ErrorsCode.INTERNAL_ERROR);
    }
  },

  async sendForgotPasswordEmail(email: string) {
    try {
      const user = await usersRepository.findByEmail(email);
      if (!user) {
        throw new ApiError("Usuário não encontrado!", ErrorsCode.NOT_FOUND);
      }

      if (!process.env.JWT_RESET_SECRET) {
        throw new Error("JWT_RESET_SECRET não está definido");
      }

      const emailToken = jwt.sign({ userId: user.id }, process.env.JWT_RESET_SECRET, { expiresIn: "1h" });

      // Link com protocolo personalizado que é interpretado pelo app mobile
      const url = `https://app.secompufscar.com.br/SetNewPassword?token=${emailToken}`;
      const html = await loadTemplate("email-passwordreset.html", {
        url,
      });

      await transporter.sendMail({
        to: user.email,
        subject: "SECOMP UFSCar - Solicitação de alteração de senha",
        html,
      });
    } catch (err) {
      console.log("Erro no serviço de recuperação de senha", err);
      throw new ApiError("Erro ao enviar email de recuperação de senha!", ErrorsCode.INTERNAL_ERROR);
    }
  },

  async updatePassword(token: string, newPassword: string) {
    try {
      if (!process.env.JWT_RESET_SECRET) {
        throw new Error("JWT_RESET_SECRET não está definido");
      }

      const decoded = jwt.verify(token, process.env.JWT_RESET_SECRET) as {
        userId: string;
      };

      const user = await usersRepository.findById(decoded.userId);
      if (!user) {
        throw new ApiError("Usuário não encontrado", ErrorsCode.NOT_FOUND);
      }

      const hashedPassword = await hash(newPassword, 10);

      await usersRepository.update(user.id, { senha: hashedPassword });

      return { message: "Senha atualizada com sucesso" };
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) {
        throw new ApiError("Token expirado", ErrorsCode.UNAUTHORIZED);
      }
      if (err instanceof jwt.JsonWebTokenError) {
        throw new ApiError("Token inválido", ErrorsCode.UNAUTHORIZED);
      }
      throw new ApiError("Erro ao atualizar senha", ErrorsCode.INTERNAL_ERROR);
    }
  },

  async getUserScore(id: string): Promise<{ points: number } | null> {
    try {
      const userPoints = await usersRepository.getUserPoints(id);
      if (!userPoints) {
        throw new ApiError("Usuário não encontrado.", ErrorsCode.NOT_FOUND);
      }
      return userPoints;
    } catch (error) {
      console.error("Erro em usersService.getUserScore: " + error);
      throw new ApiError("Erro ao obter pontuação do usuário", ErrorsCode.INTERNAL_ERROR);
    }
  },

  async getUserRanking(id: string) {
    try {
      const user = await usersRepository.findById(id);
      if (!user) {
        throw new ApiError("Usuário não encontrado", ErrorsCode.NOT_FOUND);
      }
      const userRank = await usersRepository.getUserRanking(id);
      return userRank;
    } catch (error) {
      console.error("Erro usersService.ts: " + error);
      throw new ApiError("Erro ao encontrar ranking do usuário", ErrorsCode.NOT_FOUND);
    }
  },

  async getTop50Ranking(): Promise<User[]> {
    try {
      const topUsers = await usersRepository.getTop50RankingUsers();
      if (!topUsers || topUsers.length === 0) {
        throw new ApiError("Não foi possível obter o ranking", ErrorsCode.NOT_FOUND);
      }

      return topUsers;
    } catch (error) {
      console.error("Erro usersRankingService - getTop50Ranking: ", error);
      throw new ApiError("Erro ao buscar ranking dos usuários", ErrorsCode.INTERNAL_ERROR);
    }
  },

  async getUserById(id: string) {
    try {
      if (!isValidUUID(id)) {
        throw new ApiError("Erro com o id enviado", ErrorsCode.BAD_REQUEST);
      }

      const user = await usersRepository.findById(id);
      if (!user) {
        throw new ApiError("Erro ao encontrar usuário: ", ErrorsCode.NOT_FOUND);
      }

      return user;
    } catch (error) {
      console.error("usersService.ts: " + error);
      throw new ApiError("Erro ao consultar o ranking do usuario", ErrorsCode.INTERNAL_ERROR);
    }
  },

  async updateProfile(userId: string, data: UpdateProfileDTO) {
    const { nome, email } = data;
    if (!nome && !email) {
      throw new ApiError("A requisição deve conter 'nome' ou 'email' para ser atualizado.", ErrorsCode.BAD_REQUEST);
    }

    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        throw new ApiError("O formato do email é inválido.", ErrorsCode.BAD_REQUEST);
      }
    }

    const userToUpdate = await usersRepository.findById(userId);
    if (!userToUpdate) {
      throw new ApiError("Usuário não encontrado.", ErrorsCode.NOT_FOUND);
    }

    if (email && email !== userToUpdate.email) {
      const userWithSameEmail = await usersRepository.findByEmail(email);
      if (userWithSameEmail && userWithSameEmail.id !== userId) {
        throw new ApiError("Este e-mail já está em uso.", ErrorsCode.BAD_REQUEST);
      }
    }

    const updatedUser = await usersRepository.update(userId, { nome, email });

    const { senha: _, ...userResult } = updatedUser;

    return userResult;
  },

  async countUserActivities(userId: string): Promise<number> {
    try {
      const user = await usersRepository.findById(userId);
      if (!user) {
        throw new ApiError("Usuario não encontrado", ErrorsCode.NOT_FOUND);
      }

      const totalActivities = await usersAtActivitiesRepository.countByUserId(userId);
      return totalActivities;
    } catch (error) {
      throw new ApiError("Erro ao contar as atividades do usuário", ErrorsCode.INTERNAL_ERROR);
    }
  },

  async getUserDetails(id: string): Promise<Omit<User, "senha" | "qrCode">> {
    try {
      if (!isValidUUID(id)) {
        throw new ApiError("ID de usuário inválido.", ErrorsCode.BAD_REQUEST);
      }

      const user = await usersRepository.findById(id);

      if (!user) {
        throw new ApiError("Usuário não encontrado.", ErrorsCode.NOT_FOUND);
      }

      const { senha, qrCode, ...userDetails } = user;

      return userDetails;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      console.error("Erro usersService.ts - getUserDetails: " + error);
      throw new ApiError("Erro interno ao buscar detalhes do usuário.", ErrorsCode.INTERNAL_ERROR);
    }
  },

  async addPushToken(userId: string, token: string) {
    const user = await usersRepository.findById(userId);

    if (!user) {
      throw new ApiError("Usuário não encontrado", ErrorsCode.NOT_FOUND);
    }

    const updatedUser = await usersRepository.update(userId, {
      pushToken: token,
    });

    return {
      message: "Token de push adicionado com sucesso",
      user: _.omit(updatedUser, ["senha"]),
    };
  },
};
