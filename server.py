import asyncio
import os
import time
from pathlib import Path

import aiomysql
import bcrypt
import httpx
import jwt
from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

load_dotenv()

PORT = int(os.getenv("PORT", 3000))
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
JWT_SECRET = os.getenv("JWT_SECRET", "canvas-secret-key-change-in-production")
AI_TIMEOUT = 120.0

if not os.getenv("JWT_SECRET"):
    print("[WARN] JWT_SECRET is not set. Using an insecure default.")

DB_CONFIG = dict(
    host=os.getenv("DB_HOST", "localhost"),
    port=int(os.getenv("DB_PORT", 3306)),
    user=os.getenv("DB_USER", "canvasuser"),
    password=os.getenv("DB_PASSWORD", "canvaspass"),
    db=os.getenv("DB_NAME", "canvasdb"),
    charset="utf8mb4",
    autocommit=True,
)

app = FastAPI()
pool = None


# ── Startup ───────────────────────────────────────────────────────────

@app.on_event("startup")
async def startup():
    global pool
    for attempt in range(15):
        try:
            pool = await aiomysql.create_pool(**DB_CONFIG, minsize=1, maxsize=10)
            async with pool.acquire() as conn:
                async with conn.cursor() as cur:
                    await cur.execute("SELECT 1")
            print("Database connected successfully")
            break
        except Exception as exc:
            print(f"DB connection failed (attempt {attempt + 1}/15): {exc}")
            if attempt == 14:
                raise
            await asyncio.sleep(3)

    hashed = bcrypt.hashpw(b"123456", bcrypt.gensalt()).decode()
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                "INSERT IGNORE INTO users (email, password_hash) VALUES (%s, %s), (%s, %s)",
                ("test1@test.com", hashed, "test2@test.com", hashed),
            )
    print("Test users ready (test1@test.com, test2@test.com / 123456)")


@app.on_event("shutdown")
async def shutdown():
    if pool:
        pool.close()
        await pool.wait_closed()


# ── Helpers ───────────────────────────────────────────────────────────

def _verify_token(request: Request):
    auth = request.headers.get("authorization", "")
    if not auth.startswith("Bearer "):
        return None
    try:
        return jwt.decode(auth[7:], JWT_SECRET, algorithms=["HS256"])
    except Exception:
        return None


def _json(payload: dict, status: int = 200) -> JSONResponse:
    return JSONResponse(payload, status_code=status)


def _serialize_row(row: dict) -> dict:
    for k, v in row.items():
        if hasattr(v, "isoformat"):
            row[k] = v.isoformat()
    return row


# ── Health ────────────────────────────────────────────────────────────

@app.get("/api/health")
async def health():
    return {"status": "ok"}


# ── Auth ──────────────────────────────────────────────────────────────

@app.post("/api/auth/login")
async def login(request: Request):
    try:
        data = await request.json()
    except Exception:
        return _json({"message": "잘못된 JSON 형식입니다."}, 400)

    email = (data.get("email") or "").strip()
    password = data.get("password") or ""

    if not email or not password:
        return _json({"message": "이메일과 비밀번호를 입력해주세요."}, 400)

    async with pool.acquire() as conn:
        async with conn.cursor(aiomysql.DictCursor) as cur:
            await cur.execute(
                "SELECT id, email, password_hash FROM users WHERE email = %s", (email,)
            )
            user = await cur.fetchone()

    if not user or not bcrypt.checkpw(password.encode(), user["password_hash"].encode()):
        return _json({"message": "이메일 또는 비밀번호가 올바르지 않습니다."}, 401)

    token = jwt.encode(
        {"userId": user["id"], "email": user["email"], "exp": int(time.time()) + 86400},
        JWT_SECRET,
        algorithm="HS256",
    )
    return _json({"token": token, "user": {"id": user["id"], "email": user["email"]}})


@app.get("/api/auth/me")
async def me(request: Request):
    td = _verify_token(request)
    if not td:
        return _json({"message": "인증이 필요합니다."}, 401)
    return _json({"user": {"id": td["userId"], "email": td["email"]}})


# ── Canvas saves ──────────────────────────────────────────────────────

@app.get("/api/saves")
async def list_saves(request: Request):
    td = _verify_token(request)
    if not td:
        return _json({"message": "인증이 필요합니다."}, 401)

    async with pool.acquire() as conn:
        async with conn.cursor(aiomysql.DictCursor) as cur:
            await cur.execute(
                "SELECT id, created_at FROM canvas_saves WHERE user_id = %s ORDER BY created_at DESC",
                (td["userId"],),
            )
            saves = [_serialize_row(r) for r in await cur.fetchall()]

    return _json({"saves": saves})


