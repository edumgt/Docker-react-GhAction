# Canvas Drawing Tool (Vite + Vanilla JS + Node.js)

Canvas API 기반 드로잉 툴에 **Node.js 서버 모듈**을 결합해, 캔버스 결과를 서버 storage에 UUID 기반 SVG 파일로 저장/조회할 수 있도록 확장한 프로젝트입니다.

## 주요 기능

- 자유 곡선 드로잉
- 색상 선택 및 브러시 굵기 조절
- 지우개
- 직선/사각형/원 도형 그리기
- PNG/JPG 이미지 저장
- 모눈 종이 배경 토글
- 화면 크기에 맞춘 캔버스 리사이즈
- 서버 저장: 캔버스 결과를 SVG로 변환 후 `storage/<uuid>.svg` 파일로 저장
- 저장 목록 조회 및 기존 SVG 불러오기

## 서버 저장/불러오기 동작

1. FE에서 `Save SVG to Server` 클릭
2. 캔버스 2개 레이어(배경 + 드로잉)를 병합 후 SVG 문자열 생성
3. `POST /api/svgs` 호출
4. Node.js 서버가 UUID 파일명으로 `storage/*.svg` 저장
5. `GET /api/svgs`로 목록 조회, `GET /api/svgs/:fileName`으로 SVG 불러오기

## 기술 스택

### Frontend
- Vite
- Vanilla JavaScript
- Tailwind CSS
- Canvas API

### Backend
- Node.js 20
- Node.js built-in HTTP server
- File System Storage (`/storage`)
- UUID(`crypto.randomUUID`)

### DevOps / Runtime
- Docker (멀티 스테이지 빌드)
- GitHub Actions (Docker build/push workflow)

## 로컬 개발

```bash
npm install
npm run dev
```

서버 API를 로컬에서 함께 확인하려면 별도 터미널에서:

```bash
npm run dev:server
```

- FE(dev): `http://localhost:5173`
- API(server): `http://localhost:3000/api/health`

## 프로덕션 빌드/실행

```bash
npm run build
npm run start
```

## Docker

### 이미지 빌드

```bash
docker build -t canvas-node-app .
```

### 컨테이너 실행 (storage 볼륨 마운트 권장)

```bash
docker run -d -p 3000:3000 -v $(pwd)/storage:/app/storage --name canvas-app canvas-node-app
```

이렇게 실행하면 컨테이너 재시작/재생성 후에도 저장된 SVG 파일이 호스트 `storage` 디렉터리에 유지됩니다.

## API 요약

- `GET /api/health`: 서버 상태 확인
- `GET /api/svgs`: 저장된 SVG 파일 목록 조회
- `POST /api/svgs`: SVG 저장 (`{ "svgContent": "<svg ...>" }`)
- `GET /api/svgs/:fileName`: 개별 SVG 반환

## 참고

- Docker Hub 연동 및 GitHub Actions 설정 관련 노트는 `docker-work.md`에 정리되어 있습니다.
