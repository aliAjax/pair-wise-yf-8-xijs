const storageKey = "zfl17-film-strip-desk";

const fallbackThumbs = ["#d49b35", "#347d89", "#b54d48", "#4d7656", "#6d6378"];

const resolutionOptions = ["保留原样放映", "简单修复后放映", "放映时跳过", "更换备用片段"];

const defaultState = {
  reelTitle: "春日试映A卷",
  signer: "",
  signoff: null,
  segments: [
    {
      id: crypto.randomUUID(),
      code: "A-001",
      duration: 18,
      shift: "正常",
      damage: "完好",
      resolution: "",
      note: "开场街景，节奏平稳，适合保留原顺序。",
      thumb: ""
    },
    {
      id: crypto.randomUUID(),
      code: "A-006",
      duration: 9,
      shift: "偏红",
      damage: "轻微划痕",
      resolution: "",
      note: "人物近景左侧有划痕，试映时留意是否明显。",
      thumb: ""
    },
    {
      id: crypto.randomUUID(),
      code: "A-012",
      duration: 14,
      shift: "褪色",
      damage: "接片松动",
      resolution: "",
      note: "接片位置靠近段尾，放映前建议重新压平。",
      thumb: ""
    }
  ]
};

let state = loadState();
let draggedId = null;

const els = {
  reelTitle: document.querySelector("#reelTitle"),
  colorFilter: document.querySelector("#colorFilter"),
  searchInput: document.querySelector("#searchInput"),
  segmentForm: document.querySelector("#segmentForm"),
  codeInput: document.querySelector("#codeInput"),
  durationInput: document.querySelector("#durationInput"),
  shiftInput: document.querySelector("#shiftInput"),
  damageInput: document.querySelector("#damageInput"),
  thumbInput: document.querySelector("#thumbInput"),
  noteInput: document.querySelector("#noteInput"),
  segmentList: document.querySelector("#segmentList"),
  warningList: document.querySelector("#warningList"),
  totalDuration: document.querySelector("#totalDuration"),
  damageCount: document.querySelector("#damageCount"),
  segmentCount: document.querySelector("#segmentCount"),
  exportBtn: document.querySelector("#exportBtn"),
  signoffStatus: document.querySelector("#signoffStatus"),
  signerInput: document.querySelector("#signerInput"),
  signoffBtn: document.querySelector("#signoffBtn"),
  exportOfficialBtn: document.querySelector("#exportOfficialBtn")
};

function loadState() {
  const saved = localStorage.getItem(storageKey);
  if (!saved) return structuredClone(defaultState);
  try {
    const parsed = JSON.parse(saved);
    const merged = { ...structuredClone(defaultState), ...parsed };
    merged.segments = merged.segments.map((item) => ({ resolution: "", ...item }));
    merged.signoff = parsed.signoff ?? null;
    merged.signer = parsed.signer ?? "";
    return merged;
  } catch {
    return structuredClone(defaultState);
  }
}

function saveState() {
  localStorage.setItem(storageKey, JSON.stringify(state));
}

function isRiskSegment(item) {
  return item.damage !== "完好" || item.shift !== "正常";
}

function getPendingRisks() {
  return state.segments.filter((item) => isRiskSegment(item) && !item.resolution);
}

function getFilteredSegments() {
  const color = els.colorFilter.value;
  const keyword = els.searchInput.value.trim();
  return state.segments.filter((item) => {
    const matchesColor = color === "all" || item.shift === color;
    const matchesKeyword = !keyword || `${item.code}${item.note}${item.damage}`.includes(keyword);
    return matchesColor && matchesKeyword;
  });
}

function hashString(text) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

// 签核指纹：按当前片序记录每个片段的编号、时长、色偏、破损和处理结论，
// 之后任何增删、调序、改时长或改结论都会改变指纹，使旧签核失效。
function computeFingerprint() {
  const payload = state.segments
    .map((item) => [item.id, item.code, item.duration, item.shift, item.damage, item.resolution].join("|"))
    .join(";");
  return hashString(payload);
}

