ALTER TABLE `certificates`
  ADD COLUMN `revision` INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN `activeSlot` INTEGER NULL DEFAULT 1,
  ADD COLUMN `revokedAt` DATETIME(6) NULL,
  ADD COLUMN `revokedBy` VARCHAR(191) NULL,
  ADD COLUMN `revocationReason` VARCHAR(500) NULL,
  ADD COLUMN `replacesId` VARCHAR(191) NULL,
  ADD COLUMN `reissuedBy` VARCHAR(191) NULL,
  ADD COLUMN `reissueReason` VARCHAR(500) NULL,
  ADD UNIQUE INDEX `certificates_userId_eventId_revision_key` (`userId`, `eventId`, `revision`),
  ADD UNIQUE INDEX `certificates_userId_eventId_activeSlot_key` (`userId`, `eventId`, `activeSlot`),
  ADD UNIQUE INDEX `certificates_replacesId_key` (`replacesId`),
  ADD CONSTRAINT `certificates_replacesId_fkey` FOREIGN KEY (`replacesId`) REFERENCES `certificates` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT `certificates_revision_check` CHECK (`revision` >= 1),
  ADD CONSTRAINT `certificates_revocation_check` CHECK (
    (`activeSlot` IS NOT NULL AND `activeSlot` = 1 AND `revokedAt` IS NULL AND `revokedBy` IS NULL AND `revocationReason` IS NULL) OR
    (`activeSlot` IS NULL AND `revokedAt` IS NOT NULL AND `revokedBy` IS NOT NULL AND CHAR_LENGTH(TRIM(`revokedBy`)) > 0
      AND `revocationReason` IS NOT NULL AND CHAR_LENGTH(TRIM(`revocationReason`)) > 0)
  ),
  ADD CONSTRAINT `certificates_reissue_check` CHECK (
    (`revision` = 1 AND `replacesId` IS NULL AND `reissuedBy` IS NULL AND `reissueReason` IS NULL) OR
    (`revision` > 1 AND `replacesId` IS NOT NULL AND `reissuedBy` IS NOT NULL AND CHAR_LENGTH(TRIM(`reissuedBy`)) > 0
      AND `reissueReason` IS NOT NULL AND CHAR_LENGTH(TRIM(`reissueReason`)) > 0)
  );

-- New unique indexes retain the user FK's prefix before removing the original index.
ALTER TABLE `certificates` DROP INDEX `certificates_userId_eventId_key`;
