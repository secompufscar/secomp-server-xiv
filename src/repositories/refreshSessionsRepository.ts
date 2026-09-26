import { prisma } from "../lib/prisma";

export default {
  findByHash(tokenHash: string) {
    return prisma.refreshSession.findUnique({ where: { tokenHash } });
  },

  create(userId: string, tokenHash: string, expiresAt: Date) {
    return prisma.refreshSession.create({ data: { userId, tokenHash, expiresAt } });
  },

  async rotate(id: string, userId: string, tokenHash: string, expiresAt: Date) {
    return prisma.$transaction(async tx => {
      const revoked = await tx.refreshSession.updateMany({
        where: { id, revokedAt: null, expiresAt: { gt: new Date() } },
        data: { revokedAt: new Date() },
      });
      if (revoked.count !== 1) return false;

      const replacement = await tx.refreshSession.create({
        data: { userId, tokenHash, expiresAt },
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

  revokeAllForUser(userId: string) {
    return prisma.refreshSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  },
};
