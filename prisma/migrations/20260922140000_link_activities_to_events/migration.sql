ALTER TABLE `atividades`
ADD COLUMN `eventId` VARCHAR(191) NULL;

-- Prefer the event whose date range contains the activity date.
UPDATE `atividades` AS activity
SET activity.`eventId` = (
  SELECT event.`id`
  FROM `events` AS event
  WHERE activity.`data` BETWEEN event.`startDate` AND event.`endDate`
  ORDER BY event.`startDate` DESC, event.`id` ASC
  LIMIT 1
)
WHERE activity.`eventId` IS NULL
  AND activity.`data` IS NOT NULL;

-- Associate remaining legacy activities with the most recent current event.
UPDATE `atividades`
SET `eventId` = (
  SELECT currentEvent.`id`
  FROM `events` AS currentEvent
  WHERE currentEvent.`isCurrent` = true
  ORDER BY currentEvent.`startDate` DESC, currentEvent.`id` ASC
  LIMIT 1
)
WHERE `eventId` IS NULL;

CREATE INDEX `atividades_eventId_idx` ON `atividades`(`eventId`);

ALTER TABLE `atividades`
ADD CONSTRAINT `atividades_eventId_fkey`
FOREIGN KEY (`eventId`) REFERENCES `events`(`id`)
ON DELETE RESTRICT ON UPDATE CASCADE;