function buildCheckNumber(fingerprint, signer, time) {
  const head = hashString(`${fingerprint}|${signer}|${time}`);
  const tail = hashString(`${time}|${signer}|${fingerprint}`);
  return `HD-${head.slice(0, 4)}${tail.slice(0, 4)}`.toUpperCase();
}

function getSignoffStatus() {
  if (!state.signoff) return "none";
  return state.signoff.fingerprint === computeFingerprint() ? "valid" : "stale";
}

function canSignNow() {
  return state.segments.length > 0 && getPendingRisks().length === 0 && state.signer.trim().length > 0;
}

function renderStats() {
  const total = state.segments.reduce((sum, item) => sum + Number(item.duration), 0);
  const damaged = state.segments.filter((item) => item.damage !== "完好").length;
  els.totalDuration.textContent = formatDuration(total);
  els.damageCount.textContent = damaged;
  els.segmentCount.textContent = state.segments.length;
}

function renderList() {
  const segments = getFilteredSegments();
  els.segmentList.innerHTML =
    segments
      .map((item) => {
        const realIndex = state.segments.findIndex((segment) => segment.id === item.id);
        const hasDamage = item.damage !== "完好";
        const risk = isRiskSegment(item);
        return `
          <article class="segment-card" draggable="true" data-id="${item.id}">
            <div class="thumb">
              ${
                item.thumb
                  ? `<img src="${item.thumb}" alt="${escapeHtml(item.code)}缩略图" />`
                  : `<div class="film-placeholder" style="background:${fallbackThumbs[realIndex % fallbackThumbs.length]}">${escapeHtml(item.code)}</div>`
              }
            </div>
            <div class="segment-main">
              <div class="segment-title">
                <strong>${realIndex + 1}. ${escapeHtml(item.code)}</strong>
                <span>${formatDuration(item.duration)}</span>
              </div>
              <div class="tag-row">
                <span class="tag">${escapeHtml(item.shift)}</span>
                <span class="tag ${hasDamage ? "damage" : "ok"}">${escapeHtml(item.damage)}</span>
              </div>
              <div class="segment-meta">
                <label class="duration-edit">
                  时长（秒）
                  <input type="number" min="1" value="${Number(item.duration)}" data-duration="${item.id}" />
                </label>
                ${
                  risk
                    ? `<label class="resolution-edit">
                        处理结论
                        <select data-resolution="${item.id}">
                          <option value="" ${item.resolution ? "" : "selected"}>待处理…</option>
                          ${resolutionOptions
                            .map((option) => `<option value="${option}" ${item.resolution === option ? "selected" : ""}>${option}</option>`)
                            .join("")}
                        </select>
                      </label>`
                    : ""
                }
              </div>
              <p class="segment-note">${escapeHtml(item.note || "没有备注。")}</p>
            </div>
            <div class="segment-actions">
              <button type="button" title="上移" data-move-up="${item.id}">↑</button>
              <button type="button" title="下移" data-move-down="${item.id}">↓</button>
              <button type="button" title="删除" data-delete="${item.id}">×</button>
            </div>
          </article>
        `;
      })
      .join("") || `<p class="empty">没有符合筛选的片段。</p>`;
}

function renderWarnings() {
  const warnings = state.segments.filter(isRiskSegment);
  els.warningList.innerHTML =
    warnings
      .map((item) => {
        const index = state.segments.findIndex((segment) => segment.id === item.id) + 1;
        const reasons = [item.shift !== "正常" ? item.shift : "", item.damage !== "完好" ? item.damage : ""].filter(Boolean).join(" · ");
        const resolved = Boolean(item.resolution);
        return `
          <div class="warning-item ${resolved ? "resolved" : ""}">
            <strong>${index}. ${escapeHtml(item.code)}</strong>
            <span>${escapeHtml(reasons)}${item.note ? `：${escapeHtml(item.note)}` : ""}</span>
            <span class="warning-resolution">${resolved ? `处理结论：${escapeHtml(item.resolution)}` : "处理结论：未填写"}</span>
          </div>
        `;
      })
      .join("") || `<p class="empty">当前清单没有颜色偏移或破损提醒。</p>`;
}

