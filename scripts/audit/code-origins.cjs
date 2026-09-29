const fs = require('node:fs');
const cp = require('node:child_process');
const targets = [
  ['AUD-01', 'src/config/sendEmail.ts', 'email_secret: process.env'],
  ['AUD-02', 'src/services/usersService.ts', 'async updatePassword'],
  ['AUD-03', 'src/services/usersService.ts', 'const updatedUser = await usersRepository.update(userId'],
  ['AUD-04', 'src/schemas/userSchema.ts', 'const password ='],
  ['AUD-05', 'src/services/checkInService.ts', 'async checkIn'],
  ['AUD-06', 'src/services/usersAtActivitiesService.ts', 'const currentEvent ='],
  ['AUD-07', 'src/services/activitiesService.ts', 'scheduleNotificationsForActivity(newAtividade'],
  ['AUD-07', 'src/services/schedulerService.ts', 'const adjustedDate'],
  ['AUD-08', 'src/controllers/activityImageController.ts', 'await cloudinary.uploader.destroy'],
  ['AUD-09', 'src/services/sponsorService.ts', 'const newSponsor ='],
  ['AUD-10', 'src/middlewares/errorHandler.ts', 'path: req.originalUrl'],
  ['AUD-11', 'src/middlewares/appVersionMiddleware.ts', 'const platform ='],
  ['AUD-12', 'src/repositories/eventRepository.ts', 'async createWithRegistrationReset'],
  ['AUD-13', 'src/controllers/adminController.ts', 'senha: hashSync'],
  ['AUD-14', 'src/repositories/usersRepository.ts', 'async getTop50RankingUsers'],
  ['AUD-15', 'src/services/notificationService.ts', 'async sendPushNotification'],
];
const origins = targets.map(([finding, file, marker]) => {
  const line = fs.readFileSync(file, 'utf8').split('\n').findIndex(text => text.includes(marker)) + 1;
  if (!line) throw new Error(file);
  const blame = cp.execFileSync('git', ['blame', '--porcelain', '-L', `${line},${line}`, '--', file], { encoding: 'utf8' });
  const history = cp.execFileSync('git', ['log', '--reverse', '--format=%h %s', '-S', marker, '--', file], { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
  return { finding, file, line, lastTouchCommit: blame.split(' ')[0], summary: blame.split('\n').find(text => text.startsWith('summary '))?.slice(8), history };
});
fs.writeFileSync('docs/audit-code-origins-2026-09-28.json', JSON.stringify(origins, null, 2) + '\n');
console.log(JSON.stringify(origins, null, 2));
