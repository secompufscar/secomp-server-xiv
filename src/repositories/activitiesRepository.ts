import { prisma } from "../lib/prisma"; 
import { UpdateActivityDTOS, CreateActivityDTOS, ActivityDTOS } from "../dtos/activitiesDtos";

export default {
  async list(): Promise<ActivityDTOS[]> {
    const response = await prisma.activity.findMany();
    return response;
  },

  async findById(id: string): Promise<ActivityDTOS | null> {
    const response = await prisma.activity.findUnique({
      where: { id },
    });
    return response;
  },

  async findManyByCategoryId(categoriaId: string): Promise<ActivityDTOS[]> {
    const response = await prisma.activity.findMany({
      where: { categoriaId },
    });
    return response;
  },

  async isActivityFull(activityId: string): Promise<boolean> {
    const activity = await prisma.activity.findUnique({
      where: { id: activityId },
      select: { vagas: true },
    });

    if (!activity || activity.vagas === null) {
      throw new Error("Atividade não encontrada ou número de vagas não definido.");
    }

    const countUsersAtActivity = await prisma.userAtActivity.count({
      where: {
        activityId,
        listaEspera: false,
      },
    });

    return countUsersAtActivity >= activity.vagas;
  },

  async create(data: CreateActivityDTOS): Promise<ActivityDTOS> { 
    const response = await prisma.activity.create({ data });
    return response;
  },

  async update(id: string, data: UpdateActivityDTOS): Promise<UpdateActivityDTOS> {
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
