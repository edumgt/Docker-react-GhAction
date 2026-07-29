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

## <i class="fa-brands fa-aws"></i> AWS 클라우드 / AI 전환 가이드

현재 구현은 Ollama의 HTTP API를 직접 호출합니다. 따라서 `OLLAMA_URL`을 Bedrock 엔드포인트로
바꾸는 것만으로는 동작하지 않습니다. AWS를 사용할 때는 `/api/ai/enhance`,
`/api/stock/analyze`의 Ollama 호출부를 **AWS SDK for Python (`boto3`)의 Bedrock Runtime
`Converse` 또는 `InvokeModel` 호출**로 교체해야 합니다.

### 권장 리소스

| 용도 | AWS 리소스 | 이 프로젝트에서의 역할 | 권장도 |
|---|---|---|---|
| 스케치·차트 이미지 이해 | **Amazon Bedrock + Amazon Nova Pro** | LLaVA를 대체하는 멀티모달 추론. 이미지와 프롬프트를 함께 전달해 묘사/구조화된 차트 분석 생성 | 필수 |
| 이미지 생성 기능 확장(선택) | **Amazon Bedrock + Amazon Nova Canvas** | 사용자의 스케치/텍스트를 바탕으로 결과 이미지를 생성·편집하는 기능 추가 시 사용 | 선택 |
| 유해 콘텐츠·개인정보 제어 | **Amazon Bedrock Guardrails** | 입력 이미지 설명 및 모델 응답의 유해성/PII 정책 적용 | 프로덕션 권장 |
| 이미지 원본 보관 | **Amazon S3** | 현재 MariaDB의 base64 `LONGTEXT` 대신 캔버스·차트 이미지를 비공개 객체로 저장. DB에는 키/메타데이터만 보관 | 프로덕션 권장 |
| 관계형 데이터 | **Amazon RDS for MariaDB** 또는 **Aurora MySQL-Compatible** | `users`, `canvas_saves`, `stock_analyses` 저장. 자동 백업·장애 조치가 필요하면 Aurora 선택 | 필수 |
| 컨테이너 실행 | **Amazon ECS on Fargate + ECR** | FastAPI Docker 이미지를 빌드·배포하고 오토스케일링 | 프로덕션 권장 |
| 공개 진입점 | **Application Load Balancer + ACM** | HTTPS 종료와 ECS 서비스 라우팅 | 프로덕션 권장 |
| 인증·비밀·관측 | **Cognito / Secrets Manager / CloudWatch** | JWT 자체 발급 대체(선택), DB 비밀번호·JWT 키 보관, 로그·지표·알람 | 프로덕션 권장 |
| 네트워크 보호 | **VPC(사설 서브넷), Security Groups, VPC Endpoints, WAF** | DB/ECS 비공개 배치, Bedrock·S3 사설 접근, 공개 API 보호 | 프로덕션 권장 |

Amazon Nova Pro는 텍스트·이미지·비디오를 처리하는 멀티모달 모델이므로 이 앱의 두 분석
기능에 적합합니다. 비용과 응답 시간을 더 우선하면 **Nova Lite**로 먼저 검증하고, 차트의
세부 판독 품질이 중요하면 **Nova Pro**를 사용하세요. 실제 사용 가능 모델과 리전은 계정마다
다를 수 있으므로 아래 명령으로 반드시 확인합니다.

```
Internet
  │ HTTPS
  ▼
CloudFront / WAF (선택) ── ALB ── ECS Fargate: FastAPI
                                      ├── Bedrock Runtime: Nova Pro / Guardrails
                                      ├── S3: 캔버스·차트 원본
                                      ├── RDS MariaDB 또는 Aurora MySQL
                                      ├── Secrets Manager
                                      └── CloudWatch
```

> **투자 데이터 주의:** Bedrock 응답도 투자 조언이 아닙니다. 기존의 고정 유의사항은 유지하고,
> 모델 출력이 매수·매도 지시처럼 보이지 않도록 시스템 프롬프트와 Guardrails 정책을 함께 적용하세요.

### 사전 준비

