const storageKey = "zfl17-film-strip-desk";

const fallbackThumbs = ["#d49b35", "#347d89", "#b54d48", "#4d7656", "#6d6378"];

const resolutionOptions = ["照原样放映", "修复后放映", "放映时跳过", "调色补偿后放映", "更换片源"];

const defaultState = {
  reelTitle: "春日试映A卷",
  signerName: "",
  approval: null,
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
  approvalStatus: document.querySelector("#approvalStatus"),
  signerInput: document.querySelector("#signerInput"),
  signBtn: document.querySelector("#signBtn"),
  approvalInfo: document.querySelector("#approvalInfo"),
  totalDuration: document.querySelector("#totalDuration"),
  damageCount: document.querySelector("#damageCount"),
  segmentCount: document.querySelector("#segmentCount"),
  exportBtn: document.querySelector("#exportBtn")
};

function loadState() {
  const saved = localStorage.getItem(storageKey);
  if (!saved) return structuredClone(defaultState);
  try {
    return { ...structuredClone(defaultState), ...JSON.parse(saved) };
  } catch {
    return structuredClone(defaultState);
  }
}

function saveState() {
  localStorage.setItem(storageKey, JSON.stringify(state));
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

function isRiskSegment(item) {
  return item.damage !== "完好" || item.shift !== "正常";
}

function getRiskSegments() {
  return state.segments.filter(isRiskSegment);
}

function getUnresolvedRisks() {
  return getRiskSegments().filter((item) => !item.resolution);
}

// 签核快照：片序（id 顺序）、编号、时长、色偏、划痕及处理结论。
// 任一项变化都会让旧签核指纹对不上，从而失效。
function computeFingerprint() {
  return JSON.stringify(
    state.segments.map((item) => [
      item.id,
      item.code,
      Number(item.duration),
      item.shift,
      item.damage,
      item.resolution || ""
    ])
  );
}

function isApprovalValid() {
  return Boolean(state.approval && state.approval.fingerprint === computeFingerprint());
}

function makeCheckNo(fingerprint, date) {
  let hash = 0;
  const source = `${fingerprint}|${date.toISOString()}`;
  for (const char of source) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  const ymd = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("");
  return `HQ-${ymd}-${hash.toString(36).toUpperCase().padStart(6, "0").slice(-6)}`;
}

function formatDateTime(value) {
  return new Date(value).toLocaleString("zh-CN", { hour12: false });
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
      .map((item, index) => {
        const realIndex = state.segments.findIndex((segment) => segment.id === item.id);
        const hasDamage = item.damage !== "完好";
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
                <input class="duration-input" type="number" min="1" value="${Number(item.duration)}" data-duration="${item.id}" title="修改时长（秒）" aria-label="修改时长（秒）" />
              </div>
              <div class="tag-row">
                <span class="tag">${escapeHtml(item.shift)}</span>
                <span class="tag ${hasDamage ? "damage" : "ok"}">${escapeHtml(item.damage)}</span>
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
  const warnings = getRiskSegments();
  els.warningList.innerHTML =
    warnings
      .map((item) => {
        const index = state.segments.findIndex((segment) => segment.id === item.id) + 1;
        const reasons = [item.shift !== "正常" ? item.shift : "", item.damage !== "完好" ? item.damage : ""].filter(Boolean).join(" · ");
        const resolved = Boolean(item.resolution);
        const options = [
          `<option value="" ${resolved ? "" : "selected"}>待处理…</option>`,
          ...resolutionOptions.map(
            (option) => `<option value="${escapeHtml(option)}" ${item.resolution === option ? "selected" : ""}>${escapeHtml(option)}</option>`
          )
        ].join("");
        return `
          <div class="warning-item ${resolved ? "resolved" : ""}">
            <strong>${index}. ${escapeHtml(item.code)}</strong>
            <span>${escapeHtml(reasons)}${item.note ? `：${escapeHtml(item.note)}` : ""}</span>
            <label class="resolution-field">
              处理结论
              <select data-resolution="${item.id}">${options}</select>
            </label>
          </div>
        `;
      })
      .join("") || `<p class="empty">当前清单没有颜色偏移或破损提醒。</p>`;
}

function renderApproval() {
  const valid = isApprovalValid();
  const unresolved = getUnresolvedRisks();
  const total = state.segments.reduce((sum, item) => sum + Number(item.duration), 0);
  const orderText = state.segments.map((item) => item.code).join(" → ") || "（空清单）";

  els.signerInput.value = state.signerName || "";
  els.signBtn.disabled = state.segments.length === 0 || unresolved.length > 0;
  els.signBtn.textContent = state.approval ? "重新签核" : "生成签核";

  if (valid) {
    const approval = state.approval;
    els.approvalStatus.textContent = "已签核 · 有效";
    els.approvalStatus.className = "approval-status ok";
    const conclusions = getRiskSegments()
      .map((item) => {
        const index = state.segments.findIndex((segment) => segment.id === item.id) + 1;
        return `<li><strong>${index}. ${escapeHtml(item.code)}</strong>：${escapeHtml(item.resolution)}</li>`;
      })
      .join("");
    els.approvalInfo.innerHTML = `
      <div class="approval-meta">
        <p><span>核对号</span><strong>${escapeHtml(approval.checkNo)}</strong></p>
        <p><span>签名人</span><strong>${escapeHtml(approval.signer)}</strong></p>
        <p><span>签核时间</span><strong>${escapeHtml(formatDateTime(approval.signedAt))}</strong></p>
      </div>
      <p class="approval-line"><span>签核片序</span>${escapeHtml(orderText)}</p>
      <p class="approval-line"><span>签核总时长</span>${escapeHtml(formatDuration(total))}</p>
      <div class="approval-conclusions">
        <span>划痕 / 色偏处理结论</span>
        <ul>${conclusions || "<li>无风险片段</li>"}</ul>
      </div>
      <p class="approval-hint">签核后如需增删片段、调序、改时长或修改处理结论，需重新签核，否则只能导出无签核清单。</p>
    `;
    return;
  }

  if (state.approval) {
    els.approvalStatus.textContent = "已失效 · 待重签";
    els.approvalStatus.className = "approval-status bad";
    els.approvalInfo.innerHTML = `
      <p class="approval-invalid">
        原核对号 <strong>${escapeHtml(state.approval.checkNo)}</strong>（${escapeHtml(state.approval.signer)}，${escapeHtml(
      formatDateTime(state.approval.signedAt)
    )}）已失效：签核后清单发生过增删片段、调序、改时长或处理结论变更。
      </p>
      <p class="approval-hint">${
        unresolved.length
          ? `还有 ${unresolved.length} 个风险片段未填写处理结论，全部处理后由签名人重新签核。`
          : "风险项已全部处理，确认片序后可重新签核。"
      }</p>
    `;
    return;
  }

  els.approvalStatus.textContent = "未签核";
  els.approvalStatus.className = "approval-status";
  els.approvalInfo.innerHTML = `
    <p class="approval-line"><span>当前片序</span>${escapeHtml(orderText)}</p>
    <p class="approval-line"><span>当前总时长</span>${escapeHtml(formatDuration(total))}</p>
    <p class="approval-hint">${
      state.segments.length === 0
        ? "清单为空，加入片段后才能签核。"
        : unresolved.length
          ? `还有 ${unresolved.length} 个划痕或色偏片段未填写处理结论，全部处理后签核区将生成核对号。`
          : "风险项已全部处理，填入签名人即可签核并导出正式清单。未签核前仍可继续整理。"
    }</p>
  `;
}

function renderAll() {
  saveState();
  els.reelTitle.value = state.reelTitle;
  renderStats();
  renderList();
  renderWarnings();
  renderApproval();
}

function formatDuration(seconds) {
  const value = Number(seconds) || 0;
  const minutes = Math.floor(value / 60);
  const rest = String(value % 60).padStart(2, "0");
  return `${minutes}:${rest}`;
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

function signOff() {
  const signer = els.signerInput.value.trim();
  if (!signer) {
    els.signerInput.focus();
    return;
  }
  if (state.segments.length === 0 || getUnresolvedRisks().length > 0) return;
  const signedAt = new Date();
  const fingerprint = computeFingerprint();
  state.signerName = signer;
  state.approval = {
    signer,
    signedAt: signedAt.toISOString(),
    checkNo: makeCheckNo(fingerprint, signedAt),
    fingerprint
  };
  renderAll();
}

function exportList() {
  const total = state.segments.reduce((sum, item) => sum + Number(item.duration), 0);
  const valid = isApprovalValid();
  const approvalLine = valid
    ? [
        "签核状态：有效（正式放映清单）",
        `核对号：${state.approval.checkNo}`,
        `签名人：${state.approval.signer}`,
        `签核时间：${formatDateTime(state.approval.signedAt)}`,
        `签核片序：${state.segments.map((item) => item.code).join(" → ")}`
      ]
    : [
        "签核状态：无可用签核（本清单仅供整理参考，不得用于正式放映交接）",
        state.approval
          ? `失效核对号：${state.approval.checkNo}（签核后清单已变更：增删片段、调序、改时长或处理结论），请重新签核后再导出正式清单。`
          : "该清单尚未签核：请在全部划痕或色偏片段填写处理结论后，由签名人签核生成核对号。"
      ];
  const lines = [
    `胶片卷：${state.reelTitle || "未命名胶片卷"}`,
    `总时长：${formatDuration(total)}`,
    ...approvalLine,
    "",
    ...state.segments.map((item, index) => {
      const resolution = isRiskSegment(item)
        ? item.resolution || "未处理（不可签核）"
        : "无需处理";
      return `${index + 1}. ${item.code}｜${formatDuration(item.duration)}｜${item.shift}｜${item.damage}｜处理结论：${resolution}｜${item.note || "无备注"}`;
    })
  ];
  const blob = new Blob([`﻿${lines.join("\n")}`], { type: "text/plain;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  const suffix = valid ? `-${state.approval.checkNo}` : "-未签核";
  link.download = `${state.reelTitle || "film-reel"}-checklist${suffix}.txt`;
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
els.signBtn.addEventListener("click", signOff);
els.signerInput.addEventListener("input", () => {
  state.signerName = els.signerInput.value.trim();
  saveState();
});

els.warningList.addEventListener("change", (event) => {
  const select = event.target.closest("[data-resolution]");
  if (!select) return;
  const segment = state.segments.find((item) => item.id === select.dataset.resolution);
  if (!segment) return;
  segment.resolution = select.value;
  renderAll();
});

els.segmentList.addEventListener("change", (event) => {
  const input = event.target.closest("[data-duration]");
  if (!input) return;
  const segment = state.segments.find((item) => item.id === input.dataset.duration);
  if (!segment) return;
  const duration = Number(input.value);
  if (!Number.isFinite(duration) || duration <= 0) {
    input.value = segment.duration;
    return;
  }
  segment.duration = duration;
  renderAll();
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
