<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css" />

# AI Canvas Drawing App

## <i class="fa-solid fa-clipboard-list"></i> 프로젝트 개요

> **Docker Compose + MariaDB + JWT 인증 + AI(Ollama LLaVA) 기반 캔버스 드로잉 툴**

이 프로젝트는 아래 요구사항을 충족하는 풀스택 드로잉 애플리케이션입니다:

- **Docker Compose**로 MariaDB, Node.js 앱, Ollama AI 서비스 구성
- **MariaDB 회원 테이블** 생성 및 JWT 기반 인증
- 테스트 계정: `test1@test.com / 123456`, `test2@test.com / 123456`
- 로그인 후 **좌측 Offcanvas 패널**에서 본인의 저장 작업 목록을 날짜별로 확인
- 저장 날짜 클릭 시 해당 시점의 캔버스 내용을 복원
- 캔버스 **<i class="fa-solid fa-floppy-disk"></i> 저장** 버튼으로 서버(MariaDB)에 저장
- **Tailwind CSS** 기반 전체 UI 디자인
- **<i class="fa-solid fa-robot"></i> AI Help** 버튼 클릭 시 Ollama LLaVA 모델이 스케치를 분석하여 자연스러운 이미지로 표현한 상세 묘사 제공
- Docker Compose로 Ollama 서비스 연동

---

## <i class="fa-solid fa-rocket"></i> 빠른 시작 (Docker Compose)

```bash
# 1. 서비스 시작
docker compose up -d --build

# 2. (최초 1회) LLaVA 모델 다운로드 (~4.7 GB)
docker compose exec ollama ollama pull llava

# 3. 브라우저에서 접속
open http://localhost:3000
```

> **Ollama 없이도** 캔버스 드로잉/저장/불러오기는 정상 동작합니다.  
> AI Help 기능만 Ollama + LLaVA 모델이 필요합니다.

---

## <i class="fa-solid fa-lock"></i> 인증 / 테스트 계정

| 이메일 | 비밀번호 |
|--------|----------|
| test1@test.com | 123456 |
| test2@test.com | 123456 |

- 서버 최초 기동 시 MariaDB에 자동 생성(bcrypt 해싱)
- JWT 토큰 유효기간: **24시간**
- 토큰은 브라우저 `localStorage`에 저장

---

## <i class="fa-solid fa-trowel-bricks"></i> 아키텍처

```
Browser (Vite + Vanilla JS + Tailwind CSS)
    │  JWT Bearer Token
    ▼
Node.js HTTP Server (server.js)
    ├── POST /api/auth/login        — 로그인, JWT 발급
    ├── GET  /api/auth/me           — 현재 사용자 확인
    ├── GET  /api/saves             — 저장 목록 조회
    ├── POST /api/saves             — 캔버스 저장
    ├── GET  /api/saves/:id         — 특정 저장본 로드
    ├── DELETE /api/saves/:id       — 삭제
    └── POST /api/ai/enhance        — Ollama LLaVA 프록시
          │
          ├── MariaDB 11 (users, canvas_saves)
          └── Ollama (llava vision model)
```

---

## <i class="fa-solid fa-palette"></i> 주요 기능

### 드로잉 도구
- **펜** / **지우개** / **직선** / **사각형** / **원**
- 색상 선택, 브러시 굵기 조절
- 모눈 종이 배경 토글
- PNG / JPG 로컬 다운로드

### 저장 / 불러오기 (MariaDB)
1. 그림을 그린 후 **<i class="fa-solid fa-floppy-disk"></i> 저장** 클릭
2. 좌측 **<i class="fa-solid fa-bars"></i> 메뉴** → 날짜별 저장 목록 확인
3. 저장 항목 클릭 → 해당 캔버스 복원
4. <i class="fa-solid fa-xmark"></i> 버튼으로 특정 저장본 삭제

### AI Help (Ollama LLaVA)
1. 스케치를 그린 후 **<i class="fa-solid fa-robot"></i> AI Help** 클릭
2. 캔버스 이미지를 Ollama LLaVA 모델로 전송
3. AI가 스케치를 분석하여 **자연스러운 이미지 묘사** 반환
4. 원본 스케치 + AI 묘사를 모달에서 확인

---

## <i class="fa-brands fa-docker"></i> Docker Compose 서비스 구성

| 서비스 | 이미지 | 포트 | 설명 |
|--------|--------|------|------|
| `app` | 커스텀 빌드 | 3000 | Node.js 앱 서버 |
| `db` | mariadb:11 | (내부) | MariaDB 데이터베이스 |
| `ollama` | ollama/ollama:latest | 11434 | AI 모델 서버 |

