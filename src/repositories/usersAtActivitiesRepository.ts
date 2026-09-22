import { userIdentitySelect } from "../dtos/userResponses";
// IMPORTANTE: Usar a instância única do Prisma.
import { prisma } from "../lib/prisma";
import { Prisma } from "@prisma/client";
import { UserAtActivity } from "../entities/UserAtActivity";
import { UpdateUserAtActivityDTOS } from "../dtos/userAtActivitiesDtos";

type EnrollmentCreationResult =
  | { status: "created"; enrollment: UserAtActivity }
  | { status: "duplicate" }
  | { status: "activity-not-found" }
  | { status: "capacity-undefined" };

async function lockActivity(tx: Prisma.TransactionClient, activityId: string) {
  const rows = await tx.$queryRaw<{ vagas: number | null }[]>(Prisma.sql`
    SELECT vagas FROM atividades WHERE id = ${activityId} FOR UPDATE
  `);
  return rows[0];
}

async function lockOccupiedEnrollments(tx: Prisma.TransactionClient, activityId: string) {
  return tx.$queryRaw<{ id: string }[]>(Prisma.sql`
    SELECT id FROM userAtActivity
    WHERE activityId = ${activityId} AND listaEspera = FALSE
    FOR UPDATE
  `);
}

export default {
  async list(): Promise<UserAtActivity[]> {
    const response = await prisma.userAtActivity.findMany();
    return response;
  },

  async findById(id: string): Promise<UserAtActivity | null> {
    const response = await prisma.userAtActivity.findUnique({
      where: { id },
    });
    return response;
  },

  async findManyByActivityId(activityId: string): Promise<UserAtActivity[]> {
    const response = await prisma.userAtActivity.findMany({
      where: { activityId },
      include: { user: { select: userIdentitySelect } },
    });
    return response;
  },

  async findManyByUserId(userId: string): Promise<UserAtActivity[]> {
    const response = await prisma.userAtActivity.findMany({
      where: { userId },
      include: {
        user: { select: userIdentitySelect },
        activity: true,
      },
    });
    return response;
  },

  async findByUserIdAndActivityId(userId: string, activityId: string): Promise<UserAtActivity | null> {
    const response = await prisma.userAtActivity.findFirst({
      where: { userId, activityId },
    });
    return response;
  },

  async createWithCapacity(userId: string, activityId: string): Promise<EnrollmentCreationResult> {
    try {
      return await prisma.$transaction(async tx => {
        const activity = await lockActivity(tx, activityId);
        if (!activity) return { status: "activity-not-found" } as const;
        if (activity.vagas === null) return { status: "capacity-undefined" } as const;

        const existing = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
          SELECT id FROM userAtActivity
          WHERE userId = ${userId} AND activityId = ${activityId}
          LIMIT 1 FOR UPDATE
        `);
        if (existing.length > 0) return { status: "duplicate" } as const;

        const occupied = await lockOccupiedEnrollments(tx, activityId);
        const enrollment = await tx.userAtActivity.create({
          data: {
            userId,
            activityId,
            presente: false,
            inscricaoPrevia: true,
            listaEspera: occupied.length >= activity.vagas,
          },
        });
        return { status: "created", enrollment } as const;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return { status: "duplicate" };
      }
      throw error;
    }
  },

  async update(id: string, data: UpdateUserAtActivityDTOS): Promise<UpdateUserAtActivityDTOS> {
    const response = await prisma.userAtActivity.update({
      where: { id },
      data,
    });
    return response;
  },

  async deleteAndPromote(id: string, activityId: string): Promise<void> {
    await prisma.$transaction(async tx => {
      const activity = await lockActivity(tx, activityId);
      if (!activity) throw new Error("Atividade não encontrada");

      await tx.userAtActivity.delete({ where: { id } });
      if (activity.vagas === null) return;

      const occupied = await lockOccupiedEnrollments(tx, activityId);
      if (occupied.length >= activity.vagas) return;

      const nextInLine = await tx.userAtActivity.findFirst({
        where: { activityId, listaEspera: true },
        orderBy: { createdAt: "asc" },
      });
      if (nextInLine) {
        await tx.userAtActivity.update({
          where: { id: nextInLine.id },
          data: { listaEspera: false, inscricaoPrevia: true, presente: false },
        });
      }
    });
  },

  async deleteByUserId(userId: string): Promise<void> {
    await prisma.userAtActivity.deleteMany({
      where: { userId },
    });
  },

  async countByUserId(userId: string): Promise<number> {
    const count = await prisma.userAtActivity.count({
      where: { userId },
    });
    return count;
  },
  
  async deleteByActivityId(activityId: string): Promise<void> {
    await prisma.userAtActivity.deleteMany({
      where: { activityId: activityId },
    });
  },
};
