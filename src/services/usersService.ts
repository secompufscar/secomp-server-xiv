import * as jwt from "jsonwebtoken";
import { adminUserResponse, profileResponse, RankingUserResponse } from "../dtos/userResponses";
import { compare, hash } from "bcrypt";
import { email } from "../config/sendEmail";
import { getSigningSecret, verifySecurityToken } from "../config/securitySecrets";
import { User } from "../entities/User";
import { ApiError, ErrorsCode } from "../utils/api-errors";
import { generateQRCode } from "../utils/qrCode";
import { SignupUserDTO, UpdateProfileDTO } from "../dtos/usersDtos";
import { promises as fs } from "fs";
import path from "path";
import usersRepository from "../repositories/usersRepository";
import usersAtActivitiesRepository from "../repositories/usersAtActivitiesRepository";
import { BrevoClient } from "@getbrevo/brevo";
import { createAccessToken, createSession, revokeSession, rotateSession } from "./authSessionsService";
import { randomUUID } from "crypto";
import { matchesAuthVersion } from "../utils/authVersion";
import passwordRecoveryRepository from "../repositories/passwordRecoveryRepository";
import emailChangeRepository, { ConfirmationClaims } from "../repositories/emailChangeRepository";
import { profileFieldsSchema, updateProfileSchema } from "../schemas/userSchema";

