import { userIdentitySelect } from "../dtos/userResponses";
import { UserAtActivity } from "../entities/UserAtActivity";
import { attendanceResponse } from "./attendanceRepository";
import { prisma } from "../lib/prisma";

export default {
  async findUserAtActivity(userId: string, activityId: string): Promise<UserAtActivity | null> {
    const response = await prisma.userAtActivity.findFirst({
      where: {
        userId,
        activityId,
      },
    });
    return response ? attendanceResponse(response) : null;
  },

  async findParticipantsByActivity(activityId: string): Promise<UserAtActivity[]> {
    const response = await prisma.userAtActivity.findMany({
      where: {
        activityId,
      },
      include: {
        user: { select: userIdentitySelect },
      },
    });
    return response.map(attendanceResponse);
  },
};