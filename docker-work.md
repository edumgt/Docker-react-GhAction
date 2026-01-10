# GitHub Actions + Docker Hub 연동 노트

이 문서는 GitHub Actions로 Docker 이미지를 빌드/푸시할 때 필요한 설정과 트러블슈팅을 정리한 기록입니다.

## 1) Docker Hub 인증 정보 저장

GitHub 저장소에서 **Settings → Secrets and variables → Actions** 로 이동해 다음 값을 등록합니다.

### Secrets
- `DOCKERHUB_USERNAME`: Docker Hub 계정 ID
- `DOCKERHUB_TOKEN`: Docker Hub Personal Access Token(PAT)

![Docker Hub Secrets 설정](image-2.png)

### Variables
- `IMAGE_NAME`: 이미지 이름(예: `my-app`)
- `ENV`: 환경 구분 값(예: `prod`)

**Secrets vs Variables**
- **Secrets**: 토큰/비밀번호 등 민감 값 저장용
- **Variables**: 공개 가능한 일반 값 저장용

## 2) GitHub Actions 워크플로 예시

```yaml
name: CI/CD with Docker Hub

on:
  push:
    branches: [ "main" ]

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Repository
        uses: actions/checkout@v3

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v2

      - name: Log in to Docker Hub
        uses: docker/login-action@v2
        with:
          username: ${{ secrets.DOCKERHUB_USERNAME }}
          password: ${{ secrets.DOCKERHUB_TOKEN }}

      - name: Build and Push Docker Image
        uses: docker/build-push-action@v4
        with:
          context: .
          push: true
          tags: ${{ secrets.DOCKERHUB_USERNAME }}/my-app:latest
```

### 동작 흐름
1. `main` 브랜치에 push
2. GitHub Actions runner 실행
3. 이미지 빌드 후 Docker Hub에 push

필요하면 이 파이프라인을 AWS/ECS/EC2 배포로 확장 가능합니다.

## 3) 트러블슈팅

### Dockerfile을 찾을 수 없을 때

에러 예시:

```
ERROR: failed to read dockerfile: open Dockerfile: no such file or directory
```

**원인**
- 저장소 루트에 `Dockerfile`이 없거나 경로가 다름

**해결 방법**
- 루트에 `Dockerfile`을 두거나
- `docker/build-push-action`에 `file` 경로를 지정합니다.

```yaml
- name: Build and Push Docker Image
  uses: docker/build-push-action@v4
  with:
    context: .
    file: ./docker/Dockerfile
    push: true
    tags: ${{ secrets.DOCKERHUB_USERNAME }}/my-app:latest
```

### 토큰 권한 부족(401 Unauthorized)

에러 예시:

```
401 Unauthorized: access token has insufficient scopes
```

**원인**
- Docker Hub PAT 권한이 `Read-only`로 생성됨
- `tags`에 설정한 계정/레포가 실제 토큰 소유자와 다름

**해결 방법**
1. Docker Hub에서 **Read & Write** 권한으로 PAT 재발급
2. `tags` 값에 본인 계정/레포를 정확히 지정

```yaml
- name: Log in to Docker Hub
  uses: docker/login-action@v2
  with:
    username: ${{ secrets.DOCKERHUB_USERNAME }}
    password: ${{ secrets.DOCKERHUB_TOKEN }}

- name: Build and Push Docker Image
  uses: docker/build-push-action@v4
  with:
    context: .
    push: true
    tags: ${{ secrets.DOCKERHUB_USERNAME }}/my-app:latest
```

![토큰 권한 문제 예시](image.png)

## 4) Nginx 기반 정적 배포 기록

- Nginx 이미지를 사용해 **정적 HTML 소스**를 Docker Hub에 반영한 사례를 기록해 둡니다.

![Nginx 기반 정적 배포](image-1.png)