아래 예시는 AWS CLI v2, `jq`, Linux `base64`를 기준으로 합니다. AWS CLI 자격 증명은 장기
액세스 키 대신 IAM Identity Center 또는 ECS Task Role 사용을 권장합니다. 예시의 리전과
리소스 이름은 조직 규칙에 맞게 바꾸세요.

```bash
# 한 번만 설정: Bedrock이 지원되는 리전을 선택
export AWS_REGION=us-east-1
export APP_NAME=ai-canvas
export AWS_ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"

# 계정/리전에서 호출 가능한 모델과 이미지 입력 가능 모델을 확인
aws bedrock list-foundation-models \
  --region "$AWS_REGION" \
  --by-output-modality TEXT \
  --query 'modelSummaries[?contains(inputModalities, `IMAGE`)].[modelId,modelName,providerName]' \
  --output table

# 사용할 모델의 세부 지원 여부 확인
aws bedrock get-foundation-model \
  --region "$AWS_REGION" \
  --model-identifier amazon.nova-pro-v1:0
```

`AccessDeniedException`이 발생하면 해당 리전에서 모델 사용이 허용되었는지와 실행 역할의
`bedrock:InvokeModel` 권한을 확인하세요. 모델 ID와 지원 리전은 수시로 달라질 수 있으므로
코드나 IaC에 고정하기 전에 위 조회 결과를 기준으로 정합니다.

### AWS CLI: Bedrock 이미지 분석 호출 확인

다음은 로컬 차트 PNG 한 장을 Nova Pro에 보내는 독립 검증 예시입니다. 앱 코드 전환 전에
권한, 모델 접근, 응답 형식을 먼저 확인할 수 있습니다. 이미지가 포함된 요청은 25 MB 제한을
넘지 않도록 리사이즈하세요.

```bash
# chart.png를 Base64로 넣은 Bedrock native InvokeModel 요청 생성
IMAGE_B64="$(base64 -w 0 chart.png)"
jq -n --arg image "$IMAGE_B64" '{
  schemaVersion: "messages-v1",
  system: [{text: "You analyze stock-chart images. Return factual observations only; do not give investment advice."}],
  messages: [{
    role: "user",
    content: [
      {image: {format: "png", source: {bytes: $image}}},
      {text: "차트의 추세, 지지/저항, 캔들 패턴, 이동평균·거래량을 한국어 JSON으로 요약하세요."}
    ]
  }],
  inferenceConfig: {maxTokens: 1000, temperature: 0.2, topP: 0.9}
}' > bedrock-chart-request.json

aws bedrock-runtime invoke-model \
  --region "$AWS_REGION" \
  --model-id amazon.nova-pro-v1:0 \
  --content-type application/json \
  --accept application/json \
  --cli-binary-format raw-in-base64-out \
  --body fileb://bedrock-chart-request.json \
  bedrock-chart-response.json

jq -r '.output.message.content[] | select(.text) | .text' bedrock-chart-response.json
```

앱에서는 요청 본문을 직접 조립하기보다 `boto3.client("bedrock-runtime")`와 `converse`
API를 사용하는 편이 이미지 바이트 처리와 대화 확장에 편리합니다. 단, 위 CLI 예시는
`InvokeModel`의 모델별 native 형식을 보여 주기 위한 것입니다.

### AWS CLI: 최소 권한 Task Role 정책

ECS의 **Task Role**에는 액세스 키를 넣지 말고 다음처럼 필요한 모델·S3 경로·시크릿에만
권한을 부여하세요. `YOUR_SECRET_ARN`은 실제 Secrets Manager ARN으로 교체합니다.

