import usersAtActivitiesRepository from "../repositories/usersAtActivitiesRepository";
import activitiesRepository from "../repositories/activitiesRepository";
import checkInRepository from "../repositories/checkInRepository";
import userEventRepository from "../repositories/userEventRepository";
import userRepository from "../repositories/usersRepository";
import eventRepository from "../repositories/eventRepository";
import usersRepository from "../repositories/usersRepository";
import { UpdateUserAtActivityDTOS, CreateUserAtActivityDTOS } from "../dtos/userAtActivitiesDtos";
import { ApiError, ErrorsCode } from "../utils/api-errors";


export default {
  async findManyByActivityId(activityId: string) {
    const activity = await activitiesRepository.findById(activityId);

    if (!activity) {
      throw new ApiError("Atividade não encontrada", ErrorsCode.NOT_FOUND);
    }
    const usersAtActivities = await usersAtActivitiesRepository.findManyByActivityId(activityId);

    return usersAtActivities;
  },

  async findManyByUserId(userId: string) {
    const usersAtActivities = await usersAtActivitiesRepository.findManyByUserId(userId);

    return usersAtActivities;
  },

  async getActivityEnrollmentSummary(activityId: string, userId: string) {
    const activity = await activitiesRepository.findById(activityId);
    if (!activity) {
      throw new ApiError("Atividade não encontrada", ErrorsCode.NOT_FOUND);
    }

    return usersAtActivitiesRepository.getActivityEnrollmentSummary(activityId, userId);
  },

  async findUserAtActivity(userId: string, activityId: string) {
    const userAtActivity = await checkInRepository.findUserAtActivity(userId, activityId);

    return userAtActivity;
  },

  async create({ userId, activityId }: CreateUserAtActivityDTOS) {
    const currentEvent = await eventRepository.findCurrent();
    if (!currentEvent) {
      throw new ApiError("Nenhum evento ativo no momento, não é possivel fazer inscrição", ErrorsCode.CONFLICT);
    }
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new ApiError("Usuário não encontrado", ErrorsCode.NOT_FOUND);
    }
    const registration = await userEventRepository.getUserRegistration(userId, currentEvent.id);
    if (!registration || registration.status !== 1) {
      throw new ApiError("Você precisa estar inscrito no evento anual para participar das atividades", ErrorsCode.CONFLICT);
    }

    const result = await usersAtActivitiesRepository.createWithCapacity(userId, activityId);
    if (result.status === "duplicate") {
      throw new ApiError("Usuário já está inscrito nesta atividade", ErrorsCode.CONFLICT);
    }
    if (result.status === "activity-not-found") {
      throw new ApiError("Atividade não encontrada", ErrorsCode.NOT_FOUND);
    }
    if (result.status === "capacity-undefined") {
      throw new ApiError("Número de vagas da atividade não definido", ErrorsCode.CONFLICT);
    }

    return result.enrollment;
  },

  async update(id: string, { presente, inscricaoPrevia, listaEspera }: UpdateUserAtActivityDTOS) {
    const existingUserAtActivity = await usersAtActivitiesRepository.findById(id);

    if (!existingUserAtActivity) {
      throw new ApiError("Registro não encontrado", ErrorsCode.NOT_FOUND);
    }
    if (presente === true && existingUserAtActivity.presente === false) {
      const activity = await activitiesRepository.findById(existingUserAtActivity.activityId);

      if (activity && activity.points && activity.points > 0) {
        await userRepository.addPoints(existingUserAtActivity.userId, activity.points);
      }
    }
    const updatedUserAtActivity = await usersAtActivitiesRepository.update(id, {
      presente: presente ?? existingUserAtActivity.presente,
      inscricaoPrevia: inscricaoPrevia ?? existingUserAtActivity.inscricaoPrevia,
      listaEspera: listaEspera ?? existingUserAtActivity.listaEspera,
    });

    return updatedUserAtActivity;
  },

  async delete(userId: string, activityId: string) {
    const userAtActivity = await checkInRepository.findUserAtActivity(userId, activityId);

    if (!userAtActivity) {
      throw new ApiError("Registro não encontrado", ErrorsCode.NOT_FOUND);
    }

    if (userAtActivity.presente === true){
      const activity = await activitiesRepository.findById(activityId);
      if (!activity) {
        throw new ApiError("Atividade não encontrada", ErrorsCode.NOT_FOUND);
      }

      const points = activity.points;
      await usersRepository.removePoints(userId, points);
    }

    await usersAtActivitiesRepository.deleteAndPromote(userAtActivity.id, activityId);

    return userAtActivity;
  },
};
