import http from 'http';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import mysql from 'mysql2/promise';

const PORT = Number(process.env.PORT || 3000);
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const AI_REQUEST_TIMEOUT_MS = 120_000;

const DEFAULT_JWT_SECRET = 'canvas-secret-key-change-in-production';
const JWT_SECRET = process.env.JWT_SECRET || DEFAULT_JWT_SECRET;
if (!process.env.JWT_SECRET) {
  console.warn(
    '[WARN] JWT_SECRET is not set. Using an insecure default. ' +
    'Set JWT_SECRET to a cryptographically random string of at least 32 characters in production.',
  );
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_DIR = path.join(__dirname, 'dist');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
};

// ── Database ──────────────────────────────────────────────────────

let db;

async function initDB() {
  const config = {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'canvasuser',
    password: process.env.DB_PASSWORD || 'canvaspass',
    database: process.env.DB_NAME || 'canvasdb',
    waitForConnections: true,
    connectionLimit: 10,
    connectTimeout: 30000,
  };

  let retries = 15;
  let attempt = 0;
  while (attempt < retries) {
    try {
      db = await mysql.createPool(config);
      await db.execute('SELECT 1');
      console.log('Database connected successfully');
      break;
    } catch (err) {
      attempt++;
      console.log(`DB connection failed (attempt ${attempt}/${retries}): ${err.message}`);
      if (attempt === retries) throw err;
      await new Promise((r) => setTimeout(r, 3000));
    }
  }

  // Seed test users if they do not exist yet
  const hash = await bcrypt.hash('123456', 10);
  await db.execute(
    `INSERT IGNORE INTO users (email, password_hash) VALUES
     ('test1@test.com', ?), ('test2@test.com', ?)`,
    [hash, hash],
  );
  console.log('Test users ready (test1@test.com, test2@test.com / 123456)');
}

// ── Helpers ───────────────────────────────────────────────────────

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(JSON.stringify(payload));
}

async function parseRequestBody(req, maxBytes = 20 * 1024 * 1024) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > maxBytes) {
      const e = new Error('Request body too large');
      e.code = 'BODY_TOO_LARGE';
      throw e;
    }
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf-8');
  return raw ? JSON.parse(raw) : {};
}

function verifyToken(req) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

async function serveStaticFile(res, filePath) {
  try {
    const content = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
    return true;
  } catch {
    return false;
  }
}

