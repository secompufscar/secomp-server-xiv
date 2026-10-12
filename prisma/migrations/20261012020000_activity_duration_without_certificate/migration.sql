-- A duração descreve a atividade, mesmo quando ela não compõe o certificado.
-- Preserva dados existentes e a restrição de duração/fonte oficial válidas.
ALTER TABLE `atividades` DROP CHECK `atividades_certificate_exclusion_check`;
