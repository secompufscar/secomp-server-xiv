import { Request, Response } from "express";
import checkInService from "../services/checkInService";
import checkInRepository from "../repositories/checkInRepository";
import attendanceRepository from "../repositories/attendanceRepository";

export default {
  async presentSummary(request: Request, response: Response) {
    response.status(200).json(await attendanceRepository.presentSummary(request.params.activityId));
  },
  async checkIn(request: Request, response: Response) {
    const { userId, activityId } = request.params;

    const data = await checkInService.checkIn(userId, activityId);
    response.status(200).json(data);
  },
  
  async listParticipants(request: Request, response: Response) {
    const { activityId } = request.params;

    const participants = await checkInRepository.findParticipantsByActivity(activityId);
    response.status(200).json(participants);
  },
};
