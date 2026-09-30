import attendanceRepository from "../repositories/attendanceRepository";
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

    const result = await usersAtActivitiesRepository.createWithCapacity(userId, activityId, true);
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

  update: (id: string, data: UpdateUserAtActivityDTOS) => attendanceRepository.update(id, data),
  delete: (userId: string, activityId: string) => attendanceRepository.remove(userId, activityId),
};
