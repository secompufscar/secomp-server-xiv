import { Expo, ExpoPushMessage, ExpoPushTicket } from "expo-server-sdk";
import notificationsRepository from "../repositories/notificationsRepository";
import usersRepository from "../repositories/usersRepository";
import { CreateNotificationDTO } from "../dtos/notificationsDtos";

export default {
  async sendPushNotification(notificationData: CreateNotificationDTO) {
    const { title, message, recipientIds, ...rest } = notificationData;

    const historyRecord = await notificationsRepository.create({
      ...notificationData,
      status: 'PENDING',
    });

    const users = await usersRepository.findManyByIds(recipientIds);
    
    const validTokens = users
      .map(user => user.pushToken)
      .filter((token): token is string => token !== null && Expo.isExpoPushToken(token));

    if (validTokens.length === 0) {
      console.warn(`[NotificationService] No valid push tokens found for notification ID: ${historyRecord.id}`);
      await notificationsRepository.updateStatus(historyRecord.id, 'FAILED', 'Nenhum token de notificação válido encontrado.');
      return [];
    }

    const expo = new Expo();
    const messages: ExpoPushMessage[] = validTokens.map(token => ({
      to: token,
      sound: rest.sound ? 'default' : undefined,
      title,
      body: message,
      data: rest.data || {},
      badge: rest.badge || undefined,
    }));

    const chunks = expo.chunkPushNotifications(messages);
    const tickets: ExpoPushTicket[] = [];
    let hasError = false;
    let errorMessage = '';

    for (const chunk of chunks) {
      try {
        const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
        tickets.push(...ticketChunk);
        
        ticketChunk.forEach(ticket => {
          if (ticket.status === 'error') {
            hasError = true;
            if (ticket.details?.error) {
              errorMessage += `[${ticket.details.error}] `;
            }
          }
        });
      } catch (error: any) {
        console.error('[NotificationService] Error sending a notification chunk:', error);
        hasError = true;
        errorMessage += `${error.message}. `;
      }
    }

    if (hasError) {
      await notificationsRepository.updateStatus(historyRecord.id, 'FAILED', errorMessage.trim());
    } else {
      await notificationsRepository.updateStatus(historyRecord.id, 'SENT');
    }

    return tickets;
  },

  async getNotificationHistoryByUserId(userId: string) {
    return notificationsRepository.findByUserId(userId);
  },
};