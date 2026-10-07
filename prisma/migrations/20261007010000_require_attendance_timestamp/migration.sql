-- New attendance must have a timestamp even when a writer omits the field.
-- UTC is explicit because DATETIME does not carry a timezone.
CREATE TRIGGER `userAtActivity_checkedInAt_insert`
BEFORE INSERT ON `userAtActivity`
FOR EACH ROW
SET NEW.`checkedInAt` = IF(
  NEW.`presente`,
  COALESCE(NEW.`checkedInAt`, UTC_TIMESTAMP(6)),
  NULL
);

-- Preserve unknown legacy times while presence stays confirmed. A new
-- absence-to-presence transition always receives a timestamp. Clearing a
-- known timestamp without reversing presence preserves the original time.
CREATE TRIGGER `userAtActivity_checkedInAt_update`
BEFORE UPDATE ON `userAtActivity`
FOR EACH ROW
SET NEW.`checkedInAt` = CASE
  WHEN NOT NEW.`presente` THEN NULL
  WHEN NOT OLD.`presente` THEN COALESCE(NEW.`checkedInAt`, UTC_TIMESTAMP(6))
  ELSE COALESCE(NEW.`checkedInAt`, OLD.`checkedInAt`)
END;
