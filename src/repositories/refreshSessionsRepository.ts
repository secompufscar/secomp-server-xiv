import { prisma } from "../lib/prisma";
import { Prisma } from "@prisma/client";
import { ApiError, ErrorsCode } from "../utils/api-errors";

async function lockUserVersion(tx: Prisma.TransactionClient, userId: string, authVersion: number) {
  const users = await tx.$queryRaw<Array<{ authVersion: number }>>`
    SELECT authVersion FROM users WHERE id = ${userId} FOR UPDATE`;
  return users.length === 1 && users[0].authVersion === authVersion;
}

export default {
  findByHash(tokenHash: string) {
    return prisma.refreshSession.findUnique({ where: { tokenHash } });
  },

  create(userId: string, tokenHash: string, expiresAt: Date, authVersion = 0) {
    return prisma.$transaction(async tx => {
      if (!await lockUserVersion(tx, userId, authVersion)) {
        throw new ApiError("Credenciais alteradas; faça login novamente", ErrorsCode.UNAUTHORIZED);
      }
      return tx.refreshSession.create({ data: { userId, tokenHash, expiresAt, authVersion } });
    });
  },

  async rotate(id: string, userId: string, tokenHash: string, expiresAt: Date, authVersion = 0) {
    return prisma.$transaction(async tx => {
      if (!await lockUserVersion(tx, userId, authVersion)) return false;
      const revoked = await tx.refreshSession.updateMany({
        where: { id, userId, authVersion, revokedAt: null, expiresAt: { gt: new Date() } },
        data: { revokedAt: new Date() },
      });
      if (revoked.count !== 1) return false;

      const replacement = await tx.refreshSession.create({
        data: { userId, tokenHash, expiresAt, authVersion },
      });
      await tx.refreshSession.update({
        where: { id },
        data: { replacedById: replacement.id },
      });
      return true;
    });
  },

  revoke(id: string) {
    return prisma.refreshSession.updateMany({
      where: { id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  },

  revokeAllForUser(userId: string, authVersion?: number) {
    return prisma.refreshSession.updateMany({
      where: { userId, authVersion, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  },
};
