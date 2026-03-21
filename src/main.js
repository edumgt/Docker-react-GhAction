// ── State ─────────────────────────────────────────────────────────
let drawing = false;
let startX = 0;
let startY = 0;
let brushColor = '#000000';
let brushSize = 5;
let currentTool = 'pen';
let useGrid = false;
let authToken = localStorage.getItem('canvas_token');
let currentUser = null;
let snapshotBeforeShape = null;

// ── DOM refs ───────────────────────────────────────────────────────
const loginPage        = document.getElementById('loginPage');
const appPage          = document.getElementById('appPage');
const loginForm        = document.getElementById('loginForm');
const loginEmail       = document.getElementById('loginEmail');
const loginPassword    = document.getElementById('loginPassword');
const loginError       = document.getElementById('loginError');

const offcanvas        = document.getElementById('offcanvas');
const offcanvasBackdrop= document.getElementById('offcanvasBackdrop');
const openOffcanvasBtn = document.getElementById('openOffcanvas');
const closeOffcanvasBtn= document.getElementById('closeOffcanvas');
const userEmailDisplay = document.getElementById('userEmailDisplay');
const logoutBtn        = document.getElementById('logoutBtn');
const savesList        = document.getElementById('savesList');
const refreshSavesBtn  = document.getElementById('refreshSavesBtn');

const bgCanvas         = document.getElementById('backgroundCanvas');
const bgCtx            = bgCanvas.getContext('2d');
const drawCanvas       = document.getElementById('drawingCanvas');
const drawCtx          = drawCanvas.getContext('2d');

const colorPicker      = document.getElementById('colorPicker');
const brushSizeInput   = document.getElementById('brushSize');
const brushSizeLabel   = document.getElementById('brushSizeLabel');
const toolSelect       = document.getElementById('toolSelect');
const gridToggle       = document.getElementById('gridToggle');
const clearBtn         = document.getElementById('clearBtn');
const savePngBtn       = document.getElementById('savePngBtn');
const saveJpgBtn       = document.getElementById('saveJpgBtn');
const saveToServerBtn  = document.getElementById('saveToServerBtn');
const aiHelpBtn        = document.getElementById('aiHelpBtn');
const statusText       = document.getElementById('statusText');

const aiModal          = document.getElementById('aiModal');
const closeAiModalBtn  = document.getElementById('closeAiModal');
const aiLoading        = document.getElementById('aiLoading');
const aiResult         = document.getElementById('aiResult');
const aiError          = document.getElementById('aiError');
const aiSketchPreview  = document.getElementById('aiSketchPreview');
const aiDescription    = document.getElementById('aiDescription');
const aiErrorMsg       = document.getElementById('aiErrorMsg');
const aiErrorHint      = document.getElementById('aiErrorHint');

// ── API helper ─────────────────────────────────────────────────────
async function api(method, url, body = null) {
  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    },
  };
  if (body !== null) opts.body = JSON.stringify(body);
  return fetch(url, opts);
}

// ── Status bar ─────────────────────────────────────────────────────
let statusTimer;
function setStatus(msg, isError = false) {
  clearTimeout(statusTimer);
  statusText.textContent = msg;
  statusText.className = isError ? 'ml-auto text-xs text-red-500 flex-shrink-0'
                                 : 'ml-auto text-xs text-gray-500 flex-shrink-0';
  if (msg) statusTimer = setTimeout(() => { statusText.textContent = ''; }, 4000);
}

// ── Page switching ─────────────────────────────────────────────────
function showLogin() {
  loginPage.style.display = '';
  appPage.style.display   = 'none';
}

function showApp() {
  loginPage.style.display  = 'none';
  appPage.style.display    = 'flex';
  userEmailDisplay.textContent = currentUser?.email ?? '';
  resizeCanvas();
  refreshSaves();
}

