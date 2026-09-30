import { userIdentitySelect } from "../dtos/userResponses";
import { prisma } from "../lib/prisma";
import { ApiError, ErrorsCode } from "../utils/api-errors";
import { lockAttendanceUser } from "./attendanceRepository";
import { Prisma } from "@prisma/client";
import { lockEditionState, publicEventSelect, requireEdition, syncRegistrationProfile } from "./editionState";
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
      include: { event: { select: publicEventSelect } },
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
      where: { eventId, status: 1 },
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
    if (![0, 1, 2].includes(data.status)) throw new ApiError("Status de inscrição inválido", ErrorsCode.BAD_REQUEST);
    return prisma.$transaction(async (transaction) => {
      await lockEditionState(transaction);
      await lockAttendanceUser(transaction, data.userId);
      const event = await requireEdition(transaction, data.eventId);
      if (event.registrationsClosed) throw new ApiError("Inscrições desta edição estão encerradas", ErrorsCode.CONFLICT);
      const registration = await transaction.userEvent.create({ data });
      await syncRegistrationProfile(transaction, data.userId, data.eventId, registration.status);
      return toUserEventDTO(registration);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
  },

  async update(id: string, data: UpdateUserEventDTOS): Promise<UserEventDTOS> {
    if (data.status !== undefined && ![0, 1, 2].includes(data.status)) throw new ApiError("Status de inscrição inválido", ErrorsCode.BAD_REQUEST);
    const hint = await prisma.userEvent.findUnique({ where: { id }, select: { userId: true } });
    if (!hint) throw new ApiError("Inscrição não encontrada", ErrorsCode.NOT_FOUND);
    return prisma.$transaction(async tx => {
      await lockEditionState(tx);
      await lockAttendanceUser(tx, hint.userId);
      const old = await tx.userEvent.findUnique({ where: { id } });
      if (!old) throw new ApiError("Inscrição não encontrada", ErrorsCode.NOT_FOUND);
      const status = data.status ?? old.status;
      const event = await requireEdition(tx, old.eventId);
      if ((old.status === 2 || event.registrationsClosed) && status !== 2) throw new ApiError("Inscrições encerradas não podem ser reativadas", ErrorsCode.CONFLICT);
      const response = await tx.userEvent.update({ where: { id }, data: { status } });
      await syncRegistrationProfile(tx, old.userId, old.eventId, status);
      return toUserEventDTO(response);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
  },

  async updateStatusForUsers(userIds: string[], eventId: string, status: number): Promise<void> {
    await updateRegistrationStatuses(eventId, status, userIds);
  },

  async deleteWithActivitiesAndWaitlist(id: string, userId: string): Promise<void> {
    await prisma.$transaction(async (transaction) => {
      await lockEditionState(transaction, true);
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

      const event = await requireEdition(transaction, registration.eventId);
      await syncRegistrationProfile(transaction, userId, registration.eventId, null);
      if (registration.status === 1 && !event.registrationsClosed) {
        const queue = await transaction.$queryRaw<Array<{ id: string; userId: string }>>`
          SELECT id, userId FROM userEvent WHERE eventId = ${registration.eventId} AND status = 0
          ORDER BY createdAt, id LIMIT 1 FOR UPDATE`;
        const nextInLine = queue[0];
        if (nextInLine) {
          await transaction.userEvent.update({ where: { id: nextInLine.id }, data: { status: 1 } });
          await syncRegistrationProfile(transaction, nextInLine.userId, registration.eventId, 1);
        }
      }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
  },

  async createForAllUsers(eventId: string): Promise<void> {
    
  },

  async closeAllForEvent(eventId: string): Promise<void> {
    await updateRegistrationStatuses(eventId, 2);
  },

  async updateAllUsersToStatus(eventId: string, status: number): Promise<void> {
    await updateRegistrationStatuses(eventId, status);
  },
};

async function updateRegistrationStatuses(eventId: string, status: number, userIds?: string[]) {
  if (![0, 1, 2].includes(status)) throw new ApiError("Status de inscrição inválido", ErrorsCode.BAD_REQUEST);
  await prisma.$transaction(async tx => {
    await lockEditionState(tx, true);
    const event = await requireEdition(tx, eventId);
    if (event.registrationsClosed && status !== 2) throw new ApiError("Inscrições desta edição estão encerradas", ErrorsCode.CONFLICT);
    if (status !== 2 && await tx.userEvent.count({ where: { eventId, status: 2, ...(userIds ? { userId: { in: userIds } } : {}) } })) throw new ApiError("Inscrições encerradas não podem ser reativadas", ErrorsCode.CONFLICT);
    await tx.userEvent.updateMany({ where: { eventId, ...(userIds ? { userId: { in: userIds } } : {}) }, data: { status } });
    if (!userIds && status === 2) await tx.event.update({ where: { id: eventId }, data: { registrationsClosed: true } });
    if (event.isCurrent) {
      await tx.$executeRaw`UPDATE users AS u JOIN userEvent AS r ON r.userId = u.id AND r.eventId = ${eventId}
        SET u.registrationStatus = r.status, u.currentEdition = ${event.year.toString()}`;
    }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
}
