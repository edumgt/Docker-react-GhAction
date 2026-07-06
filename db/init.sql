-- Canvas AI Drawing App — Database Initialisation
-- Run automatically by MariaDB on first container start

CREATE TABLE IF NOT EXISTS users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at    TIMESTAMP   DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS canvas_saves (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT          NOT NULL,
  canvas_data LONGTEXT     NOT NULL,
  created_at  TIMESTAMP   DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_created (user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 주식 차트 분석 이력 테이블
CREATE TABLE IF NOT EXISTS stock_analyses (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  user_id             INT       NOT NULL,
  image_data          LONGTEXT  NOT NULL,   -- base64 차트 이미지 data URL
  trend               TEXT,                 -- 추세
  support_resistance  TEXT,                 -- 지지선/저항선
  pattern             TEXT,                 -- 캔들/차트 패턴
  indicators          TEXT,                 -- 이동평균선/거래량
  summary             TEXT,                 -- 종합 의견
  disclaimer          TEXT,                 -- 유의사항
  created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_created (user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Test users are seeded by the Node.js server on first start
-- because bcrypt hashes must be generated at runtime.
-- (stock_analyses is also created at server startup for existing DB volumes.)