const brevo = new BrevoClient({
  apiKey: process.env.BREVO_API_KEY || "",
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
  async login({ email, senha }: User, supportsRefresh = false) {
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

    const userLogin = profileResponse(user);

    if (!supportsRefresh) {
      return { user: userLogin, token: createAccessToken(user.id, "24h", user.authVersion ?? 0) };
    }

    const session = await createSession(user.id, user.authVersion ?? 0);

    return {
      user: userLogin,
      ...session,
    };
  },

  async refreshSession(refreshToken: string) {
    return rotateSession(refreshToken);
  },

  async logout(refreshToken: string) {
    await revokeSession(refreshToken);
  },

  async signup({ nome, email, senha }: SignupUserDTO) {
    const duplicate = () => new ApiError("Este email já existe na base de dados!", ErrorsCode.BAD_REQUEST);
    const resume = async (pending: User | null) => {
      if (!pending || pending.confirmed || pending.tipo !== "USER" || !await compare(senha, pending.senha)) {
        throw duplicate();
      }
      const qrCode = pending.qrCode || await generateQRCode(pending.id);
      const saved = await usersRepository.repairPendingSignup(pending, qrCode);
      if (!saved) throw duplicate();
      return saved;
    };

    let user: User;
    const existing = await usersRepository.findByEmail(email);
    if (existing) {
      user = await resume(existing);
    } else {
      const id = randomUUID();
      const hashedPassword = await hash(senha, 10);
      // QR generation must finish before the single database write.
      const qrCode = await generateQRCode(id);
      try {
        user = await usersRepository.createSignup({ id, nome, email, senha: hashedPassword, tipo: "USER", qrCode });
      } catch (err) {
        if (!(err && typeof err === "object" && "code" in err && err.code === "P2002")) throw err;
        // The unique email constraint arbitrates simultaneous requests.
        user = await resume(await usersRepository.findByEmail(email));
      }
    }

    try {
      const emailEnviado = await this.sendConfirmationEmail(user);
      if (!emailEnviado) throw new Error("Confirmation email was not accepted");

      return {
        message: "Usuário criado com sucesso. Email de confirmação enviado.",
        emailEnviado,
      };
    } catch (err) {
      console.error("SIGNUP_CONFIRMATION_FAILED");

      throw new ApiError("Erro ao enviar email de confirmação!", ErrorsCode.INTERNAL_ERROR);
    }
  },

  async sendConfirmationEmail(user: User, emailChange = false): Promise<boolean> {
    try {
      const recipient = emailChange ? user.pendingEmail : user.email;
      if (!recipient) throw new Error("Missing confirmation recipient");
      const emailToken = jwt.sign({ userId: user.id, email: recipient, emailVersion: user.emailVersion ?? 0,
        purpose: emailChange ? "email-change" : "email-confirmation",
        ...(emailChange ? { currentEmail: user.email, authVersion: user.authVersion ?? 0 } : {}),
      }, email.email_secret, { expiresIn: "1d" });
      const BASE_URL = process.env.NODE_ENV === "production" ? process.env.BASE_URL_PROD : process.env.BASE_URL_DEV;
      const url = `${BASE_URL}/users/confirmation/${emailToken}`;

      const htmlContent = await loadTemplate(emailChange ? "email-change.html" : "email-confirmation.html", { url });

      const result = await brevo.transactionalEmails.sendTransacEmail({
        subject: emailChange ? "SECOMP UFSCar - Confirme a alteração de e-mail" : "SECOMP UFSCar - Confirmação de e-mail",
        htmlContent: htmlContent,
        sender: {
          name: "SECOMP UFSCar",
          email: "secomp.ti@secompufscar.com.br",
        },
        to: [
          {
            email: recipient,
            name: user.nome,
          },
        ],
      });

      console.log("E-mail enviado com sucesso via Brevo! MessageID:", result.messageId);
      return true;
    } catch (err) {
      console.error("CONFIRMATION_EMAIL_FAILED");
      throw new ApiError("Erro ao enviar email", ErrorsCode.INTERNAL_ERROR);
    }
  },

  async confirmUser(token: string) {
    try {
      const decoded = verifySecurityToken(token, "EMAIL_SECRET") as jwt.JwtPayload;

      if (typeof decoded.userId !== "string" || !decoded.userId || typeof decoded.exp !== "number"
        || (decoded.purpose !== undefined && decoded.purpose !== "email-confirmation" && decoded.purpose !== "email-change")) {
        throw new ApiError("Token de confirmação inválido", ErrorsCode.UNAUTHORIZED);
      }
      const user = await emailChangeRepository.confirm(decoded as ConfirmationClaims);
      return { user: profileResponse(user), emailChanged: decoded.purpose === "email-change" };
    } catch (err) {
      if (err instanceof ApiError) throw err;
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
        return;
      }

      const emailToken = jwt.sign({ userId: user.id, authVersion: user.authVersion ?? 0, purpose: "password-reset" },
        getSigningSecret("JWT_RESET_SECRET"), { expiresIn: "1h", jwtid: randomUUID() });

      // Link com protocolo personalizado que é interpretado pelo app mobile
      const url = `https://secomp-app-xiv.vercel.app/SetNewPassword?token=${emailToken}`;
      const html = await loadTemplate("email-passwordreset.html", {
        url,
      });

      await brevo.transactionalEmails.sendTransacEmail({
        subject: "SECOMP UFSCar - Solicitação de alteração de senha",
        htmlContent: html,
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
    } catch (err) {
      console.error("PASSWORD_RESET_EMAIL_FAILED");
      throw new ApiError("Erro ao enviar email de recuperação de senha!", ErrorsCode.INTERNAL_ERROR);
    }
  },

  async updatePassword(token: string, newPassword: string) {
    try {
      const decoded = verifySecurityToken(token, "JWT_RESET_SECRET");
      if (typeof decoded === "string" || typeof decoded.userId !== "string" || !decoded.userId
        || typeof decoded.exp !== "number" || (decoded.purpose !== undefined && decoded.purpose !== "password-reset")) {
        throw new ApiError("Token inválido", ErrorsCode.UNAUTHORIZED);
      }

      const user = await usersRepository.findById(decoded.userId);
      if (!user) {
        throw new ApiError("Usuário não encontrado", ErrorsCode.NOT_FOUND);
      }

      if (!matchesAuthVersion(decoded.authVersion, user.authVersion ?? 0)) {
        throw new ApiError("Link já utilizado ou invalidado. Solicite uma nova recuperação.", ErrorsCode.UNAUTHORIZED);
      }

      const hashedPassword = await hash(newPassword, 10);

      const changed = await passwordRecoveryRepository.consumeAndChangePassword(user.id, user.authVersion ?? 0, hashedPassword);
      if (!changed) {
        throw new ApiError("Link já utilizado ou invalidado. Solicite uma nova recuperação.", ErrorsCode.UNAUTHORIZED);
      }

      return { message: "Senha atualizada com sucesso" };
    } catch (err) {
      if (err instanceof ApiError) {
        throw err;
      }
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

  async getTop50Ranking(): Promise<RankingUserResponse[]> {
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

      return profileResponse(user);
    } catch (error) {
      console.error("usersService.ts: " + error);
      throw new ApiError("Erro ao consultar o ranking do usuario", ErrorsCode.INTERNAL_ERROR);
    }
  },

  async updateProfile(userId: string, data: UpdateProfileDTO) {
    const fields = updateProfileSchema.parse(data);
    const userToUpdate = await usersRepository.findById(userId);
    if (!userToUpdate) {
      throw new ApiError("Usuário não encontrado.", ErrorsCode.NOT_FOUND);
    }

    return profileResponse(await this.saveProfileChanges(userToUpdate, fields));
  },

  async saveProfileChanges(user: User, data: UpdateProfileDTO, hashedPassword?: string) {
    const fields = profileFieldsSchema.parse(data);
    if (fields.email === undefined && hashedPassword === undefined) {
      return usersRepository.update(user.id, fields);
    }
    const saved = await emailChangeRepository.saveProfileChanges(user, {
      ...fields, ...(hashedPassword !== undefined ? { senha: hashedPassword } : {}),
    });
    if (fields.email !== undefined && saved.pendingEmail) {
      // Keep the active address and access intact even if delivery times out.
      const sent = await this.sendConfirmationEmail(saved, true);
      if (!sent) throw new ApiError("Erro ao enviar email de confirmação!", ErrorsCode.INTERNAL_ERROR);
    }
    return saved;
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

  async getUserDetails(id: string) {
    try {
      if (!isValidUUID(id)) {
        throw new ApiError("ID de usuário inválido.", ErrorsCode.BAD_REQUEST);
      }

      const user = await usersRepository.findById(id);

      if (!user) {
        throw new ApiError("Usuário não encontrado.", ErrorsCode.NOT_FOUND);
      }

      const userDetails = adminUserResponse(user);

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
      user: profileResponse(updatedUser),
    };
  },
};
