-- Preserve the most meaningful row before enforcing one enrollment per user/activity.
-- Priority: present, confirmed seat, oldest creation, deterministic id.
DELETE duplicate
FROM `userAtActivity` AS duplicate
INNER JOIN `userAtActivity` AS keeper
  ON keeper.`userId` = duplicate.`userId`
 AND keeper.`activityId` = duplicate.`activityId`
 AND (
      keeper.`presente` > duplicate.`presente`
   OR (keeper.`presente` = duplicate.`presente` AND keeper.`listaEspera` < duplicate.`listaEspera`)
   OR (keeper.`presente` = duplicate.`presente` AND keeper.`listaEspera` = duplicate.`listaEspera` AND keeper.`createdAt` < duplicate.`createdAt`)
   OR (keeper.`presente` = duplicate.`presente` AND keeper.`listaEspera` = duplicate.`listaEspera` AND keeper.`createdAt` = duplicate.`createdAt` AND keeper.`id` < duplicate.`id`)
 );

CREATE UNIQUE INDEX `userAtActivity_userId_activityId_key`
ON `userAtActivity`(`userId`, `activityId`);
