const bgCanvas = document.getElementById('backgroundCanvas');
const bgCtx = bgCanvas.getContext('2d');
const drawCanvas = document.getElementById('drawingCanvas');
const drawCtx = drawCanvas.getContext('2d');

const gridToggle = document.getElementById('gridToggle');
const colorPicker = document.getElementById('colorPicker');
const brushSizeInput = document.getElementById('brushSize');
const toolSelect = document.getElementById('toolSelect');
const savedSvgSelect = document.getElementById('savedSvgSelect');
const saveSvgServerBtn = document.getElementById('saveSvgServerBtn');
const refreshSvgListBtn = document.getElementById('refreshSvgListBtn');
const loadSvgBtn = document.getElementById('loadSvgBtn');
const statusText = document.getElementById('statusText');

let drawing = false;
let startX = 0;
let startY = 0;
let brushColor = colorPicker.value;
let brushSize = Number(brushSizeInput.value);
let currentTool = 'pen';
let useGrid = false;

function setStatus(message, isError = false) {
  statusText.textContent = message;
  statusText.className = isError ? 'text-xs text-red-600' : 'text-xs text-slate-600';
}

function resizeCanvas() {
  const width = window.innerWidth - 40;
  const height = window.innerHeight - 150;

  bgCanvas.width = drawCanvas.width = width;
  bgCanvas.height = drawCanvas.height = height;

  redrawBackground();
}

function drawGrid(spacing = 25) {
  bgCtx.strokeStyle = '#e0e0e0';
  bgCtx.lineWidth = 1;

  for (let x = 0; x < bgCanvas.width; x += spacing) {
    bgCtx.beginPath();
    bgCtx.moveTo(x, 0);
    bgCtx.lineTo(x, bgCanvas.height);
    bgCtx.stroke();
  }

  for (let y = 0; y < bgCanvas.height; y += spacing) {
    bgCtx.beginPath();
    bgCtx.moveTo(0, y);
    bgCtx.lineTo(bgCanvas.width, y);
    bgCtx.stroke();
  }
}

function redrawBackground() {
  bgCtx.fillStyle = '#ffffff';
  bgCtx.fillRect(0, 0, bgCanvas.width, bgCanvas.height);

  if (useGrid) {
    drawGrid();
  }
}

function mergeCanvasToImageDataUrl() {
  const tempCanvas = document.createElement('canvas');
  const tempCtx = tempCanvas.getContext('2d');
  tempCanvas.width = bgCanvas.width;
  tempCanvas.height = bgCanvas.height;

  tempCtx.drawImage(bgCanvas, 0, 0);
  tempCtx.drawImage(drawCanvas, 0, 0);

  return tempCanvas.toDataURL('image/png');
}

function canvasToSvgString() {
  const imageData = mergeCanvasToImageDataUrl();
  const width = bgCanvas.width;
  const height = bgCanvas.height;

  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">\n  <image width="100%" height="100%" href="${imageData}" />\n</svg>`;
}

function saveCanvas(type = 'png') {
  const link = document.createElement('a');
  link.download = `drawing.${type}`;
  link.href = mergeCanvasToImageDataUrl().replace('image/png', `image/${type}`);
  link.click();
}

async function refreshSavedSvgList() {
  try {
    const response = await fetch('/api/svgs');
    if (!response.ok) {
      throw new Error('목록 조회 실패');
    }

    const data = await response.json();
    savedSvgSelect.innerHTML = '<option value="">저장된 SVG 선택</option>';

    data.files.forEach((fileName) => {
      const option = document.createElement('option');
      option.value = fileName;
      option.textContent = fileName;
      savedSvgSelect.appendChild(option);
    });

    setStatus(`SVG ${data.files.length}개를 불러왔습니다.`);
  } catch (error) {
    setStatus(`SVG 목록 조회 실패: ${error.message}`, true);
  }
}

