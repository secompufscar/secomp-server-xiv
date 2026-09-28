import { Prisma } from '@prisma/client';
import { prisma } from "../lib/prisma";
import { CreateNotificationDTO } from "../dtos/notificationsDtos";
import { userIdentitySelect } from "../dtos/userResponses";

const notificationSelect = {
  id: true, title: true, message: true, data: true, status: true, sentAt: true,
  sender: { select: userIdentitySelect },
} satisfies Prisma.NotificationHistorySelect;

export default {
  async create(data: CreateNotificationDTO) {
    return prisma.notificationHistory.create({
      data: {
        title: data.title,
        message: data.message,
        data: data.data as Prisma.InputJsonValue, 
        status: data.status || "PENDING",
        error: null, 
        createdBy: data.createdBy || null, 
        recipients: {
          connect: data.recipientIds.map(id => ({ id }))
        }
      },
      select: notificationSelect
    });
  },

  async updateStatus(id: string, status: 'SENT' | 'FAILED', error?: string) {
    return prisma.notificationHistory.update({
      where: { id },
      select: notificationSelect,
      data: {
        status,
        error: error || null,
      },
    });
  },

  async findById(id: string) {
    return prisma.notificationHistory.findUnique({
      where: { id },
      select: notificationSelect
    });
  },

  async findManyByIds(ids: string[]) {
    return prisma.notificationHistory.findMany({
      where: { id: { in: ids } },
      select: notificationSelect
    });
  },

  async findByUserId(userId: string) {
    return prisma.notificationHistory.findMany({
      where: {
        recipients: {
          some: { id: userId }
        }
      },
      select: notificationSelect
    });
  },
};