### 환경 변수 (app 서비스)

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `DB_HOST` | db | MariaDB 호스트 |
| `DB_PORT` | 3306 | MariaDB 포트 |
| `DB_USER` | canvasuser | DB 사용자 |
| `DB_PASSWORD` | canvaspass | DB 비밀번호 |
| `DB_NAME` | canvasdb | 데이터베이스 명 |
| `JWT_SECRET` | (기본값 변경 필수) | JWT 서명 키 |
| `OLLAMA_URL` | http://ollama:11434 | Ollama API URL |

---

## <i class="fa-solid fa-boxes-stacked"></i> 데이터베이스 스키마

```sql
-- 회원 테이블
CREATE TABLE users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 캔버스 저장 테이블
CREATE TABLE canvas_saves (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT      NOT NULL,
  canvas_data LONGTEXT NOT NULL,        -- base64 PNG data URL
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

---

## <i class="fa-solid fa-screwdriver-wrench"></i> 로컬 개발

```bash
# 의존성 설치
npm install

# 프론트엔드 dev 서버 (포트 5173)
npm run dev

# 백엔드 서버 (포트 3000)
# MariaDB가 localhost:3306에서 실행 중이어야 합니다
DB_HOST=localhost npm run dev:server
```

---

## <i class="fa-solid fa-box"></i> 기술 스택

### Frontend
- **Vite** (빌드 도구)
- **Vanilla JavaScript** (ES Modules)
- **Tailwind CSS** (UI 디자인)
- **Canvas API** (드로잉)

### Backend
- **Node.js 20** (HTTP 서버)
- **mysql2** (MariaDB 드라이버)
- **jsonwebtoken** (JWT 인증)
- **bcryptjs** (비밀번호 해싱)

### AI
- **Ollama** (로컬 AI 모델 서버)
- **LLaVA** (Large Language and Vision Assistant — 스케치 이미지 분석)

### Infrastructure
- **Docker** (멀티스테이지 빌드)
- **Docker Compose** (서비스 오케스트레이션)
- **MariaDB 11** (데이터 영속성)
- **GitHub Actions** (CI/CD)

---

## <i class="fa-solid fa-plug"></i> API 요약

| Method | Path | Auth | 설명 |
|--------|------|------|------|
| GET | /api/health | <i class="fa-solid fa-xmark"></i> | 서버 상태 |
| POST | /api/auth/login | <i class="fa-solid fa-xmark"></i> | 로그인 |
| GET | /api/auth/me | <i class="fa-solid fa-check"></i> | 현재 사용자 |
| GET | /api/saves | <i class="fa-solid fa-check"></i> | 저장 목록 |
| POST | /api/saves | <i class="fa-solid fa-check"></i> | 캔버스 저장 |
| GET | /api/saves/:id | <i class="fa-solid fa-check"></i> | 저장본 조회 |
| DELETE | /api/saves/:id | <i class="fa-solid fa-check"></i> | 저장본 삭제 |
| POST | /api/ai/enhance | <i class="fa-solid fa-check"></i> | AI 스케치 분석 |

---

## <i class="fa-solid fa-triangle-exclamation"></i>️ 프로덕션 배포 시 주의사항

1. `docker-compose.yml`의 `JWT_SECRET`을 **암호학적으로 안전한 랜덤 문자열(최소 32자)**로 교체하세요.  
   생성 명령: `openssl rand -hex 32`
2. MariaDB 비밀번호도 강력한 값으로 변경하세요
3. HTTPS를 적용하는 리버스 프록시(nginx, Caddy 등) 사용을 권장합니다

---

![alt text](image-3.png)

---

## <i class="fa-solid fa-clapperboard"></i> Playwright 자동화 데모 (원 2개 그리기 + AI 분석)

아래 스크린샷은 **Playwright** 브라우저 자동화로 캡처한 실제 실행 화면입니다.

### 1️⃣ 로그인 후 캔버스에 원 2개 그리기

`test1@test.com` 계정으로 로그인한 뒤, **⭕ 원** 도구를 선택하여 파란색 원과 빨간색 원을 각각 그린 결과입니다.

![캔버스 - 원 2개](screenshots/canvas-two-circles.png)
 

### 2️⃣ <i class="fa-solid fa-robot"></i> AI Help — LLaVA 스케치 분석 결과

**AI Help** 버튼을 클릭하면 Ollama LLaVA 모델이 캔버스 스케치를 분석하여 한국어로 이미지 묘사를 반환합니다.

![AI 분석 결과](screenshots/ai-help-result.png)

> **AI 묘사 요약 (LLaVA 창의적 해석):**  
> 이 스케치는 두 개의 완벽한 원으로 구성되어 있습니다. 파란색 원은 부드러운 파스텔 블루 톤의 비눗방울처럼 보이며, 빨간색 원은 따뜻한 빛으로 물든 일몰의 태양을 연상시킵니다. 두 원은 서로 대비를 이루면서도 조화롭게 공존하며, 전체적으로 평온하고 균형 잡힌 구도를 형성하고 있습니다.
