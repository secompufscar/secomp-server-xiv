import { prisma } from "../lib/prisma";
import { withDatabaseConnectionRetry } from "../lib/databaseConnection";
import { Prisma } from "@prisma/client";
import { eventResponse, lockEditionState, projectCurrentEdition, requireEdition } from "./editionState";
import { CreateEventDTOS, UpdateEventDTOS, EventDTOS } from "../dtos/eventDtos";

export default {
  async list(): Promise<EventDTOS[]> {
    const response = await prisma.event.findMany({
      orderBy: { startDate: "desc" },
    });
    return response.map(eventResponse);
  },

  async findById(id: string): Promise<EventDTOS | null> {
    const response = await prisma.event.findUnique({
      where: { id },
    });
    return response ? eventResponse(response) : null;
  },

  async findCurrent(): Promise<EventDTOS | null> {
    const response = await withDatabaseConnectionRetry("current-event", () => prisma.event.findFirst({
      where: { isCurrent: true },
    }));
    return response ? eventResponse(response) : null;
  },

  async createWithRegistrationReset(data: CreateEventDTOS): Promise<EventDTOS> {
    return prisma.$transaction(async (transaction) => {
      await lockEditionState(transaction, true);
      const current = data.isCurrent ?? true;
      if (current) await transaction.event.updateMany({ where: { isCurrent: true }, data: { isCurrent: false } });
      const event = await transaction.event.create({ data: { ...data, isCurrent: current } });
      if (event.isCurrent) await projectCurrentEdition(transaction, event.id);
      return eventResponse(event);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
  },

  async update(id: string, data: UpdateEventDTOS): Promise<EventDTOS> {
    return prisma.$transaction(async tx => {
      await lockEditionState(tx, true);
      const old = await requireEdition(tx, id);
      const current = data.isCurrent ?? old.isCurrent;
      if (current) await tx.event.updateMany({ where: { isCurrent: true, id: { not: id } }, data: { isCurrent: false } });
      const event = await tx.event.update({ where: { id }, data });
      if (current && (!old.isCurrent || old.year !== event.year)) await projectCurrentEdition(tx, id);
      else if (old.isCurrent && !current) await tx.user.updateMany({ where: { currentEdition: old.year.toString() }, data: { registrationStatus: 0, currentEdition: null } });
      return eventResponse(event);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
  },

  async deactivate(id: string): Promise<EventDTOS> {
    return prisma.$transaction(async tx => {
      await lockEditionState(tx, true);
      const old = await requireEdition(tx, id);
      await tx.userEvent.updateMany({ where: { eventId: id }, data: { status: 2 } });
      const event = await tx.event.update({ where: { id }, data: { endDate: new Date(), registrationsClosed: true } });
      if (old.isCurrent) await projectCurrentEdition(tx, id);
      return eventResponse(event);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
  },

  async deleteWithRegistrationClosure(id: string): Promise<void> {
    await prisma.$transaction(async (transaction) => {
      await lockEditionState(transaction, true);
      const deletedEvent = await transaction.event.delete({ where: { id } });
      await transaction.user.updateMany({
        where: { currentEdition: deletedEvent.year.toString() },
        data: { registrationStatus: 2 },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
  },
};
