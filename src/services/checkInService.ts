import attendanceRepository from "../repositories/attendanceRepository";
export default { checkIn: (userId: string, activityId: string) => attendanceRepository.checkIn(userId, activityId) };