// ── Auth check on load ─────────────────────────────────────────────
async function checkAuth() {
  if (!authToken) { showLogin(); return; }
  try {
    const res = await api('GET', '/api/auth/me');
    if (res.ok) {
      currentUser = (await res.json()).user;
      showApp();
    } else {
      authToken = null;
      localStorage.removeItem('canvas_token');
      showLogin();
    }
  } catch {
    showLogin();
  }
}

// ── Login form ─────────────────────────────────────────────────────
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginError.hidden = true;

  const email    = loginEmail.value.trim();
  const password = loginPassword.value;
  if (!email || !password) {
    loginError.textContent = '이메일과 비밀번호를 입력해주세요.';
    loginError.hidden = false;
    return;
  }

  try {
    const res  = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      loginError.textContent = data.message ?? '로그인 실패';
      loginError.hidden = false;
      return;
    }
    authToken   = data.token;
    currentUser = data.user;
    localStorage.setItem('canvas_token', authToken);
    showApp();
  } catch (err) {
    loginError.textContent = `서버 오류: ${err.message}`;
    loginError.hidden = false;
  }
});

// ── Logout ─────────────────────────────────────────────────────────
logoutBtn.addEventListener('click', () => {
  authToken   = null;
  currentUser = null;
  localStorage.removeItem('canvas_token');
  closeOffcanvasPanel();
  showLogin();
});

// ── Offcanvas ──────────────────────────────────────────────────────
function openOffcanvasPanel() {
  offcanvas.classList.remove('-translate-x-full');
  offcanvasBackdrop.hidden = false;
}
function closeOffcanvasPanel() {
  offcanvas.classList.add('-translate-x-full');
  offcanvasBackdrop.hidden = true;
}

openOffcanvasBtn.addEventListener('click', openOffcanvasPanel);
closeOffcanvasBtn.addEventListener('click', closeOffcanvasPanel);
offcanvasBackdrop.addEventListener('click', closeOffcanvasPanel);

// ── Saved works list ───────────────────────────────────────────────
async function refreshSaves() {
  try {
    const res = await api('GET', '/api/saves');
    if (!res.ok) return;
    renderSavesList((await res.json()).saves);
  } catch (err) {
    console.error('Failed to refresh saves:', err);
  }
}

function fmtDate(isoStr) {
  const d    = new Date(isoStr);
  const now  = new Date();
  const time = d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });

  const dDate   = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const nowDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.round((nowDate - dDate) / 86400000);

  if (diffDays === 0) return `오늘 ${time}`;
  if (diffDays === 1) return `어제 ${time}`;
  return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' }) + ' ' + time;
}

