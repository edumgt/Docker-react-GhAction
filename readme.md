# Canvas Drawing Tool (Vite + Vanilla JS + Tailwind)

Vite + Vanilla JS + Tailwind + Canvas 기반의 드로잉 툴 프로젝트입니다.

## 주요 기능

- 자유 곡선 드로잉
- 색상 선택 및 브러시 굵기 조절
- 지우개
- 직선/사각형/원 도형 그리기
- PNG/JPG 이미지 저장
- 모눈 종이 배경 토글
- 화면 크기에 맞춘 캔버스 리사이즈

## 기술 스택

- Vite
- Vanilla JavaScript
- Tailwind CSS
- Canvas API

## 개발 환경 실행

```bash
npm install
npm run dev
```

## 빌드

```bash
npm run build
```

## Docker

### 이미지 빌드

```bash
docker build -t vite-nginx .
```

### 컨테이너 실행

```bash
docker run -d -p 8080:80 vite-nginx
```

## 참고

- Docker Hub 연동 및 GitHub Actions 설정 관련 노트는 `docker-work.md`에 정리되어 있습니다.