@app.post("/api/saves")
async def create_save(request: Request):
    td = _verify_token(request)
    if not td:
        return _json({"message": "인증이 필요합니다."}, 401)

    try:
        data = await request.json()
    except Exception:
        return _json({"message": "잘못된 JSON 형식입니다."}, 400)

    canvas_data = data.get("canvasData", "")
    if not canvas_data or not canvas_data.startswith("data:image/"):
        return _json({"message": "유효한 캔버스 이미지 데이터가 필요합니다."}, 400)
    if len(canvas_data) > 15 * 1024 * 1024:
        return _json({"message": "이미지 데이터가 너무 큽니다 (최대 15 MB)."}, 413)

    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                "INSERT INTO canvas_saves (user_id, canvas_data) VALUES (%s, %s)",
                (td["userId"], canvas_data),
            )
            save_id = cur.lastrowid

    return _json({"id": save_id, "message": "저장 완료"}, 201)


@app.get("/api/saves/{save_id}")
async def get_save(save_id: int, request: Request):
    td = _verify_token(request)
    if not td:
        return _json({"message": "인증이 필요합니다."}, 401)

    async with pool.acquire() as conn:
        async with conn.cursor(aiomysql.DictCursor) as cur:
            await cur.execute(
                "SELECT id, canvas_data, created_at FROM canvas_saves WHERE id = %s AND user_id = %s",
                (save_id, td["userId"]),
            )
            row = await cur.fetchone()

    if not row:
        return _json({"message": "저장된 캔버스를 찾을 수 없습니다."}, 404)

    return _json(_serialize_row(row))


@app.delete("/api/saves/{save_id}")
async def delete_save(save_id: int, request: Request):
    td = _verify_token(request)
    if not td:
        return _json({"message": "인증이 필요합니다."}, 401)

    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                "DELETE FROM canvas_saves WHERE id = %s AND user_id = %s",
                (save_id, td["userId"]),
            )

    return _json({"message": "삭제 완료"})


# ── AI enhance ────────────────────────────────────────────────────────

@app.post("/api/ai/enhance")
async def ai_enhance(request: Request):
    td = _verify_token(request)
    if not td:
        return _json({"message": "인증이 필요합니다."}, 401)

    try:
        data = await request.json()
    except Exception:
        return _json({"message": "잘못된 JSON 형식입니다."}, 400)

    image_data = data.get("imageData", "")
    if not image_data or not image_data.startswith("data:image/"):
        return _json({"message": "유효한 이미지 데이터가 필요합니다."}, 400)

    base64_image = image_data.split(",", 1)[1] if "," in image_data else image_data

    try:
        async with httpx.AsyncClient(timeout=AI_TIMEOUT) as client:
            res = await client.post(
                f"{OLLAMA_URL}/api/generate",
                json={
                    "model": "llava:34b",
                    "prompt": (
                        "이 스케치를 보고 사실적이고 자연스러운 이미지로 표현한다면 어떤 모습일지 상세하게 묘사해주세요. "
                        "색상, 질감, 빛, 분위기, 구도 등을 포함하여 예술적으로 설명해주세요. "
                        "한국어로 답변해주세요."
                    ),
                    "images": [base64_image],
                    "stream": False,
                },
            )

        if res.status_code != 200:
            return _json(
                {
                    "message": "Ollama AI 서비스에 연결할 수 없습니다.",
                    "hint": "ollama pull llava:34b",
                    "detail": res.text[:500],
                },
                503,
            )

        return _json({"description": res.json()["response"], "model": "llava"})

    except httpx.TimeoutException:
        return _json(
            {
                "message": "AI 응답 시간이 초과되었습니다 (120초). 더 작은 이미지로 시도해주세요.",
                "hint": "더 작은 이미지로 시도해주세요.",
            },
            503,
        )
    except Exception as exc:
        return _json(
            {
                "message": f"AI 서비스 오류: {exc}",
                "hint": "ollama pull llava:34b 를 실행하여 모델을 먼저 다운로드하세요.",
            },
            503,
        )


# ── Static files (must be last) ───────────────────────────────────────

STATIC_DIR = Path(__file__).parent / "static"
app.mount("/", StaticFiles(directory=str(STATIC_DIR), html=True), name="static")