function renderSignoff() {
  const pending = getPendingRisks();
  const status = getSignoffStatus();

  let html = "";
  if (status === "valid") {
    html = `
      <div class="signoff-state valid">
        <span class="signoff-tag">签核有效 · 可按本版放映</span>
        <strong class="check-number">${state.signoff.checkNumber}</strong>
        <dl>
          <div><dt>签名人</dt><dd>${escapeHtml(state.signoff.signer)}</dd></div>
          <div><dt>签核时间</dt><dd>${formatDateTime(state.signoff.time)}</dd></div>
        </dl>
        <p>当前片序、总时长与处理结论均与签核一致，交接时按核对号确认版本。</p>
      </div>`;
  } else if (status === "stale") {
    html = `
      <div class="signoff-state stale">
        <span class="signoff-tag">签核已失效</span>
        <strong class="check-number struck">${state.signoff.checkNumber}</strong>
        <p>签核后清单发生增删、调序、时长或处理结论变更，原签核（${escapeHtml(state.signoff.signer)}，${formatDateTime(state.signoff.time)}）不再适用，请重新签核。</p>
      </div>`;
  } else {
    html = `
      <div class="signoff-state none">
        <span class="signoff-tag">尚未签核</span>
        <p>签核会锁定当前片序、总时长和每个风险片段的处理结论，生成核对号供交接核对。</p>
      </div>`;
  }
  if (pending.length > 0) {
    html += `<p class="signoff-pending">待处理风险项 ${pending.length} 个（${pending.map((item) => escapeHtml(item.code)).join("、")}），在片段卡片上填写处理结论后才能签核。</p>`;
  }
  els.signoffStatus.innerHTML = html;

  els.signoffBtn.disabled = !canSignNow();
  els.signoffBtn.textContent = status === "valid" ? "重新签核当前版本" : "生成签核";
  els.exportOfficialBtn.disabled = status !== "valid";
  if (els.signerInput.value !== state.signer) els.signerInput.value = state.signer;
}

function renderAll() {
  saveState();
  els.reelTitle.value = state.reelTitle;
  renderStats();
  renderList();
  renderWarnings();
  renderSignoff();
}

function formatDuration(seconds) {
  const value = Number(seconds) || 0;
  const minutes = Math.floor(value / 60);
  const rest = String(value % 60).padStart(2, "0");
  return `${minutes}:${rest}`;
}

function formatDateTime(value) {
  const date = new Date(value);
  const pad = (number) => String(number).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve) => {
    if (!file) {
      resolve("");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => resolve("");
    reader.readAsDataURL(file);
  });
}

async function addSegment(event) {
  event.preventDefault();
  const thumb = await readFileAsDataUrl(els.thumbInput.files[0]);
  state.segments.push({
    id: crypto.randomUUID(),
    code: els.codeInput.value.trim(),
    duration: Number(els.durationInput.value),
    shift: els.shiftInput.value,
    damage: els.damageInput.value,
    resolution: "",
    note: els.noteInput.value.trim(),
    thumb
  });
  els.segmentForm.reset();
  els.durationInput.value = 12;
  renderAll();
}

function moveSegment(id, direction) {
  const index = state.segments.findIndex((item) => item.id === id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= state.segments.length) return;
  const [item] = state.segments.splice(index, 1);
  state.segments.splice(target, 0, item);
  renderAll();
}

function createSignoff() {
  if (!canSignNow()) return;
  const fingerprint = computeFingerprint();
  const time = new Date().toISOString();
  const signer = state.signer.trim();
  state.signoff = {
    signer,
    time,
    fingerprint,
    checkNumber: buildCheckNumber(fingerprint, signer, time)
  };
  renderAll();
}

