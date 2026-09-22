import { userIdentitySelect } from "../dtos/userResponses";
// IMPORTANTE: Usar a instância única do Prisma.
import { prisma } from "../lib/prisma";
import { UserAtActivity } from "../entities/UserAtActivity";
import { UpdateUserAtActivityDTOS, CreateUserAtActivityDTOS } from "../dtos/userAtActivitiesDtos";

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

  async create(data: CreateUserAtActivityDTOS): Promise<CreateUserAtActivityDTOS> {
    const response = await prisma.userAtActivity.create({ data });
    return response;
  },

  async update(id: string, data: UpdateUserAtActivityDTOS): Promise<UpdateUserAtActivityDTOS> {
    const response = await prisma.userAtActivity.update({
      where: { id },
      data,
    });
    return response;
  },

  async findFirstInWaitlist(activityId: string): Promise<UserAtActivity | null> {
    const response = await prisma.userAtActivity.findFirst({
      where: {
        activityId,
        listaEspera: true,
      },
      orderBy: {
        createdAt: "asc",
      },
    });
    return response;
  },

  async delete(id: string): Promise<void> {
    await prisma.userAtActivity.delete({
      where: { id },
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
