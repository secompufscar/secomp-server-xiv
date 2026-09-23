import activitiesRepository from "../repositories/activitiesRepository";
import usersAtActivitiesRepository from "../repositories/usersAtActivitiesRepository";
import { ApiError, ErrorsCode } from "../utils/api-errors";
import { UpdateActivityDTOS, CreateActivityDTOS, ActivityDTOS } from "../dtos/activitiesDtos";
import schedulerService from "./schedulerService";
import { Activity } from "@prisma/client";
import eventRepository from "../repositories/eventRepository";

async function resolveEventId(eventId?: string): Promise<string> {
  const event = eventId
    ? await eventRepository.findById(eventId)
    : await eventRepository.findCurrent();

  if (!event) {
    throw new ApiError(
      eventId ? "Evento não encontrado" : "Nenhum evento atual definido para associar a atividade",
      eventId ? ErrorsCode.NOT_FOUND : ErrorsCode.CONFLICT,
    );
  }
  return event.id;
}

export default {
  async findById(id: string): Promise<ActivityDTOS> {
    const atividade = await activitiesRepository.findById(id);

    if (!atividade) {
      throw new ApiError("Atividade não encontrada", ErrorsCode.NOT_FOUND);
    }

    return atividade;
  },

  async list(): Promise<ActivityDTOS[]> {
    const activities = await activitiesRepository.list();
    return activities;
  },

  async create({ nome, data, palestranteNome, categoriaId, eventId, vagas, detalhes, local, points }: CreateActivityDTOS): Promise<ActivityDTOS> {
    const newData = data ? new Date(data) : null;
    const resolvedEventId = await resolveEventId(eventId);

    const newAtividade = await activitiesRepository.create({
      nome,
      data: newData,
      palestranteNome,
      categoriaId,
      eventId: resolvedEventId,
      vagas,
      detalhes,
      local,
      points,
    });

    schedulerService.scheduleNotificationsForActivity(newAtividade as Activity);

    return newAtividade;
  },

  async update(
    id: string,
    { nome, data, palestranteNome, vagas, categoriaId, eventId, detalhes, local, points }: UpdateActivityDTOS,
  ): Promise<ActivityDTOS> {
    const existingAtividade = await activitiesRepository.findById(id);

    if (!existingAtividade) {
      throw new ApiError("Atividade não encontrada", ErrorsCode.NOT_FOUND);
    }

    const resolvedEventId = eventId !== undefined
      ? await resolveEventId(eventId)
      : existingAtividade.eventId ?? await resolveEventId();

    const updatedAtividade = await activitiesRepository.update(id, {
      nome,
      data,
      vagas,
      palestranteNome,
      categoriaId,
      eventId: resolvedEventId,
      detalhes,
      local,
      points,
    });

    schedulerService.scheduleNotificationsForActivity(updatedAtividade as Activity);

    return updatedAtividade;
  },

  async delete(id: string): Promise<void> {
    await usersAtActivitiesRepository.deleteByActivityId(id);
    await activitiesRepository.delete(id);
  },
};
