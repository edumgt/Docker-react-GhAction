<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css" />

# AI Canvas & Stock Insight

## <i class="fa-solid fa-clipboard-list"></i> 프로젝트 개요

> **FastAPI + MariaDB + JWT 인증 + Ollama LLaVA 기반 캔버스/주식 분석 웹앱**

로그인한 사용자가 캔버스에 그림을 그려 저장하고, Ollama LLaVA 비전 모델의 도움을 받아
**스케치 묘사**, **주식 차트 기술적 분석**을 수행하며, **DART 공시 속보**를 실시간에 가깝게
확인할 수 있는 풀스택 웹 애플리케이션입니다.

- **Docker Compose**로 MariaDB + 앱(FastAPI) 서비스 구성 (Ollama는 호스트에서 별도 실행)
- **MariaDB 회원 테이블** + JWT 기반 인증 (bcrypt 해싱)
- 테스트 계정: `test1@test.com / 123456`, `test2@test.com / 123456`
- **<i class="fa-solid fa-pen"></i> 그리기** — 펜/도형 캔버스, PNG·JPG 내보내기, 서버 저장/불러오기(날짜별 이력)
- **<i class="fa-solid fa-robot"></i> AI Help** — 스케치를 LLaVA에 보내 자연스러운 이미지 묘사를 생성
- **<i class="fa-solid fa-chart-line"></i> 주식 차트 분석** — 차트 스크린샷을 업로드하면 추세 / 지지·저항선 /
  캔들 패턴 / 이동평균·거래량 / 종합 의견을 구조화된 리포트로 제공, 분석 이력 DB 저장
- **<i class="fa-solid fa-bullhorn"></i> 공시 속보** — DART(금융감독원 전자공시시스템) 공식 RSS를
  서버가 프록시하여 20초 간격으로 자동 갱신, 최신 공시를 실시간에 가깝게 표시

---

## <i class="fa-solid fa-rocket"></i> 빠른 시작 (Docker Compose)

```bash
# 1. 환경 변수 준비 (.env.example 참고)
cp .env.example .env

# 2. 서비스 시작 (MariaDB + FastAPI 앱)
docker compose up -d --build

# 3. Ollama 설치 및 LLaVA 모델 준비 (호스트에서 실행)
#    docker-compose.yml은 host.docker.internal:11434 로 접속합니다.
ollama pull llava:34b

# 4. 브라우저에서 접속
open http://localhost:3000
```

> **Ollama 없이도** 캔버스 드로잉/저장/불러오기, 공시 속보 조회는 정상 동작합니다.
> **AI Help**와 **주식 차트 분석** 기능만 Ollama + LLaVA 모델이 필요합니다.

---

## <i class="fa-solid fa-lock"></i> 인증 / 테스트 계정

| 이메일 | 비밀번호 |
|--------|----------|
| test1@test.com | 123456 |
| test2@test.com | 123456 |

- 서버 최초 기동 시 MariaDB에 자동 생성(bcrypt 해싱)
- JWT 토큰 유효기간: **24시간**
- 토큰은 브라우저 `localStorage`에 저장 후 `Authorization: Bearer` 헤더로 전송

---

## <i class="fa-solid fa-trowel-bricks"></i> 아키텍처

```
Browser (Vanilla JS + Tailwind CSS CDN + Font Awesome)
    │  JWT Bearer Token
    ▼
FastAPI 서버 (server.py, uvicorn)
    ├── POST   /api/auth/login          — 로그인, JWT 발급
    ├── GET    /api/auth/me             — 현재 사용자 확인
    ├── GET    /api/saves               — 캔버스 저장 목록 조회
    ├── POST   /api/saves               — 캔버스 저장
    ├── GET    /api/saves/:id           — 특정 저장본 로드
    ├── DELETE /api/saves/:id           — 저장본 삭제
    ├── POST   /api/ai/enhance          — Ollama LLaVA 프록시 (스케치 묘사)
    ├── POST   /api/stock/analyze       — Ollama LLaVA 프록시 (주식 차트 분석)
    ├── GET    /api/stock/analyses      — 차트 분석 이력 목록
    ├── GET    /api/stock/analyses/:id  — 차트 분석 이력 조회
    ├── DELETE /api/stock/analyses/:id  — 차트 분석 이력 삭제
    └── GET    /api/dart/disclosures    — DART 공시 RSS 프록시 (15초 서버 캐시)
          │
          ├── MariaDB 11 (users, canvas_saves, stock_analyses)
          ├── Ollama (llava vision model, 호스트에서 실행)
          └── DART RSS (dart.fss.or.kr/api/todayRSS.xml)
```

