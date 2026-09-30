-- Refuse duplicate current editions; never pick or change one automatically.
-- This database-only generated column is intentionally absent from Prisma/HTTP.
ALTER TABLE `events`
  ADD COLUMN `currentEditionKey` TINYINT GENERATED ALWAYS AS (CASE WHEN `isCurrent` THEN 1 ELSE NULL END) STORED,
  ADD UNIQUE INDEX `events_single_current` (`currentEditionKey`),
  ADD COLUMN `registrationsClosed` BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE `editionStateLock` (
  `id` INTEGER NOT NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
INSERT INTO `editionStateLock` (`id`) VALUES (1);
