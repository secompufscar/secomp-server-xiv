ALTER TABLE `atividades`
  ADD COLUMN `certificateExcluded` BOOLEAN NOT NULL DEFAULT false,
  ADD CONSTRAINT `atividades_certificate_exclusion_check` CHECK (
    `certificateExcluded` = false OR (`durationMinutes` IS NULL AND `durationSource` IS NULL)
  );
