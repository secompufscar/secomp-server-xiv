import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { User } from "../entities/User";
import { toUserEntity } from "./usersRepository";
import { ApiError, ErrorsCode } from "../utils/api-errors";
import { matchesAuthVersion } from "../utils/authVersion";

export interface ConfirmationClaims {
  userId: string;
  purpose?: "email-confirmation" | "email-change";
  email?: string;
  currentEmail?: string;
  emailVersion?: number;
  authVersion?: number;
}

async function lockedUser(tx: Prisma.TransactionClient, id: string) {
  await tx.$queryRaw`SELECT id FROM users WHERE id = ${id} FOR UPDATE`;
  const user = await tx.user.findUnique({ where: { id } });
  if (!user) throw new ApiError("Usuário não encontrado", ErrorsCode.NOT_FOUND);
  return user;
}

async function availableEmail(tx: Prisma.TransactionClient, email: string, userId: string) {
  const owner = await tx.user.findUnique({ where: { email } });
  if (owner && owner.id !== userId) throw new ApiError("Este e-mail já está em uso.", ErrorsCode.BAD_REQUEST);
}

export default {
  async saveProfileChanges(snapshot: User, changes: { nome?: string; email?: string; senha?: string }) {
    return prisma.$transaction(async tx => {
      const user = await lockedUser(tx, snapshot.id);
      if (user.email !== snapshot.email || user.senha !== snapshot.senha
        || user.authVersion !== (snapshot.authVersion ?? 0) || user.emailVersion !== (snapshot.emailVersion ?? 0)) {
        throw new ApiError("A conta foi alterada. Atualize o perfil e tente novamente.", ErrorsCode.CONFLICT);
      }
      const data: Prisma.UserUpdateInput = {};
      if (changes.nome !== undefined) data.nome = changes.nome;
      if (changes.email !== undefined) {
        if (changes.email.toLowerCase() !== user.email.toLowerCase()) {
          await availableEmail(tx, changes.email, user.id);
          data.pendingEmail = changes.email;
          data.emailVersion = { increment: 1 };
        } else if (user.pendingEmail !== null) {
          // Submitting the active address cancels a pending change without logout.
          data.pendingEmail = null;
          data.emailVersion = { increment: 1 };
        }
      }
      if (changes.senha !== undefined) {
        data.senha = changes.senha;
        data.authVersion = { increment: 1 };
      }
      const saved = Object.keys(data).length
        ? await tx.user.update({ where: { id: user.id }, data }) : user;
      if (changes.senha !== undefined) {
        await tx.refreshSession.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } });
      }
      return toUserEntity(saved);
    });
  },

  async confirm(claims: ConfirmationClaims) {
    return prisma.$transaction(async tx => {
      const user = await lockedUser(tx, claims.userId);
      const invalid = () => new ApiError("Link inválido ou substituído. Solicite uma nova confirmação.", ErrorsCode.UNAUTHORIZED);
      if (!matchesAuthVersion(claims.emailVersion, user.emailVersion)) throw invalid();
      if (claims.purpose === "email-change") {
        if (claims.emailVersion === undefined || claims.authVersion === undefined
          || !user.pendingEmail || claims.email !== user.pendingEmail || claims.currentEmail !== user.email
          || !matchesAuthVersion(claims.authVersion, user.authVersion)) throw invalid();
        await availableEmail(tx, user.pendingEmail, user.id);
        const saved = await tx.user.update({ where: { id: user.id }, data: {
          email: user.pendingEmail, pendingEmail: null, confirmed: true,
          emailVersion: { increment: 1 }, authVersion: { increment: 1 },
        } });
        await tx.refreshSession.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } });
        return toUserEntity(saved);
      }
      // Legacy links have only userId; accepted only while the email version is zero.
      if (claims.purpose === undefined) {
        if (claims.email !== undefined || claims.emailVersion !== undefined) throw invalid();
      } else if (claims.purpose !== "email-confirmation" || claims.emailVersion === undefined || claims.email !== user.email) throw invalid();
      if (user.confirmed) return toUserEntity(user);
      return toUserEntity(await tx.user.update({ where: { id: user.id }, data: { confirmed: true } }));
    });
  },
};
