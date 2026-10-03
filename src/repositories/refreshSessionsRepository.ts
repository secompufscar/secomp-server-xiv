import { prisma } from "../lib/prisma";
import { withDatabaseConnectionRetry } from "../lib/databaseConnection";
import { Prisma } from "@prisma/client";
import { ApiError, ErrorsCode } from "../utils/api-errors";

async function lockUserVersion(tx: Prisma.TransactionClient, userId: string, authVersion: number) {
  const users = await tx.$queryRaw<Array<{ authVersion: number }>>`
    SELECT authVersion FROM users WHERE id = ${userId} FOR UPDATE`;
  return users.length === 1 && users[0].authVersion === authVersion;
}

export default {
  findByHash(tokenHash: string) {
    return withDatabaseConnectionRetry("refresh-lookup", () => prisma.refreshSession.findUnique({ where: { tokenHash } }));
  },

  create(userId: string, tokenHash: string, expiresAt: Date, authVersion = 0) {
    let writeStarted = false;
    return withDatabaseConnectionRetry("session-create", () => prisma.$transaction(async tx => {
      if (!await lockUserVersion(tx, userId, authVersion)) {
        throw new ApiError("Credenciais alteradas; faça login novamente", ErrorsCode.UNAUTHORIZED);
      }
      writeStarted = true;
      return tx.refreshSession.create({ data: { userId, tokenHash, expiresAt, authVersion } });
    }), () => !writeStarted);
  },

  async rotate(id: string, userId: string, tokenHash: string, expiresAt: Date, authVersion = 0) {
    let writeStarted = false;
    return withDatabaseConnectionRetry("session-rotate", () => prisma.$transaction(async tx => {
      if (!await lockUserVersion(tx, userId, authVersion)) return false;
      writeStarted = true;
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
    }), () => !writeStarted);
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
