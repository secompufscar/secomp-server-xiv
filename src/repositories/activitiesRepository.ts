import { prisma } from "../lib/prisma"; 
import { UpdateActivityDTOS, CreateActivityDTOS, ActivityDTOS } from "../dtos/activitiesDtos";

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
    const response = await prisma.activity.create({ data });
    return response;
  },

  async update(id: string, data: UpdateActivityDTOS): Promise<ActivityDTOS> {
    const response = await prisma.activity.update({
      data,
      where: { id },
    });
    return response;
  },

  async delete(id: string): Promise<void> {
    await prisma.activity.delete({
      where: { id },
    });
  },
};
