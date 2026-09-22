ALTER TABLE `category`
ADD COLUMN `requiresEnrollment` BOOLEAN NOT NULL DEFAULT false;

-- Preserve the rule documented by the XII edition app: minicourses require enrollment.
UPDATE `category`
SET `requiresEnrollment` = true
WHERE LOWER(TRIM(`nome`)) IN ('minicurso', 'minicursos');