// ── Router ────────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host}`);
  const { pathname } = url;

  // CORS pre-flight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    });
    return res.end();
  }

  try {
    // ── Health ────────────────────────────────────────────────────
    if (pathname === '/api/health' && req.method === 'GET') {
      return sendJson(res, 200, { status: 'ok' });
    }

    // ── Auth: login ───────────────────────────────────────────────
    if (pathname === '/api/auth/login' && req.method === 'POST') {
      const { email, password } = await parseRequestBody(req);

      if (!email || !password) {
        return sendJson(res, 400, { message: '이메일과 비밀번호를 입력해주세요.' });
      }

      const [rows] = await db.execute(
        'SELECT id, email, password_hash FROM users WHERE email = ?',
        [email],
      );

      const user = rows[0];
      const valid = user && (await bcrypt.compare(password, user.password_hash));

      if (!valid) {
        return sendJson(res, 401, { message: '이메일 또는 비밀번호가 올바르지 않습니다.' });
      }

      const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '24h' });
      return sendJson(res, 200, { token, user: { id: user.id, email: user.email } });
    }

    // ── Auth: current user ────────────────────────────────────────
    if (pathname === '/api/auth/me' && req.method === 'GET') {
      const td = verifyToken(req);
      if (!td) return sendJson(res, 401, { message: '인증이 필요합니다.' });
      return sendJson(res, 200, { user: { id: td.userId, email: td.email } });
    }

    // ── Canvas saves: list ────────────────────────────────────────
    if (pathname === '/api/saves' && req.method === 'GET') {
      const td = verifyToken(req);
      if (!td) return sendJson(res, 401, { message: '인증이 필요합니다.' });

      const [rows] = await db.execute(
        'SELECT id, created_at FROM canvas_saves WHERE user_id = ? ORDER BY created_at DESC',
        [td.userId],
      );
      return sendJson(res, 200, { saves: rows });
    }

    // ── Canvas saves: create ──────────────────────────────────────
    if (pathname === '/api/saves' && req.method === 'POST') {
      const td = verifyToken(req);
      if (!td) return sendJson(res, 401, { message: '인증이 필요합니다.' });

      const { canvasData } = await parseRequestBody(req);

      if (!canvasData || typeof canvasData !== 'string' || !canvasData.startsWith('data:image/')) {
        return sendJson(res, 400, { message: '유효한 캔버스 이미지 데이터가 필요합니다.' });
      }
      if (canvasData.length > 15 * 1024 * 1024) {
        return sendJson(res, 413, { message: '이미지 데이터가 너무 큽니다 (최대 15 MB).' });
      }

      const [result] = await db.execute(
        'INSERT INTO canvas_saves (user_id, canvas_data) VALUES (?, ?)',
        [td.userId, canvasData],
      );
      return sendJson(res, 201, { id: result.insertId, message: '저장 완료' });
    }

    // ── Canvas saves: get one ─────────────────────────────────────
    if (pathname.startsWith('/api/saves/') && req.method === 'GET') {
      const td = verifyToken(req);
      if (!td) return sendJson(res, 401, { message: '인증이 필요합니다.' });

      const saveId = Number(pathname.split('/')[3]);
      if (!saveId || !Number.isInteger(saveId)) {
        return sendJson(res, 400, { message: '유효한 저장 ID가 필요합니다.' });
      }

      const [rows] = await db.execute(
        'SELECT id, canvas_data, created_at FROM canvas_saves WHERE id = ? AND user_id = ?',
        [saveId, td.userId],
      );
      if (!rows.length) return sendJson(res, 404, { message: '저장된 캔버스를 찾을 수 없습니다.' });
      return sendJson(res, 200, rows[0]);
    }

    // ── Canvas saves: delete ──────────────────────────────────────
    if (pathname.startsWith('/api/saves/') && req.method === 'DELETE') {
      const td = verifyToken(req);
      if (!td) return sendJson(res, 401, { message: '인증이 필요합니다.' });

      const saveId = Number(pathname.split('/')[3]);
      if (!saveId || !Number.isInteger(saveId)) {
        return sendJson(res, 400, { message: '유효한 저장 ID가 필요합니다.' });
      }

      await db.execute('DELETE FROM canvas_saves WHERE id = ? AND user_id = ?', [saveId, td.userId]);
      return sendJson(res, 200, { message: '삭제 완료' });
    }

    // ── AI: enhance sketch via Ollama LLaVA ───────────────────────
    if (pathname === '/api/ai/enhance' && req.method === 'POST') {
      const td = verifyToken(req);
      if (!td) return sendJson(res, 401, { message: '인증이 필요합니다.' });

      const { imageData } = await parseRequestBody(req);
      if (!imageData || !imageData.startsWith('data:image/')) {
        return sendJson(res, 400, { message: '유효한 이미지 데이터가 필요합니다.' });
      }

      const base64Image = imageData.replace(/^data:image\/\w+;base64,/, '');

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), AI_REQUEST_TIMEOUT_MS);

      try {
        const ollamaRes = await fetch(`${OLLAMA_URL}/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            model: 'llava',
            prompt:
              '이 스케치를 보고 사실적이고 자연스러운 이미지로 표현한다면 어떤 모습일지 상세하게 묘사해주세요. ' +
              '색상, 질감, 빛, 분위기, 구도 등을 포함하여 예술적으로 설명해주세요. ' +
              '한국어로 답변해주세요.',
            images: [base64Image],
            stream: false,
          }),
        });

        clearTimeout(timeout);

        if (!ollamaRes.ok) {
          const text = await ollamaRes.text().catch(() => '');
          return sendJson(res, 503, {
            message: 'Ollama AI 서비스에 연결할 수 없습니다.',
            hint: 'docker compose exec ollama ollama pull llava',
            detail: text,
          });
        }

        const aiJson = await ollamaRes.json();
        return sendJson(res, 200, { description: aiJson.response, model: 'llava' });
      } catch (err) {
        clearTimeout(timeout);
        const hint =
          err.name === 'AbortError'
            ? 'AI 응답 시간이 초과되었습니다 (120초). 더 작은 이미지로 시도해주세요.'
            : 'docker compose exec ollama ollama pull llava 를 실행하여 모델을 먼저 다운로드하세요.';
        return sendJson(res, 503, { message: `AI 서비스 오류: ${err.message}`, hint });
      }
    }

    // ── Static files ──────────────────────────────────────────────
    const requestedPath = pathname === '/' ? '/index.html' : pathname;
    const staticPath = path.join(DIST_DIR, requestedPath);

    if (await serveStaticFile(res, staticPath)) return;

    const fallback = path.join(DIST_DIR, 'index.html');
    if (await serveStaticFile(res, fallback)) return;

    sendJson(res, 404, { message: 'Not found' });
  } catch (error) {
    if (error.code === 'BODY_TOO_LARGE') {
      return sendJson(res, 413, { message: '요청 본문이 너무 큽니다.' });
    }
    if (error instanceof SyntaxError) {
      return sendJson(res, 400, { message: '잘못된 JSON 형식입니다.' });
    }
    console.error('Server error:', error);
    return sendJson(res, 500, { message: `서버 오류: ${error.message}` });
  }
});

// ── Boot ──────────────────────────────────────────────────────────

try {
  await initDB();
  server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
} catch (err) {
  console.error('Server initialisation failed:', err);
  process.exit(1);
}
