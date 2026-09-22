import { userIdentitySelect } from "../dtos/userResponses";
import { prisma } from "../lib/prisma";
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

  async create(data: CreateUserEventDTOS): Promise<UserEventDTOS> {
    const response = await prisma.userEvent.create({ data });
    return toUserEventDTO(response);
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

  async delete(id: string): Promise<void> {
    await prisma.userEvent.delete({ where: { id } });
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