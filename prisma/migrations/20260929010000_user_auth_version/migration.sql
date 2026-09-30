-- Additive only: existing users and their tokens remain at version zero.
ALTER TABLE `users` ADD COLUMN `authVersion` INTEGER NOT NULL DEFAULT 0;
ALTER TABLE `refreshSessions` ADD COLUMN `authVersion` INTEGER NOT NULL DEFAULT 0;