---

## <i class="fa-solid fa-palette"></i> 주요 기능

### 그리기 도구
- **펜** / **지우개** / **직선** / **사각형** / **원**, 색상 선택, 브러시 굵기 조절, 모눈 종이 배경 토글
- PNG / JPG 로컬 다운로드

### 저장 / 불러오기 (MariaDB)
1. 그림을 그린 후 **<i class="fa-solid fa-floppy-disk"></i> 저장** 클릭
2. 좌측 **<i class="fa-solid fa-bars"></i> 메뉴** → 날짜별 저장 목록 확인
3. 저장 항목 클릭 → 해당 캔버스 복원, <i class="fa-solid fa-xmark"></i> 로 삭제

### AI Help (Ollama LLaVA)
1. 스케치를 그린 후 **<i class="fa-solid fa-robot"></i> AI Help** 클릭
2. 캔버스 이미지를 Ollama LLaVA 모델로 전송
3. AI가 스케치를 분석하여 **자연스러운 이미지 묘사**를 모달에서 반환

### <i class="fa-solid fa-chart-line"></i> 주식 차트 분석 (Ollama LLaVA)
1. 상단 **주식 차트 분석** 탭에서 증권 앱/HTS 캡쳐 이미지를 업로드(클릭 또는 드래그 앤 드롭)
2. **분석 시작** 클릭 → LLaVA 34B 모델이 차트를 분석
3. 아래 항목으로 구조화된 리포트를 확인:
   - **추세** — 상승/하락/횡보 여부와 근거
   - **지지선/저항선** — 주요 가격대
   - **캔들/차트 패턴** — 관찰되는 패턴
   - **이동평균선/거래량** — 이평선 배열, 거래량 특이사항
   - **종합 의견** — 전체 요약
   - **유의사항** — 참고용이며 투자 조언이 아니라는 고정 안내문
4. 분석 결과는 `stock_analyses` 테이블에 저장되어 좌측 **분석 이력**에서 다시 조회/삭제 가능

> <i class="fa-solid fa-triangle-exclamation"></i> AI의 차트 판독은 참고용이며, 실제 투자 판단의 근거로 사용해서는 안 됩니다.

