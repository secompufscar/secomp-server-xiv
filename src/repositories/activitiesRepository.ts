import { prisma } from "../lib/prisma"; 
import { UpdateActivityDTOS, CreateActivityDTOS, ActivityDTOS } from "../dtos/activitiesDtos";
import { lockEditionState } from "./editionState";

export default {
  async list(): Promise<ActivityDTOS[]> {
    const response = await prisma.activity.findMany({ include: { categoria: true } });
    return response;
  },

  async findById(id: string): Promise<ActivityDTOS | null> {
    const response = await prisma.activity.findUnique({
      where: { id },
      include: { categoria: true },
    });
    return response;
  },

  async findManyByCategoryId(categoriaId: string): Promise<ActivityDTOS[]> {
    const response = await prisma.activity.findMany({
      where: { categoriaId },
      include: { categoria: true },
    });
    return response;
  },

  async create(data: CreateActivityDTOS): Promise<ActivityDTOS> { 
    return prisma.$transaction(async tx => {
      await lockEditionState(tx);
      return tx.activity.create({ data });
    });
  },

  async update(id: string, data: UpdateActivityDTOS): Promise<ActivityDTOS> {
    return prisma.$transaction(async tx => {
      await lockEditionState(tx);
      return tx.activity.update({ data, where: { id } });
    });
  },

  async delete(id: string): Promise<void> {
    await prisma.$transaction(async (transaction) => {
      await lockEditionState(transaction);
      // Match check-in/cancellation lock order before touching attendance rows.
      await transaction.$queryRaw`SELECT id FROM atividades WHERE id = ${id} FOR UPDATE`;
      await transaction.userAtActivity.deleteMany({ where: { activityId: id } });
      await transaction.activity.delete({ where: { id } });
    });
  },
};
