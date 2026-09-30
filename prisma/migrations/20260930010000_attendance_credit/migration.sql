-- No historic balances are recalculated; null denotes an unknown original grant.
ALTER TABLE `userAtActivity` ADD COLUMN `creditedPoints` INTEGER NULL;
