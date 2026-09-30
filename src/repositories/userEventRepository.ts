import { userIdentitySelect } from "../dtos/userResponses";
import { prisma } from "../lib/prisma";
import { ApiError, ErrorsCode } from "../utils/api-errors";
import { lockAttendanceUser } from "./attendanceRepository";
import { Prisma } from "@prisma/client";
import { CreateUserEventDTOS, UpdateUserEventDTOS, UserEventDTOS } from "../dtos/userEventDtos";

type UserEventStatus = 0 | 1 | 2;

function toUserEventDTO<T extends { status: number }>(userEvent: T): T & { status: UserEventStatus } {
  return {
    ...userEvent,
    status: userEvent.status as UserEventStatus,
  };
}

export default {
  async list(): Promise<UserEventDTOS[]> {
    const response = await prisma.userEvent.findMany();
    return response.map(toUserEventDTO);
  },

  async findById(id: string): Promise<UserEventDTOS | null> {
    const response = await prisma.userEvent.findUnique({ where: { id } });
    return response ? toUserEventDTO(response) : null;
  },

  async findByIdAndUser(id: string, userId: string): Promise<UserEventDTOS | null> {
    const response = await prisma.userEvent.findFirst({ where: { id, userId } });
    return response ? toUserEventDTO(response) : null;
  },

  async getUserRegistration(userId: string, eventId: string): Promise<UserEventDTOS | null> {
    const response = await prisma.userEvent.findUnique({
      where: { userId_eventId: { userId, eventId } },
    });
    return response ? toUserEventDTO(response) : null;
  },

  async findByUserAndEvent(userId: string, eventId: string): Promise<UserEventDTOS | null> {
    const response = await prisma.userEvent.findUnique({
      where: { userId_eventId: { userId, eventId } },
    });
    return response ? toUserEventDTO(response) : null;
  },

  async findByUser(userId: string): Promise<UserEventDTOS[]> {
    const response = await prisma.userEvent.findMany({
      where: { userId },
      include: { event: true },
      orderBy: { event: { startDate: "desc" } },
    });
    return response.map(toUserEventDTO);
  },

  async findByEvent(eventId: string): Promise<UserEventDTOS[]> {
    const response = await prisma.userEvent.findMany({
      where: { eventId },
      include: { user: { select: userIdentitySelect } },
    });
    return response.map(toUserEventDTO);
  },

  async findActiveByEvent(eventId: string): Promise<UserEventDTOS[]> {
    const response = await prisma.userEvent.findMany({
      where: { eventId, status: 1, user: { registrationStatus: 1 } },
      include: { user: { select: userIdentitySelect } },
    });
    return response.map(toUserEventDTO);
  },

  async findFirstWaitlist(eventId: string): Promise<UserEventDTOS | null> {
    const response = await prisma.userEvent.findFirst({
      where: { eventId, status: 0 },
      orderBy: { createdAt: "asc" },
    });
    return response ? toUserEventDTO(response) : null;
  },

  async createWithUserStatus(data: CreateUserEventDTOS, eventYear: number): Promise<UserEventDTOS> {
    return prisma.$transaction(async (transaction) => {
      const registration = await transaction.userEvent.create({ data });
      await transaction.user.update({
        where: { id: data.userId },
        data: { registrationStatus: 1, currentEdition: eventYear.toString() },
      });
      return toUserEventDTO(registration);
    });
  },

  async update(id: string, data: UpdateUserEventDTOS): Promise<UserEventDTOS> {
    const response = await prisma.userEvent.update({
      where: { id },
      data,
    });
    return toUserEventDTO(response);
  },

  async updateStatusForUsers(userIds: string[], eventId: string, status: number): Promise<void> {
    await prisma.userEvent.updateMany({
      where: { userId: { in: userIds }, eventId },
      data: { status },
    });
  },

  async deleteWithActivitiesAndWaitlist(id: string, userId: string): Promise<void> {
    await prisma.$transaction(async (transaction) => {
      await lockAttendanceUser(transaction, userId);
      const registration = await transaction.userEvent.findFirst({ where: { id, userId } });
      if (!registration) {
        throw new ApiError("Inscrição não encontrada com este id e userId", ErrorsCode.NOT_FOUND);
      }

      const presences = await transaction.userAtActivity.findMany({
        where: { userId, activity: { eventId: registration.eventId } },
        select: { activityId: true, presente: true, creditedPoints: true },
      });
      const activityIds = [...new Set(presences.map(row => row.activityId))].sort();
      for (const activityId of activityIds) {
        await transaction.$queryRaw`SELECT id FROM atividades WHERE id = ${activityId} FOR UPDATE`;
      }
      // Reverse only recorded grants here; legacy annual cancellation kept unknown points.
      const credit = presences.reduce((total, row) => total + (row.presente ? row.creditedPoints ?? 0 : 0), 0);
      if (credit) {
        const adjusted = await transaction.user.updateMany({ where: { id: userId, points: { gte: credit } }, data: { points: { decrement: credit } } });
        if (adjusted.count !== 1) throw new ApiError("Saldo de pontos inconsistente; solicite revisão administrativa", ErrorsCode.CONFLICT);
      }

      await transaction.userEvent.delete({ where: { id, userId } });
      await transaction.userAtActivity.deleteMany({
        where: { userId, activity: { eventId: registration.eventId } },
      });

      for (const activityId of activityIds) {
        const activity = await transaction.activity.findUnique({ where: { id: activityId }, select: { vagas: true } });
        if (activity?.vagas === null || !activity) continue;
        const occupied = await transaction.userAtActivity.count({ where: { activityId, listaEspera: false } });
        const available = Math.max(0, activity.vagas - occupied);
        const waiting = await transaction.userAtActivity.findMany({ where: { activityId, listaEspera: true, presente: false }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: available });
        for (const row of waiting) await transaction.userAtActivity.update({ where: { id: row.id }, data: { listaEspera: false, inscricaoPrevia: true, presente: false, creditedPoints: 0 } });
      }

      const user = await transaction.user.findUnique({ where: { id: userId }, select: { currentEdition: true } });
      const event = await transaction.event.findUnique({ where: { id: registration.eventId }, select: { year: true } });
      if (event && user?.currentEdition === event.year.toString()) {
        await transaction.user.update({ where: { id: userId }, data: { registrationStatus: 0, currentEdition: null } });
      }
      const queue = await transaction.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM userEvent WHERE eventId = ${registration.eventId} AND status = 0
        ORDER BY createdAt, id LIMIT 1 FOR UPDATE`;
      const nextInLine = queue[0];
      if (nextInLine) {
        await transaction.userEvent.update({ where: { id: nextInLine.id }, data: { status: 1 } });
      }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
  },

  async createForAllUsers(eventId: string): Promise<void> {
    
  },

  async closeAllForEvent(eventId: string): Promise<void> {
    await prisma.userEvent.updateMany({ where: { eventId }, data: { status: 2 } });
  },

  async updateAllUsersToStatus(eventId: string, status: number): Promise<void> {
    await prisma.userEvent.updateMany({ where: { eventId }, data: { status } });
  },
};
