import activitiesRepository from "../repositories/activitiesRepository";
import usersAtActivitiesRepository from "../repositories/usersAtActivitiesRepository";
import notificationService from "./notificationService";
import { ActivityDTOS, CreateActivityDTOS, UpdateActivityDTOS } from "../dtos/activitiesDtos";

type SchedulableActivity = ActivityDTOS | CreateActivityDTOS | UpdateActivityDTOS;
type Timer = ReturnType<typeof setTimeout>;
type SchedulerDependencies = {
  now: () => number;
  setTimer: (callback: () => void, delay: number) => Timer;
  clearTimer: (timer: Timer) => void;
  listActivities: () => Promise<SchedulableActivity[]>;
  findParticipants: (activityId: string) => Promise<{ userId: string }[]>;
  sendNotification: typeof notificationService.sendPushNotification;
  report: (code: string) => void;
};

// Node timers overflow above this value; recheck the absolute deadline on each wake.
export const MAX_TIMER_DELAY = 2_147_483_647;
const HOUR = 60 * 60 * 1000;

export function createScheduler(overrides: Partial<SchedulerDependencies> = {}) {
  const dependencies: SchedulerDependencies = {
    now: Date.now,
    setTimer: (callback, delay) => setTimeout(callback, delay),
    clearTimer: (timer) => clearTimeout(timer),
    listActivities: () => activitiesRepository.list(),
    findParticipants: (id) => usersAtActivitiesRepository.findManyByActivityId(id),
    sendNotification: (data) => notificationService.sendPushNotification(data),
    // Deliberately omit participant IDs, payloads, and raw provider/database errors.
    report: (code) => console.error(`[Scheduler] ${code}`),
    ...overrides,
  };
  type Job = { timer?: Timer; fired: boolean; finished: boolean; timerVersion: number };
  const scheduledJobs = new Map<string, Job[]>();

  function cancelNotificationsForActivity(activityId: string) {
    const jobs = scheduledJobs.get(activityId);
    scheduledJobs.delete(activityId);
    jobs?.forEach((job) => {
      if (job.timer) dependencies.clearTimer(job.timer);
    });
  }

  function scheduleNotificationsForActivity(activity: SchedulableActivity) {
    if (!("id" in activity) || !activity.id) {
      dependencies.report("activity-without-id-skipped");
      return;
    }
    const activityId = activity.id;
    cancelNotificationsForActivity(activityId);
    // An undated activity is valid, including an update that removes an old date.
    if (!activity.data) return;
    const activityTime = new Date(activity.data).getTime();
    if (!Number.isFinite(activityTime)) {
      dependencies.report("invalid-activity-date-skipped");
      return;
    }

    const jobs: Job[] = [];
    scheduledJobs.set(activityId, jobs);
    const isCurrent = () => scheduledJobs.get(activityId) === jobs;
    try {
      for (const hours of [24, 2]) {
        const deadline = activityTime - hours * HOUR;
        if (deadline <= dependencies.now()) continue;
        const job: Job = { fired: false, finished: false, timerVersion: 0 };
        jobs.push(job);
        const run = async () => {
          if (!isCurrent() || job.fired) return;
          job.fired = true;
          try {
            // Avoid obsolete reminders if the process was suspended past the start.
            if (dependencies.now() >= activityTime) return;
            const participants = await dependencies.findParticipants(activityId);
            // An update/delete may finish while the participant lookup is in flight.
            if (!isCurrent() || dependencies.now() >= activityTime) return;
            const recipientIds = [...new Set(participants.map((user) => user.userId))];
            if (recipientIds.length === 0) return;
            await dependencies.sendNotification({
              title: hours === 24 ? "Lembrete de Atividade" : "Atividade Começando em Breve",
              message: `A atividade "${activity.nome}" começará em ${hours} horas!`,
              recipientIds,
              data: { activityId },
            });
          } catch {
            dependencies.report("notification-failed");
          } finally {
            job.finished = true;
            if (isCurrent() && jobs.every((entry) => entry.finished)) scheduledJobs.delete(activityId);
          }
        };
        const arm = () => {
          if (!isCurrent() || job.fired) return;
          const remaining = deadline - dependencies.now();
          if (remaining <= 0) {
            void run();
            return;
          }
          try {
            const timerVersion = ++job.timerVersion;
            job.timer = dependencies.setTimer(() => {
              if (job.timerVersion === timerVersion) arm();
            }, Math.min(remaining, MAX_TIMER_DELAY));
            job.timer.unref?.();
          } catch {
            cancelNotificationsForActivity(activityId);
            dependencies.report("activity-scheduling-failed");
          }
        };
        arm();
      }
      if (jobs.length === 0) scheduledJobs.delete(activityId);
    } catch {
      cancelNotificationsForActivity(activityId);
      dependencies.report("activity-scheduling-failed");
    }
  }

  async function scheduleAllActivityNotifications() {
    try {
      const activities = await dependencies.listActivities();
      for (const activity of activities) {
        try {
          scheduleNotificationsForActivity(activity);
        } catch {
          dependencies.report("activity-scheduling-failed");
        }
      }
    } catch {
      dependencies.report("initial-scheduling-failed");
    }
  }

  return { scheduleAllActivityNotifications, scheduleNotificationsForActivity, cancelNotificationsForActivity };
}

export default createScheduler();