### <i class="fa-solid fa-bullhorn"></i> 공시 속보 (DART RSS)
1. 상단 **공시 속보** 탭으로 이동하면 자동으로 최신 공시 목록을 불러옴
2. 서버가 [DART 전자공시시스템](https://dart.fss.or.kr) 공식 RSS(`todayRSS.xml`)를 대신 조회하여 CORS 문제 없이 프록시
3. 응답은 서버에서 **15초간 캐시**되어 여러 사용자가 동시에 봐도 DART 서버에 과도한 요청이 가지 않음
4. 프론트엔드는 **20초 간격**으로 자동 새로고침(탭이 활성 상태일 때만 폴링)
5. 각 항목 클릭 시 해당 공시 원문(DART) 새 탭으로 이동

---

## <i class="fa-brands fa-docker"></i> Docker Compose 서비스 구성

| 서비스 | 이미지 | 포트 | 설명 |
|--------|--------|------|------|
| `app` | 커스텀 빌드 (Python 3.12 / FastAPI) | 3000 | 앱 서버 |
| `db` | mariadb:11 | (내부) | MariaDB 데이터베이스 |

> Ollama는 컨테이너로 포함되어 있지 않으며, 호스트에 설치된 Ollama(`http://host.docker.internal:11434`)를 사용합니다.

### 환경 변수 (app 서비스)

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `PORT` | 3000 | 앱 리슨 포트 |
| `DB_HOST` | db | MariaDB 호스트 |
| `DB_PORT` | 3306 | MariaDB 포트 |
| `DB_USER` | canvasuser | DB 사용자 |
| `DB_PASSWORD` | canvaspass | DB 비밀번호 |
| `DB_NAME` | canvasdb | 데이터베이스 명 |
| `JWT_SECRET` | (기본값 변경 필수) | JWT 서명 키 |
| `OLLAMA_URL` | http://host.docker.internal:11434 | Ollama API URL |

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

-- 주식 차트 분석 이력 테이블
CREATE TABLE stock_analyses (
  id                 INT AUTO_INCREMENT PRIMARY KEY,
  user_id            INT      NOT NULL,
  image_data         LONGTEXT NOT NULL,  -- base64 차트 이미지 data URL
  trend              TEXT,               -- 추세
  support_resistance TEXT,               -- 지지선/저항선
  pattern            TEXT,               -- 캔들/차트 패턴
  indicators         TEXT,               -- 이동평균선/거래량
  summary            TEXT,               -- 종합 의견
  disclaimer         TEXT,               -- 유의사항
  created_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

`stock_analyses`는 `server.py` 시작 시 `CREATE TABLE IF NOT EXISTS`로도 생성되므로,
이미 실행 중인 DB 볼륨이 있어도 별도 마이그레이션 없이 자동 반영됩니다.

---

## <i class="fa-solid fa-screwdriver-wrench"></i> 로컬 개발 (Docker 없이)

```bash
# 의존성 설치
pip install -r requirements.txt

# MariaDB가 localhost:3306에서 실행 중이어야 합니다
DB_HOST=localhost uvicorn server:app --reload --port 3000
```

---

## <i class="fa-solid fa-box"></i> 기술 스택

### Frontend
- **Vanilla JavaScript** (단일 `static/index.html`)
- **Tailwind CSS** (CDN) + **Font Awesome** (CDN)
- **Canvas API** (드로잉)

### Backend
- **Python 3.12 / FastAPI** (`server.py`, uvicorn)
- **aiomysql** (MariaDB 비동기 드라이버)
- **PyJWT** (JWT 인증), **bcrypt** (비밀번호 해싱)
- **httpx** (Ollama / DART RSS 비동기 HTTP 클라이언트)

### AI
- **Ollama** (로컬 AI 모델 서버, 호스트에서 실행)
- **LLaVA 34B** (Large Language and Vision Assistant — 스케치 묘사, 주식 차트 분석)

### 외부 데이터
- **DART**(금융감독원 전자공시시스템) 공식 RSS — 실시간 공시 속보

### Infrastructure
- **Docker / Docker Compose** (app + MariaDB 11)

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
| POST | /api/stock/analyze | <i class="fa-solid fa-check"></i> | AI 주식 차트 분석 |
| GET | /api/stock/analyses | <i class="fa-solid fa-check"></i> | 차트 분석 이력 목록 |
| GET | /api/stock/analyses/:id | <i class="fa-solid fa-check"></i> | 차트 분석 이력 조회 |
| DELETE | /api/stock/analyses/:id | <i class="fa-solid fa-check"></i> | 차트 분석 이력 삭제 |
| GET | /api/dart/disclosures | <i class="fa-solid fa-check"></i> | DART 공시 속보 목록 |

---

## <i class="fa-solid fa-triangle-exclamation"></i> 프로덕션 배포 시 주의사항

1. `.env`의 `JWT_SECRET`을 **암호학적으로 안전한 랜덤 문자열(최소 32자)**로 교체하세요.
   생성 명령: `openssl rand -hex 32`
2. MariaDB 비밀번호도 강력한 값으로 변경하세요
3. HTTPS를 적용하는 리버스 프록시(nginx, Caddy 등) 사용을 권장합니다
4. 주식 차트 분석 / 공시 속보는 모두 **참고용 정보**이며, 투자 조언이 아닙니다
