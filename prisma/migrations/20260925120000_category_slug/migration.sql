ALTER TABLE `category`
ADD COLUMN `slug` VARCHAR(80) NULL;

UPDATE `category`
SET `slug` = CASE
  WHEN LOWER(`nome`) LIKE 'minicurso%' THEN CONCAT('minicurso-', LEFT(REPLACE(`id`, '-', ''), 8))
  WHEN LOWER(`nome`) LIKE 'palestra%' THEN CONCAT('palestra-', LEFT(REPLACE(`id`, '-', ''), 8))
  WHEN LOWER(`nome`) LIKE 'competi%' THEN CONCAT('competicao-', LEFT(REPLACE(`id`, '-', ''), 8))
  WHEN LOWER(REPLACE(`nome`, ' ', '')) LIKE 'gamenight%' THEN CONCAT('gamenight-', LEFT(REPLACE(`id`, '-', ''), 8))
  WHEN LOWER(`nome`) LIKE 'sociocultural%' THEN CONCAT('sociocultural-', LEFT(REPLACE(`id`, '-', ''), 8))
  WHEN LOWER(`nome`) LIKE 'credenciamento%' THEN CONCAT('credenciamento-', LEFT(REPLACE(`id`, '-', ''), 8))
  WHEN LOWER(`nome`) LIKE 'coffee%' OR LOWER(`nome`) LIKE 'caf%' THEN CONCAT('coffee-', LEFT(REPLACE(`id`, '-', ''), 8))
  ELSE CONCAT('categoria-', LEFT(REPLACE(`id`, '-', ''), 12))
END;

UPDATE `category` SET `slug` = 'minicurso' WHERE `id` = (SELECT `id` FROM (SELECT `id` FROM `category` WHERE LOWER(`nome`) LIKE 'minicurso%' ORDER BY `createdAt`, `id` LIMIT 1) AS first_match);
UPDATE `category` SET `slug` = 'palestra' WHERE `id` = (SELECT `id` FROM (SELECT `id` FROM `category` WHERE LOWER(`nome`) LIKE 'palestra%' ORDER BY `createdAt`, `id` LIMIT 1) AS first_match);
UPDATE `category` SET `slug` = 'competicao' WHERE `id` = (SELECT `id` FROM (SELECT `id` FROM `category` WHERE LOWER(`nome`) LIKE 'competi%' ORDER BY `createdAt`, `id` LIMIT 1) AS first_match);
UPDATE `category` SET `slug` = 'gamenight' WHERE `id` = (SELECT `id` FROM (SELECT `id` FROM `category` WHERE LOWER(REPLACE(`nome`, ' ', '')) LIKE 'gamenight%' ORDER BY `createdAt`, `id` LIMIT 1) AS first_match);
UPDATE `category` SET `slug` = 'sociocultural' WHERE `id` = (SELECT `id` FROM (SELECT `id` FROM `category` WHERE LOWER(`nome`) LIKE 'sociocultural%' ORDER BY `createdAt`, `id` LIMIT 1) AS first_match);
UPDATE `category` SET `slug` = 'credenciamento' WHERE `id` = (SELECT `id` FROM (SELECT `id` FROM `category` WHERE LOWER(`nome`) LIKE 'credenciamento%' ORDER BY `createdAt`, `id` LIMIT 1) AS first_match);
UPDATE `category` SET `slug` = 'coffee' WHERE `id` = (SELECT `id` FROM (SELECT `id` FROM `category` WHERE LOWER(`nome`) LIKE 'coffee%' OR LOWER(`nome`) LIKE 'caf%' ORDER BY `createdAt`, `id` LIMIT 1) AS first_match);

ALTER TABLE `category`
MODIFY `slug` VARCHAR(80) NOT NULL,
ADD CONSTRAINT `category_slug_key` UNIQUE (`slug`);
