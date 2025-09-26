import checkInRepository from "../repositories/checkInRepository";
import activitiesRepository from "../repositories/activitiesRepository";
import usersRepository from "../repositories/usersRepository";
import eventService from "./eventService";
import { UserAtActivity } from "../entities/UserAtActivity";
import { ApiError, ErrorsCode } from "../utils/api-errors";

export default {
  async checkIn(userId: string, activityId: string): Promise<UserAtActivity> {
    const activity = await activitiesRepository.findById(activityId);

    if (!activity) {
      throw new ApiError("Atividade não encontrada", ErrorsCode.NOT_FOUND);
    }

    const registration = await eventService.getUserRegistration(userId);
    if (!registration || registration.status !== 1) {
      throw new ApiError("Usuário não esta inscrito neste evento!", ErrorsCode.BAD_REQUEST);
    }

    const userAtActivity = await checkInRepository.findUserAtActivity(userId, activityId);

    if (userAtActivity?.presente === true){
      throw new ApiError("Este usuário já realizou o check-in nesta atividade", ErrorsCode.CONFLICT);
    }

    if (userAtActivity?.listaEspera === true) {
      throw new ApiError("Usuário está na lista de espera e não pode realizar o check-in", ErrorsCode.FORBIDDEN);
    }

    if (activity.categoriaId === "1") {
      if (!userAtActivity) {
        throw new ApiError("Usuário não está cadastrado na atividade", ErrorsCode.BAD_REQUEST);
      }

      const pointsToAdd = activity.points;
      await usersRepository.addPoints(userId, pointsToAdd);

      const updatedUserAtActivity = await checkInRepository.markAsPresent(userAtActivity.id);

      return updatedUserAtActivity;
    }

    const pointsToAdd = activity.points;
    await usersRepository.addPoints(userId, pointsToAdd);

    const updatedUserAtActivity = await checkInRepository.markAsPresentWithoutSubscription(userId, activityId);

    return updatedUserAtActivity;
  },
};
