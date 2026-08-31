-- Crie o banco de dados (caso já não tenha sido criado pelo cPanel da HostGator) --
CREATE DATABASE IF NOT EXISTS `agente_sac` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `agente_sac`;

-- Tabela para registrar cada acesso/interação ao bot
CREATE TABLE IF NOT EXISTS `bot_accesses` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `phone_number` VARCHAR(50) DEFAULT NULL,
    `accessed_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Tabela para registrar as avaliações (1 a 5 estrelas)
CREATE TABLE IF NOT EXISTS `bot_ratings` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `phone_number` VARCHAR(50) DEFAULT NULL,
    `rating` TINYINT NOT NULL, -- Valores de 1 a 5
    `comment` TEXT DEFAULT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;