ALTER TABLE `atividades`
  ADD COLUMN `durationMinutes` INTEGER NULL,
  ADD COLUMN `durationSource` VARCHAR(500) NULL,
  ADD CONSTRAINT `atividades_duration_check` CHECK (
    (`durationMinutes` IS NULL AND `durationSource` IS NULL) OR
    (`durationMinutes` IS NOT NULL AND `durationMinutes` BETWEEN 1 AND 10080
      AND `durationSource` IS NOT NULL AND CHAR_LENGTH(TRIM(`durationSource`)) > 0)
  );

CREATE TABLE `certificates` (
  `id` VARCHAR(191) NOT NULL,
  `code` CHAR(32) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `eventId` VARCHAR(191) NOT NULL,
  `participantName` VARCHAR(255) NOT NULL,
  `totalMinutes` INTEGER NOT NULL,
  `snapshot` JSON NOT NULL,
  `validationUrl` VARCHAR(2048) NOT NULL,
  `issuedAt` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `certificates_code_key` (`code`),
  UNIQUE INDEX `certificates_userId_eventId_key` (`userId`, `eventId`),
  INDEX `certificates_eventId_idx` (`eventId`),
  CONSTRAINT `certificates_total_check` CHECK (`totalMinutes` > 0),
  CONSTRAINT `certificates_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `certificates_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `events` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
