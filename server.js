import http from 'http';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

const PORT = Number(process.env.PORT || 3000);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_DIR = path.join(__dirname, 'dist');
const STORAGE_DIR = path.join(__dirname, 'storage');

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

await fs.mkdir(STORAGE_DIR, { recursive: true });

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function sanitizeSvgFileName(fileName) {
  return /^[a-f0-9-]{36}\.svg$/i.test(fileName) ? fileName : null;
}

async function parseRequestBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf-8');
  return raw ? JSON.parse(raw) : {};
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

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host}`);
  const { pathname } = url;

  try {
    if (pathname === '/api/health' && req.method === 'GET') {
      return sendJson(res, 200, { status: 'ok' });
    }

    if (pathname === '/api/svgs' && req.method === 'GET') {
      const files = await fs.readdir(STORAGE_DIR);
      const svgFiles = files.filter((f) => f.endsWith('.svg')).sort((a, b) => b.localeCompare(a));
      return sendJson(res, 200, { files: svgFiles });
    }

    if (pathname === '/api/svgs' && req.method === 'POST') {
      const body = await parseRequestBody(req);
      const { svgContent } = body;

      if (typeof svgContent !== 'string' || !svgContent.trim().startsWith('<')) {
        return sendJson(res, 400, { message: '유효한 svgContent가 필요합니다.' });
      }

      const id = randomUUID();
      const fileName = `${id}.svg`;
      const filePath = path.join(STORAGE_DIR, fileName);
      await fs.writeFile(filePath, svgContent, 'utf-8');

      return sendJson(res, 201, { id, fileName, path: `/api/svgs/${fileName}` });
    }

    if (pathname.startsWith('/api/svgs/') && req.method === 'GET') {
      const fileName = pathname.replace('/api/svgs/', '');
      const validFileName = sanitizeSvgFileName(fileName);

      if (!validFileName) {
        return sendJson(res, 400, { message: '잘못된 파일명 형식입니다.' });
      }

      const filePath = path.join(STORAGE_DIR, validFileName);
      const svg = await fs.readFile(filePath, 'utf-8');
      res.writeHead(200, { 'Content-Type': 'image/svg+xml; charset=utf-8' });
      return res.end(svg);
    }

    const requestedPath = pathname === '/' ? '/index.html' : pathname;
    const staticPath = path.join(DIST_DIR, requestedPath);

    if (await serveStaticFile(res, staticPath)) {
      return;
    }

    const fallback = path.join(DIST_DIR, 'index.html');
    if (await serveStaticFile(res, fallback)) {
      return;
    }

    sendJson(res, 404, { message: 'Not found' });
  } catch (error) {
    if (error.code === 'ENOENT') {
      return sendJson(res, 404, { message: '파일을 찾을 수 없습니다.' });
    }

    if (error instanceof SyntaxError) {
      return sendJson(res, 400, { message: '잘못된 JSON 형식입니다.' });
    }

    return sendJson(res, 500, { message: `서버 오류: ${error.message}` });
  }
});

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
