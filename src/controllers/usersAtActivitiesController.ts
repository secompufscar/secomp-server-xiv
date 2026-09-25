import { Request, Response } from "express";

import usersAtActivities from "../services/usersAtActivitiesService";

export default {
  async getEnrollmentSummary(request: Request, response: Response) {
    const { activityId } = request.params;
    const userId = request.user.id;
    if (!userId) {
      return response.status(401).json({ error: "Usuário não autenticado" });
    }

    const data = await usersAtActivities.getActivityEnrollmentSummary(activityId, userId);

    response.status(200).json(data);
  },

  async findById(request: Request, response: Response) {
    const { activityId } = request.params;

    const data = await usersAtActivities.findManyByActivityId(activityId);

    response.status(200).json(data);
  },

  async findByUserId(request: Request, response: Response) {
    const { userId } = request.params;

    const data = await usersAtActivities.findManyByUserId(userId);

    response.status(200).json(data);
  },

  async findByUserIdActivityId(request: Request, response: Response) {
    const { userId, activityId } = request.params;

    const data = await usersAtActivities.findUserAtActivity(userId, activityId);

    response.status(200).json(data);
  },

  async create(request: Request, response: Response) {
    const userId = request.user.id;
    if (!userId) {
      return response.status(401).json({ error: "Usuário não autenticado" });
    }

    const { activityId, presente, inscricaoPrevia, listaEspera } = request.body;

    const data = await usersAtActivities.create({
      userId,
      activityId,
      presente,
      inscricaoPrevia,
      listaEspera,
    });

    response.status(201).json(data);
  },

  async update(request: Request, response: Response) {
    const { id } = request.params;

    const data = await usersAtActivities.update(id, request.body);

    response.status(200).json(data);
  },

  async delete(request: Request, response: Response) {
    const { userId, activityId } = request.params;

    await usersAtActivities.delete(userId, activityId);

    response.status(200).send();
  },
};
