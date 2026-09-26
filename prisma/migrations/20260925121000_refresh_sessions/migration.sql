CREATE TABLE `refreshSessions` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `tokenHash` CHAR(64) NOT NULL,
  `expiresAt` DATETIME(6) NOT NULL,
  `revokedAt` DATETIME(6) NULL,
  `replacedById` VARCHAR(191) NULL,
  `createdAt` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

  UNIQUE INDEX `refreshSessions_tokenHash_key` (`tokenHash`),
  INDEX `refreshSessions_userId_idx` (`userId`),
  INDEX `refreshSessions_expiresAt_idx` (`expiresAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `refreshSessions`
ADD CONSTRAINT `refreshSessions_userId_fkey`
FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
