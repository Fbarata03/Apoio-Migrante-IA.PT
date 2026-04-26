-- ============================================================
-- Apoio Migrante IA PT -- Schema MySQL
-- Execute: mysql -u root -p < database/schema.sql
-- ============================================================

CREATE DATABASE IF NOT EXISTS apoio_migrante
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE apoio_migrante;

-- ------------------------------------------------------------
-- Utilizadores
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(255)  NOT NULL,
  email         VARCHAR(255)  UNIQUE NOT NULL,
  password_hash VARCHAR(255)  NOT NULL,
  phone         VARCHAR(50),
  nationality   VARCHAR(100)  DEFAULT 'Não especificada',
  created_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------
-- Processos de imigração
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS processes (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  user_id             INT          NOT NULL,
  process_number      VARCHAR(50)  UNIQUE NOT NULL,
  type                VARCHAR(100) DEFAULT 'Autorização de Residência',
  status              ENUM('pending','in_progress','approved','rejected') DEFAULT 'in_progress',
  current_step        INT          DEFAULT 1,
  start_date          DATE         NOT NULL,
  estimated_end_date  DATE,
  created_at          TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ------------------------------------------------------------
-- Passos da linha temporal
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS process_steps (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  process_id     INT          NOT NULL,
  step_number    INT          NOT NULL,
  name           VARCHAR(100) NOT NULL,
  status         ENUM('pending','in_progress','completed') DEFAULT 'pending',
  completed_date TIMESTAMP    NULL,
  estimated_days INT          DEFAULT 5,
  detail         VARCHAR(255),
  FOREIGN KEY (process_id) REFERENCES processes(id) ON DELETE CASCADE,
  UNIQUE KEY uq_step (process_id, step_number)
);

-- ------------------------------------------------------------
-- Documentos
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS documents (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  process_id       INT          NOT NULL,
  user_id          INT          NOT NULL,
  document_type    VARCHAR(100) DEFAULT 'Outros',
  original_name    VARCHAR(255) NOT NULL,
  stored_filename  VARCHAR(255) NOT NULL,
  file_path        VARCHAR(500) NOT NULL,
  mime_type        VARCHAR(100),
  size_bytes       BIGINT       DEFAULT 0,
  status           ENUM('pending','processing','approved','rejected') DEFAULT 'pending',
  error_message    TEXT,
  uploaded_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  validated_at     TIMESTAMP    NULL,
  FOREIGN KEY (process_id) REFERENCES processes(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id)    REFERENCES users(id)     ON DELETE CASCADE
);

-- ------------------------------------------------------------
-- Notificações
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT          NOT NULL,
  type       ENUM('payment','document','ai','official','general') DEFAULT 'general',
  title      VARCHAR(255) NOT NULL,
  message    TEXT         NOT NULL,
  is_read    BOOLEAN      DEFAULT FALSE,
  priority   ENUM('low','medium','high') DEFAULT 'medium',
  created_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ------------------------------------------------------------
-- Pagamentos
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payments (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  process_id  INT            NOT NULL,
  user_id     INT            NOT NULL,
  description VARCHAR(255)   DEFAULT 'Taxa administrativa única',
  amount      DECIMAL(10,2)  NOT NULL DEFAULT 5.00,
  currency    VARCHAR(3)     DEFAULT 'EUR',
  status      ENUM('pending','paid','failed') DEFAULT 'pending',
  method      VARCHAR(50),
  due_date    DATE,
  paid_at     TIMESTAMP      NULL,
  created_at  TIMESTAMP      DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (process_id) REFERENCES processes(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id)    REFERENCES users(id)     ON DELETE CASCADE
);