```bash
cat > /tmp/ai-canvas-task-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "InvokeVisionModel",
      "Effect": "Allow",
      "Action": ["bedrock:InvokeModel", "bedrock:InvokeModelWithResponseStream"],
      "Resource": "arn:aws:bedrock:${AWS_REGION}::foundation-model/amazon.nova-pro-v1:0"
    },
    {
      "Sid": "CanvasObjectsOnly",
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::${APP_NAME}-${AWS_ACCOUNT_ID}-${AWS_REGION}/uploads/*"
    },
    {
      "Sid": "ReadApplicationSecrets",
      "Effect": "Allow",
      "Action": "secretsmanager:GetSecretValue",
      "Resource": "YOUR_SECRET_ARN"
    }
  ]
}
EOF

aws iam put-role-policy \
  --role-name "${APP_NAME}-ecs-task-role" \
  --policy-name "${APP_NAME}-runtime" \
  --policy-document file:///tmp/ai-canvas-task-policy.json
```

Guardrails를 적용했다면 `bedrock:ApplyGuardrail` 권한을 추가하고, 애플리케이션의 Bedrock
호출에 Guardrail ID와 버전을 함께 전달합니다. 실제 프로덕션 정책은 조직의 개인정보·콘텐츠
규정을 반영해 검토하세요.

### AWS CLI: S3 이미지 저장소와 비밀 만들기

S3는 공개 ACL을 사용하지 않고, 기본 암호화·퍼블릭 액세스 차단을 적용합니다. 앱은 업로드
이미지를 `uploads/{user_id}/{uuid}.png` 같은 키로 저장하고 DB에는 S3 키만 저장하는 구조를
권장합니다.

```bash
export IMAGE_BUCKET="${APP_NAME}-${AWS_ACCOUNT_ID}-${AWS_REGION}"

aws s3api create-bucket --bucket "$IMAGE_BUCKET" --region "$AWS_REGION"
aws s3api put-public-access-block --bucket "$IMAGE_BUCKET" \
  --public-access-block-configuration \
  'BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true'
aws s3api put-bucket-encryption --bucket "$IMAGE_BUCKET" \
  --server-side-encryption-configuration \
  '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"aws:kms"},"BucketKeyEnabled":true}]}'

# 값은 셸 히스토리에 남지 않도록 운영 환경에서는 --secret-string 대신 안전한 배포 파이프라인을 사용
aws secretsmanager create-secret \
  --name "${APP_NAME}/production/app" \
  --secret-string '{"JWT_SECRET":"REPLACE_ME","DB_PASSWORD":"REPLACE_ME"}'
```

> `us-east-1` 이외 리전에서 버킷을 만들 때는 `create-bucket`에
> `--create-bucket-configuration LocationConstraint="$AWS_REGION"`을 추가하세요.
> 이미 존재하는 버킷/시크릿을 다시 생성하면 실패하므로, 재실행 자동화는 IaC(CDK, CloudFormation,
> Terraform)로 관리하는 것이 안전합니다.

### 애플리케이션 전환 체크리스트

1. `requirements.txt`에 `boto3`를 추가하고 `server.py`의 Ollama 요청을 Bedrock Runtime 호출로 교체합니다.
2. `OLLAMA_URL` 대신 `AWS_REGION`, `BEDROCK_MODEL_ID`, `BEDROCK_GUARDRAIL_ID`,
   `BEDROCK_GUARDRAIL_VERSION`, `S3_BUCKET`을 환경 변수/Task Definition에 설정합니다.
3. ECS Task Role에 위 최소 권한을 부여하고 DB/JWT 값은 Secrets Manager에서 주입합니다.
4. 이미지 원본을 S3로 이전한 뒤 `canvas_saves.canvas_data`, `stock_analyses.image_data`는 S3 키를 담도록
   마이그레이션합니다. 기존 base64 데이터의 백필·롤백 계획을 먼저 준비하세요.
5. Bedrock 호출의 지연 시간, 오류, 토큰 사용량을 CloudWatch에서 모니터링하고 예산 알림을 설정합니다.

참고 문서: [Bedrock 모델 조회](https://docs.aws.amazon.com/bedrock/latest/userguide/models-get-info.html),
[Amazon Nova Pro 모델 카드](https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-amazon-nova-pro.html),
[Nova 이미지 이해 요청 형식](https://docs.aws.amazon.com/nova/latest/userguide/modalities-image-examples.html),
[Bedrock Guardrails](https://docs.aws.amazon.com/bedrock/latest/userguide/guardrails.html).

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