async function saveSvgToServer() {
  const svgContent = canvasToSvgString();

  try {
    const response = await fetch('/api/svgs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ svgContent }),
    });

    if (!response.ok) {
      throw new Error('저장 실패');
    }

    const result = await response.json();
    setStatus(`저장 완료: ${result.fileName}`);
    await refreshSavedSvgList();
    savedSvgSelect.value = result.fileName;
  } catch (error) {
    setStatus(`서버 저장 실패: ${error.message}`, true);
  }
}

function clearDrawingLayer() {
  drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
}

async function loadSvgToCanvas() {
  const fileName = savedSvgSelect.value;

  if (!fileName) {
    setStatus('불러올 SVG를 선택해 주세요.', true);
    return;
  }

  try {
    const image = new Image();
    image.onload = () => {
      clearDrawingLayer();
      redrawBackground();
      drawCtx.drawImage(image, 0, 0, drawCanvas.width, drawCanvas.height);
      setStatus(`불러오기 완료: ${fileName}`);
    };
    image.onerror = () => {
      setStatus(`SVG 이미지 렌더링 실패: ${fileName}`, true);
    };
    image.src = `/api/svgs/${fileName}?t=${Date.now()}`;
  } catch (error) {
    setStatus(`SVG 불러오기 실패: ${error.message}`, true);
  }
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

gridToggle.addEventListener('change', (e) => {
  useGrid = e.target.checked;
  redrawBackground();
});

drawCanvas.addEventListener('mousedown', (e) => {
  drawing = true;
  startX = e.offsetX;
  startY = e.offsetY;

  if (currentTool === 'pen' || currentTool === 'eraser') {
    drawCtx.beginPath();
    drawCtx.moveTo(startX, startY);
  }
});

drawCanvas.addEventListener('mousemove', (e) => {
  if (!drawing) {
    return;
  }

  if (currentTool === 'pen' || currentTool === 'eraser') {
    drawCtx.lineWidth = brushSize;
    drawCtx.lineCap = 'round';
    drawCtx.strokeStyle = currentTool === 'eraser' ? '#ffffff' : brushColor;
    drawCtx.lineTo(e.offsetX, e.offsetY);
    drawCtx.stroke();
  }
});

drawCanvas.addEventListener('mouseup', (e) => {
  if (!drawing) {
    return;
  }

  drawing = false;

  const endX = e.offsetX;
  const endY = e.offsetY;

  drawCtx.lineWidth = brushSize;
  drawCtx.strokeStyle = brushColor;

  if (currentTool === 'line') {
    drawCtx.beginPath();
    drawCtx.moveTo(startX, startY);
    drawCtx.lineTo(endX, endY);
    drawCtx.stroke();
  } else if (currentTool === 'rect') {
    drawCtx.strokeRect(startX, startY, endX - startX, endY - startY);
  } else if (currentTool === 'circle') {
    const radius = Math.hypot(endX - startX, endY - startY);
    drawCtx.beginPath();
    drawCtx.arc(startX, startY, radius, 0, Math.PI * 2);
    drawCtx.stroke();
  }
});

colorPicker.addEventListener('input', (e) => {
  brushColor = e.target.value;
});

brushSizeInput.addEventListener('input', (e) => {
  brushSize = Number(e.target.value);
});

toolSelect.addEventListener('change', (e) => {
  currentTool = e.target.value;
});

document.getElementById('clearBtn').addEventListener('click', clearDrawingLayer);
document.getElementById('savePngBtn').addEventListener('click', () => saveCanvas('png'));
document.getElementById('saveJpgBtn').addEventListener('click', () => saveCanvas('jpeg'));
saveSvgServerBtn.addEventListener('click', saveSvgToServer);
refreshSvgListBtn.addEventListener('click', refreshSavedSvgList);
loadSvgBtn.addEventListener('click', loadSvgToCanvas);

refreshSavedSvgList();