function renderSavesList(saves) {
  if (!saves?.length) {
    savesList.innerHTML = '<p class="text-sm text-gray-400 text-center py-6">저장된 작업이 없습니다</p>';
    return;
  }

  // Group by calendar date
  const groups = {};
  saves.forEach((s) => {
    const key = new Date(s.created_at).toLocaleDateString('ko-KR');
    (groups[key] ??= []).push(s);
  });

  savesList.innerHTML = Object.entries(groups).map(([date, items]) => `
    <div class="mb-1">
      <p class="text-xs font-semibold text-gray-400 px-3 py-1.5 bg-gray-50 sticky top-0">${date}</p>
      ${items.map((item) => `
        <div class="group flex items-center hover:bg-indigo-50 rounded-lg mx-1 my-0.5">
          <button class="flex-1 text-left px-3 py-2.5 flex items-center gap-2 load-btn"
                  data-id="${item.id}">
            <span class="text-indigo-400 group-hover:text-indigo-600 text-base">🖼</span>
            <span class="text-sm text-gray-700 group-hover:text-indigo-700">
              ${new Date(item.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          </button>
          <button class="px-2 py-2 text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity del-btn flex-shrink-0"
                  data-id="${item.id}" title="삭제">✕</button>
        </div>
      `).join('')}
    </div>
  `).join('');

  savesList.querySelectorAll('.load-btn').forEach((btn) =>
    btn.addEventListener('click', () => loadSave(Number(btn.dataset.id))));

  savesList.querySelectorAll('.del-btn').forEach((btn) =>
    btn.addEventListener('click', (e) => { e.stopPropagation(); deleteSave(Number(btn.dataset.id)); }));
}

async function loadSave(id) {
  try {
    const res  = await api('GET', `/api/saves/${id}`);
    if (!res.ok) { setStatus('불러오기 실패', true); return; }
    const data = await res.json();
    const img  = new Image();
    img.onload = () => {
      clearDrawingLayer();
      redrawBackground();
      drawCtx.drawImage(img, 0, 0, drawCanvas.width, drawCanvas.height);
      setStatus(`불러오기 완료 ✓`);
      closeOffcanvasPanel();
    };
    img.onerror = () => setStatus('이미지 로드 실패', true);
    img.src = data.canvas_data;
  } catch (err) {
    setStatus(`불러오기 오류: ${err.message}`, true);
  }
}

async function deleteSave(id) {
  if (!confirm('이 저장본을 삭제하시겠습니까?')) return;
  try {
    const res = await api('DELETE', `/api/saves/${id}`);
    if (res.ok) { setStatus('삭제 완료'); refreshSaves(); }
  } catch (err) {
    setStatus(`삭제 오류: ${err.message}`, true);
  }
}

refreshSavesBtn.addEventListener('click', refreshSaves);

// ── Canvas resize ──────────────────────────────────────────────────
function resizeCanvas() {
  const container = bgCanvas.parentElement;
  const w = container.clientWidth;
  const h = container.clientHeight;
  bgCanvas.width  = drawCanvas.width  = w;
  bgCanvas.height = drawCanvas.height = h;
  redrawBackground();
}

// ── Background / grid ──────────────────────────────────────────────
function drawGrid(spacing = 25) {
  bgCtx.strokeStyle = '#e0e0e0';
  bgCtx.lineWidth   = 1;
  for (let x = 0; x < bgCanvas.width; x += spacing) {
    bgCtx.beginPath(); bgCtx.moveTo(x, 0); bgCtx.lineTo(x, bgCanvas.height); bgCtx.stroke();
  }
  for (let y = 0; y < bgCanvas.height; y += spacing) {
    bgCtx.beginPath(); bgCtx.moveTo(0, y); bgCtx.lineTo(bgCanvas.width, y); bgCtx.stroke();
  }
}

function redrawBackground() {
  bgCtx.fillStyle = '#ffffff';
  bgCtx.fillRect(0, 0, bgCanvas.width, bgCanvas.height);
  if (useGrid) drawGrid();
}

// ── Canvas helpers ─────────────────────────────────────────────────
function mergeToDataUrl() {
  const tmp    = document.createElement('canvas');
  tmp.width    = bgCanvas.width;
  tmp.height   = bgCanvas.height;
  const ctx    = tmp.getContext('2d');
  ctx.drawImage(bgCanvas, 0, 0);
  ctx.drawImage(drawCanvas, 0, 0);
  return tmp.toDataURL('image/png');
}

function clearDrawingLayer() {
  drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
}

function saveLocalFile(type = 'png') {
  const a      = document.createElement('a');
  a.download   = `drawing.${type}`;
  a.href       = mergeToDataUrl().replace('image/png', `image/${type}`);
  a.click();
}

// ── Save to server ─────────────────────────────────────────────────
saveToServerBtn.addEventListener('click', async () => {
  setStatus('저장 중…');
  try {
    const res = await api('POST', '/api/saves', { canvasData: mergeToDataUrl() });
    const d   = await res.json();
    if (!res.ok) { setStatus(d.message || '저장 실패', true); return; }
    setStatus('저장 완료 ✓');
    refreshSaves();
  } catch (err) {
    setStatus(`저장 오류: ${err.message}`, true);
  }
});

// ── AI Help ────────────────────────────────────────────────────────
aiHelpBtn.addEventListener('click', async () => {
  const imageData = mergeToDataUrl();

  // Open modal — loading state
  aiModal.hidden   = false;
  aiLoading.hidden = false;
  aiResult.hidden  = true;
  aiError.hidden   = true;
  aiSketchPreview.src = imageData;

  try {
    const res  = await api('POST', '/api/ai/enhance', { imageData });
    const data = await res.json();

    aiLoading.hidden = true;
    if (!res.ok) {
      aiErrorMsg.textContent  = data.message ?? 'AI 서비스 오류';
      aiErrorHint.textContent = data.hint ?? '';
      aiError.hidden = false;
      return;
    }
    aiDescription.textContent = data.description;
    aiResult.hidden = false;
  } catch (err) {
    aiLoading.hidden = true;
    aiErrorMsg.textContent  = `연결 오류: ${err.message}`;
    aiErrorHint.textContent = 'Ollama 서비스가 실행 중인지 확인하세요.';
    aiError.hidden = false;
  }
});

function closeAiModalFn() { aiModal.hidden = true; }
closeAiModalBtn.addEventListener('click', closeAiModalFn);
aiModal.addEventListener('click', (e) => { if (e.target === aiModal) closeAiModalFn(); });

// ── Canvas drawing events ──────────────────────────────────────────
window.addEventListener('resize', resizeCanvas);

gridToggle.addEventListener('change', (e) => {
  useGrid = e.target.checked;
  redrawBackground();
});

drawCanvas.addEventListener('mousedown', (e) => {
  drawing = true;
  startX  = e.offsetX;
  startY  = e.offsetY;

  if (currentTool === 'pen' || currentTool === 'eraser') {
    drawCtx.beginPath();
    drawCtx.moveTo(startX, startY);
  } else {
    // Snapshot the drawing layer so we can re-draw the shape preview live
    snapshotBeforeShape = drawCtx.getImageData(0, 0, drawCanvas.width, drawCanvas.height);
  }
});

drawCanvas.addEventListener('mousemove', (e) => {
  if (!drawing) return;
  const ex = e.offsetX, ey = e.offsetY;

  if (currentTool === 'pen' || currentTool === 'eraser') {
    drawCtx.lineWidth   = brushSize;
    drawCtx.lineCap     = 'round';
    drawCtx.strokeStyle = currentTool === 'eraser' ? '#ffffff' : brushColor;
    drawCtx.lineTo(ex, ey);
    drawCtx.stroke();
    return;
  }

  // Live preview for shapes
  if (snapshotBeforeShape) {
    drawCtx.putImageData(snapshotBeforeShape, 0, 0);
  }
  drawCtx.lineWidth   = brushSize;
  drawCtx.strokeStyle = brushColor;

  if (currentTool === 'line') {
    drawCtx.beginPath();
    drawCtx.moveTo(startX, startY);
    drawCtx.lineTo(ex, ey);
    drawCtx.stroke();
  } else if (currentTool === 'rect') {
    drawCtx.strokeRect(startX, startY, ex - startX, ey - startY);
  } else if (currentTool === 'circle') {
    const r = Math.hypot(ex - startX, ey - startY);
    drawCtx.beginPath();
    drawCtx.arc(startX, startY, r, 0, Math.PI * 2);
    drawCtx.stroke();
  }
});

drawCanvas.addEventListener('mouseup', () => {
  drawing = false;
  snapshotBeforeShape = null;
});

drawCanvas.addEventListener('mouseleave', () => {
  if (drawing && (currentTool === 'pen' || currentTool === 'eraser')) {
    drawing = false;
  }
});

// ── Toolbar event wiring ───────────────────────────────────────────
colorPicker.addEventListener('input',  (e) => { brushColor = e.target.value; });
brushSizeInput.addEventListener('input', (e) => {
  brushSize = Number(e.target.value);
  brushSizeLabel.textContent = brushSize;
});
toolSelect.addEventListener('change',  (e) => { currentTool = e.target.value; });
clearBtn.addEventListener('click', clearDrawingLayer);
savePngBtn.addEventListener('click', () => saveLocalFile('png'));
saveJpgBtn.addEventListener('click', () => saveLocalFile('jpeg'));

// ── Bootstrap ──────────────────────────────────────────────────────
checkAuth();
