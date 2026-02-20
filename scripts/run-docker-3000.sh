#!/usr/bin/env bash
set -euo pipefail

PORTS=(3000 5173 8080)
CONTAINER_NAME="canvas-app"
IMAGE_NAME="canvas-node-app"

kill_port_processes() {
  local port="$1"
  local pids=""

  if command -v lsof >/dev/null 2>&1; then
    pids="$(lsof -ti tcp:"${port}" || true)"
  fi

  if [[ -z "${pids}" ]] && command -v fuser >/dev/null 2>&1; then
    pids="$(fuser "${port}"/tcp 2>/dev/null || true)"
  fi

  if [[ -n "${pids}" ]]; then
    echo "[INFO] Killing local processes on port ${port}: ${pids}"
    kill -9 ${pids} || true
  else
    echo "[INFO] No local process found on port ${port}"
  fi
}

stop_docker_by_port() {
  local port="$1"
  local ids=""

  ids="$(docker ps --format '{{.ID}} {{.Ports}}' | awk -v p=":${port}->" '$0 ~ p {print $1}' | sort -u || true)"

  if [[ -n "${ids}" ]]; then
    echo "[INFO] Stopping containers exposing port ${port}: ${ids}"
    # shellcheck disable=SC2086
    docker stop ${ids} >/dev/null
  else
    echo "[INFO] No running container exposing port ${port}"
  fi
}

if ! command -v docker >/dev/null 2>&1; then
  echo "[ERROR] docker command not found"
  exit 1
fi

for port in "${PORTS[@]}"; do
  kill_port_processes "${port}"
  stop_docker_by_port "${port}"
done

if docker ps -a --format '{{.Names}}' | grep -x "${CONTAINER_NAME}" >/dev/null 2>&1; then
  echo "[INFO] Removing existing container ${CONTAINER_NAME}"
  docker rm -f "${CONTAINER_NAME}" >/dev/null
fi

mkdir -p storage

echo "[INFO] Building docker image: ${IMAGE_NAME}"
docker build -t "${IMAGE_NAME}" .

echo "[INFO] Starting container ${CONTAINER_NAME} on port 3000"
docker run -d \
  --name "${CONTAINER_NAME}" \
  -p 3000:3000 \
  -v "$(pwd)/storage:/app/storage" \
  "${IMAGE_NAME}" >/dev/null

echo "[DONE] App is running at http://localhost:3000"
