ALTER TABLE `userAtActivity` ADD COLUMN `checkedInAt` DATETIME(6) NULL;

-- TIMESTAMP is session-dependent; DATETIME contains the application's UTC value.
SET @attendance_previous_timezone = @@SESSION.time_zone;
SET SESSION time_zone = '+00:00';

-- Only recover untouched direct check-ins. Previously enrolled participants
-- may have been marked present later; their enrollment date is not attendance.
-- The two clocks can differ by milliseconds during the same insert.
UPDATE `userAtActivity`
SET `checkedInAt` = `createdAt`, `updatedAt` = `updatedAt`
WHERE `presente` = TRUE AND `inscricaoPrevia` = FALSE
  AND ABS(TIMESTAMPDIFF(MICROSECOND, `createdAt`, `updatedAt`)) <= 1000000;

SET SESSION time_zone = @attendance_previous_timezone;
