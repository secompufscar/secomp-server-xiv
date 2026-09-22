import { userIdentitySelect } from "../dtos/userResponses";
import { UserAtActivity } from "@prisma/client";
import { prisma } from "../lib/prisma";

export default {
  async findUserAtActivity(userId: string, activityId: string): Promise<UserAtActivity | null> {
    const response = await prisma.userAtActivity.findFirst({
      where: {
        userId,
        activityId,
      },
    });
    return response;
  },

  async markAsPresent(userAtActivityId: string): Promise<UserAtActivity> {
    const response = await prisma.userAtActivity.update({
      where: { id: userAtActivityId },
      data: { presente: true },
    });
    return response;
  },

  async markAsPresentWithoutSubscription(userId: string, activityId: string): Promise<UserAtActivity> {
    const existing = await prisma.userAtActivity.findFirst({
      where: { userId, activityId },
    });

    if (existing) {
      return prisma.userAtActivity.update({
        where: { id: existing.id },
        data: { presente: true },
      });
    }

    return prisma.userAtActivity.create({
      data: {
        userId,
        activityId,
        inscricaoPrevia: false,
        listaEspera: false,
        presente: true,
      },
    });
  },
  
  async createWaitlistEntry(userId: string, activityId: string): Promise<UserAtActivity> {
    const response = await prisma.userAtActivity.create({
      data: {
        userId,
        activityId,
        inscricaoPrevia: false,
        listaEspera: true,
        presente: false,
      },
    });
    return response;
  },

  async findParticipantsByActivity(activityId: string): Promise<UserAtActivity[]> {
    const response = await prisma.userAtActivity.findMany({
      where: {
        activityId,
      },
      include: {
        user: { select: userIdentitySelect },
      },
    });
    return response;
  },
};