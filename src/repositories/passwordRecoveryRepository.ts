import { prisma } from "../lib/prisma";

export default {
  async consumeAndChangePassword(userId: string, authVersion: number, senha: string) {
    return prisma.$transaction(async tx => {
      // Conditional update locks the user and consumes every link from this version.
      // Concurrent attempts can update exactly one row once, even under MySQL RR.
      const changed = await tx.user.updateMany({
        where: { id: userId, authVersion },
        data: { senha, authVersion: { increment: 1 } },
      });
      if (changed.count !== 1) return false;
      await tx.refreshSession.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      return true;
    });
  },
};
