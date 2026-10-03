import { prisma } from "../lib/prisma"; 
import { UpdateActivityDTOS, CreateActivityDTOS, ActivityDTOS } from "../dtos/activitiesDtos";
import { lockEditionState } from "./editionState";
import { ApiError, ErrorsCode } from "../utils/api-errors";

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
      const rows = await tx.$queryRaw<Array<{ vagas: number | null }>>`
        SELECT vagas FROM atividades WHERE id = ${id} FOR UPDATE`;
      if (!rows.length) throw new ApiError("Atividade não encontrada", ErrorsCode.NOT_FOUND);
      const updated = await tx.activity.update({ data, where: { id } });
      if (data.vagas !== undefined && data.vagas !== null && data.vagas !== rows[0].vagas) {
        const enrollments = await tx.userAtActivity.findMany({
          where: { activityId: id },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          select: { id: true, presente: true, listaEspera: true },
        });
        const presentCount = enrollments.filter(row => row.presente).length;
        if (data.vagas < presentCount) {
          throw new ApiError(`Não é possível reduzir abaixo de ${presentCount} pessoas com presença registrada.`, ErrorsCode.CONFLICT);
        }
        const confirmed = enrollments.filter(row => !row.listaEspera && !row.presente);
        const confirmedLimit = data.vagas - presentCount;
        const excess = confirmed.slice(confirmedLimit);
        if (excess.length) {
          await tx.userAtActivity.updateMany({
            where: { id: { in: excess.map(row => row.id) } },
            data: { listaEspera: true },
          });
        }
        const available = Math.max(0, confirmedLimit - confirmed.length);
        const promoted = enrollments.filter(row => row.listaEspera && !row.presente).slice(0, available);
        if (promoted.length) {
          await tx.userAtActivity.updateMany({
            where: { id: { in: promoted.map(row => row.id) } },
            data: { listaEspera: false, inscricaoPrevia: true },
          });
        }
      }
      return updated;
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