function exportList() {
  const status = getSignoffStatus();
  const signed = status === "valid" ? state.signoff : null;
  const total = state.segments.reduce((sum, item) => sum + Number(item.duration), 0);
  const lines = [];

  if (signed) {
    lines.push("胶片放映正式清单");
    lines.push(`核对号：${signed.checkNumber}`);
    lines.push(`签名人：${signed.signer}`);
    lines.push(`签核时间：${formatDateTime(signed.time)}`);
  } else {
    lines.push("胶片放映清单（无可用签核）");
    if (status === "stale") {
      lines.push(`【注意】签核后清单发生过增删、调序、时长或处理结论变更，原核对号 ${state.signoff.checkNumber} 已失效。`);
    } else {
      lines.push("【注意】本清单尚未完成放映签核。");
    }
    lines.push("当前没有可用签核，本清单仅供整理参考，不能作为正式放映依据。");
  }

  lines.push(`胶片卷：${state.reelTitle || "未命名胶片卷"}`);
  lines.push(`总时长：${formatDuration(total)}`);
  lines.push(`片段数：${state.segments.length}`);
  lines.push("");
  state.segments.forEach((item, index) => {
    const parts = [`${index + 1}. ${item.code}`, formatDuration(item.duration), item.shift, item.damage];
    if (isRiskSegment(item)) parts.push(`处理结论：${item.resolution || "未填写"}`);
    parts.push(item.note || "无备注");
    lines.push(parts.join("｜"));
  });

  const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = signed
    ? `${state.reelTitle || "film-reel"}-正式清单-${signed.checkNumber}.txt`
    : `${state.reelTitle || "film-reel"}-未签核清单.txt`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

els.reelTitle.addEventListener("input", () => {
  state.reelTitle = els.reelTitle.value;
  saveState();
});
els.colorFilter.addEventListener("change", renderList);
els.searchInput.addEventListener("input", renderList);
els.segmentForm.addEventListener("submit", addSegment);
els.exportBtn.addEventListener("click", exportList);
els.exportOfficialBtn.addEventListener("click", exportList);
els.signoffBtn.addEventListener("click", createSignoff);

els.signerInput.addEventListener("input", () => {
  state.signer = els.signerInput.value;
  saveState();
  els.signoffBtn.disabled = !canSignNow();
});

els.segmentList.addEventListener("click", (event) => {
  const up = event.target.closest("[data-move-up]");
  const down = event.target.closest("[data-move-down]");
  const remove = event.target.closest("[data-delete]");
  if (up) moveSegment(up.dataset.moveUp, -1);
  if (down) moveSegment(down.dataset.moveDown, 1);
  if (remove) {
    state.segments = state.segments.filter((item) => item.id !== remove.dataset.delete);
    renderAll();
  }
});

els.segmentList.addEventListener("change", (event) => {
  const durationField = event.target.closest("[data-duration]");
  const resolutionField = event.target.closest("[data-resolution]");
  if (durationField) {
    const item = state.segments.find((segment) => segment.id === durationField.dataset.duration);
    if (item) {
      item.duration = Math.max(1, Number(durationField.value) || 1);
      renderAll();
    }
  }
  if (resolutionField) {
    const item = state.segments.find((segment) => segment.id === resolutionField.dataset.resolution);
    if (item) {
      item.resolution = resolutionField.value;
      renderAll();
    }
  }
});

els.segmentList.addEventListener("dragstart", (event) => {
  const card = event.target.closest("[data-id]");
  if (!card) return;
  draggedId = card.dataset.id;
  card.classList.add("dragging");
  event.dataTransfer.effectAllowed = "move";
});

els.segmentList.addEventListener("dragend", (event) => {
  event.target.closest("[data-id]")?.classList.remove("dragging");
  draggedId = null;
});

els.segmentList.addEventListener("dragover", (event) => {
  const card = event.target.closest("[data-id]");
  if (!card || !draggedId || card.dataset.id === draggedId) return;
  event.preventDefault();
  const fromIndex = state.segments.findIndex((item) => item.id === draggedId);
  const toIndex = state.segments.findIndex((item) => item.id === card.dataset.id);
  if (fromIndex < 0 || toIndex < 0) return;
  const [item] = state.segments.splice(fromIndex, 1);
  state.segments.splice(toIndex, 0, item);
  renderAll();
});

renderAll();
