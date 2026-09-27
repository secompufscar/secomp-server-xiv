import { prisma } from "../lib/prisma";
import { CreateEventDTOS, UpdateEventDTOS, EventDTOS } from "../dtos/eventDtos";

export default {
  async list(): Promise<EventDTOS[]> {
    const response = await prisma.event.findMany({
      orderBy: { startDate: "desc" },
    });
    return response;
  },

  async findById(id: string): Promise<EventDTOS | null> {
    const response = await prisma.event.findUnique({
      where: { id },
    });
    return response;
  },

  async findCurrent(): Promise<EventDTOS | null> {
    const response = await prisma.event.findFirst({
      where: { isCurrent: true },
    });
    return response;
  },

  async createWithRegistrationReset(data: CreateEventDTOS): Promise<EventDTOS> {
    return prisma.$transaction(async (transaction) => {
      const event = await transaction.event.create({ data });
      await transaction.user.updateMany({
        where: { registrationStatus: { not: 0 } },
        data: { registrationStatus: 0 },
      });
      return event;
    });
  },

  async update(id: string, data: UpdateEventDTOS): Promise<EventDTOS> {
    const response = await prisma.event.update({
      where: { id },
      data,
    });
    return response;
  },

  async deactivate(id: string): Promise<EventDTOS> {
    const response = await prisma.event.update({
      where: { id },
      data: { endDate: new Date() },
    });
    return response;
  },

  async deleteWithRegistrationClosure(id: string): Promise<void> {
    await prisma.$transaction(async (transaction) => {
      const deletedEvent = await transaction.event.delete({ where: { id } });
      await transaction.user.updateMany({
        where: { currentEdition: deletedEvent.year.toString() },
        data: { registrationStatus: 2 },
      });
    });
  },
};
