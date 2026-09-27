import { getData, saveData } from "./store.js";
import { closeModal, openModal, showToast } from "./ui.js";

const REVIEW_TYPES = ["daily", "weekly", "monthly"];
const TYPE_LABELS = {
  daily: "日复盘",
  weekly: "周复盘",
  monthly: "月复盘"
};

function pad(value) {
  return String(value).padStart(2, "0");
}

function localDateString(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseLocalDate(dateString) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateString || "");
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date;
}

function getWeekStart(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const configuredStart = Number(getData().settings?.weekStartsOn) === 0 ? 0 : 1;
  const day = start.getDay();
  const diff = (day - configuredStart + 7) % 7;
  start.setDate(start.getDate() - diff);
  return localDateString(start);
}

function getMonthStart(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-01`;
}

function getPeriodDate(type, date = new Date()) {
  if (type === "weekly") return getWeekStart(date);
  if (type === "monthly") return getMonthStart(date);
  return localDateString(date);
}

function getPeriodLabel(type, dateString) {
  if (type === "daily") return dateString;
  if (type === "weekly") return `${dateString} 起的一周`;
  return dateString.slice(0, 7);
}

function normalizeReview(review) {
  return {
    id: review?.id || "",
    type: REVIEW_TYPES.includes(review?.type) ? review.type : "daily",
    date: review?.date || "",
    content: typeof review?.content === "string" ? review.content : "",
    highlights: typeof review?.highlights === "string" ? review.highlights : "",
    problems: typeof review?.problems === "string" ? review.problems : "",
    nextActions: typeof review?.nextActions === "string" ? review.nextActions : "",
    createdAt: review?.createdAt || "",
    updatedAt: review?.updatedAt || ""
  };
}

function getReviews() {
  const data = getData();
  if (!Array.isArray(data.reviews)) data.reviews = [];
  return data.reviews.map(normalizeReview);
}

function sortReviews(reviews) {
  return [...reviews].sort((a, b) => {
    const dateCompare = String(b.date).localeCompare(String(a.date));
    if (dateCompare !== 0) return dateCompare;
    return String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt));
  });
}

function getReviewsByType(type) {
  return sortReviews(getReviews().filter((review) => review.type === type));
}

function getReviewForPeriod(type, date = new Date()) {
  const periodDate = getPeriodDate(type, date);
  return getReviews().find((review) => review.type === type && review.date === periodDate) || null;
}

function hasReviewContent(input) {
  return [input.content, input.highlights, input.problems, input.nextActions]
    .some((value) => String(value || "").trim().length > 0);
}

function validateDate(dateString) {
  return Boolean(parseLocalDate(dateString));
}

function saveReview(input, existingReviewId = null) {
  const type = input.type;
  if (!REVIEW_TYPES.includes(type)) throw new Error("复盘类型无效。");
  if (!validateDate(input.date)) throw new Error("复盘日期无效。");

  const normalized = {
    content: String(input.content || "").trim(),
    highlights: String(input.highlights || "").trim(),
    problems: String(input.problems || "").trim(),
    nextActions: String(input.nextActions || "").trim()
  };

  if (!hasReviewContent(normalized)) {
    throw new Error("至少填写一项复盘内容后才能保存。");
  }

  const data = getData();
  if (!Array.isArray(data.reviews)) data.reviews = [];

  const periodDate = getPeriodDate(type, parseLocalDate(input.date));
  const existingIndex = data.reviews.findIndex((review) => {
    if (!review || review.type !== type) return false;
    return review.date === periodDate;
  });

  const requestedIndex = existingReviewId
    ? data.reviews.findIndex((review) => review.id === existingReviewId)
    : -1;
  const targetIndex = existingIndex >= 0 ? existingIndex : requestedIndex;

  const now = new Date().toISOString();
  if (targetIndex >= 0) {
    const previous = normalizeReview(data.reviews[targetIndex]);
    data.reviews[targetIndex] = {
      ...previous,
      ...normalized,
      type,
      date: periodDate,
      updatedAt: now
    };
  } else {
    data.reviews.push({
      id: `review_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      type,
      date: periodDate,
      ...normalized,
      createdAt: now,
      updatedAt: now
    });
  }

  saveData();
  return data.reviews.find((review) => review.type === type && review.date === periodDate) || null;
}

function deleteReview(reviewId) {
  const data = getData();
  if (!Array.isArray(data.reviews)) data.reviews = [];
  const index = data.reviews.findIndex((review) => review?.id === reviewId);
  if (index < 0) return false;
  data.reviews.splice(index, 1);
  saveData();
  return true;
}

function getFieldConfig(type) {
  if (type === "daily") {
    return [
      ["highlights", "今天最值得记录的事情？"],
      ["problems", "今天遇到的问题？"],
      ["nextActions", "明天最重要的事情？"],
      ["content", "今天完成得怎么样？"]
    ];
  }

  if (type === "weekly") {
    return [
      ["highlights", "本周值得肯定的地方"],
      ["problems", "本周主要问题"],
      ["nextActions", "下周重点"],
      ["content", "本周完成情况"]
    ];
  }

  return [
    ["highlights", "本月完成得比较好的地方"],
    ["problems", "本月主要问题"],
    ["nextActions", "下月重点"],
    ["content", "本月整体情况"]
  ];
}

function renderModal(type, review = null) {
  const isEdit = Boolean(review);
  const title = `${isEdit ? "编辑" : "新增"}${TYPE_LABELS[type]}`;
  const periodDate = review?.date || getPeriodDate(type);
  const fields = getFieldConfig(type);

  openModal(`
    <div class="modal-header">
      <div>
        <h2>${title}</h2>
        <p class="modal-subtitle">当前周期：${getPeriodLabel(type, periodDate)}</p>
      </div>
      <button class="icon-button" type="button" data-close-review-modal aria-label="关闭">×</button>
    </div>
    <form id="review-form" class="form-grid">
      <label>
        日期 / 周起始日 / 月初
        <input name="date" type="date" value="${periodDate}" required>
      </label>
      ${fields.map(([name, label]) => `
        <label>
          ${label}
          <textarea name="${name}" rows="4" placeholder="可以简单记录，不需要写得很长。">${escapeHtml(review?.[name] || "")}</textarea>
        </label>
      `).join("")}
      <div class="form-actions">
        <button class="btn" type="button" data-close-review-modal>取消</button>
        <button class="btn btn-primary" type="submit">保存复盘</button>
      </div>
    </form>
  `);

  document.querySelectorAll("[data-close-review-modal]").forEach((button) => {
    button.addEventListener("click", closeModal);
  });

  document.getElementById("review-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    try {
      saveReview({
        type,
        date: formData.get("date"),
        content: formData.get("content"),
        highlights: formData.get("highlights"),
        problems: formData.get("problems"),
        nextActions: formData.get("nextActions")
      }, review?.id || null);
      closeModal();
      showToast("复盘已保存");
      renderReviewsPage(type);
    } catch (error) {
      showToast(error.message || "保存失败");
    }
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function previewReview(review) {
  const text = [review.highlights, review.problems, review.nextActions, review.content]
    .map((value) => String(value || "").trim())
    .find(Boolean) || "暂无内容";
  return text.length > 80 ? `${text.slice(0, 80)}…` : text;
}

function renderHistory(type) {
  const limit = type === "daily" ? 7 : type === "weekly" ? 4 : 6;
  const reviews = getReviewsByType(type).slice(0, limit);
  if (!reviews.length) {
    return `<div class="empty-state">还没有${TYPE_LABELS[type]}记录。</div>`;
  }

  return `<div class="review-history-list">
    ${reviews.map((review) => `
      <div class="review-history-item">
        <button class="review-history-main" type="button" data-review-edit="${escapeHtml(review.id)}">
          <strong>${escapeHtml(getPeriodLabel(type, review.date))}</strong>
          <span>${escapeHtml(previewReview(review))}</span>
        </button>
        <div class="review-history-actions">
          <button class="btn btn-small" type="button" data-review-edit="${escapeHtml(review.id)}">编辑</button>
          <button class="btn btn-small btn-danger" type="button" data-review-delete="${escapeHtml(review.id)}">删除</button>
        </div>
      </div>
    `).join("")}
  </div>`;
}

function bindReviewEvents(type) {
  document.querySelectorAll("[data-review-edit]").forEach((button) => {
    button.addEventListener("click", () => {
      const review = getReviews().find((item) => item.id === button.dataset.reviewEdit);
      if (review) renderModal(type, review);
    });
  });

  document.querySelectorAll("[data-review-delete]").forEach((button) => {
    button.addEventListener("click", () => {
      const review = getReviews().find((item) => item.id === button.dataset.reviewDelete);
      if (!review) return;
      if (!window.confirm(`确定删除这条${TYPE_LABELS[type]}吗？`)) return;
      if (deleteReview(review.id)) {
        showToast("复盘已删除");
        renderReviewsPage(type);
      }
    });
  });

  document.querySelectorAll("[data-review-tab]").forEach((button) => {
    button.addEventListener("click", () => renderReviewsPage(button.dataset.reviewTab));
  });

  document.querySelector("[data-review-current]")?.addEventListener("click", () => {
    const review = getReviewForPeriod(type);
    renderModal(type, review);
  });
}

export function renderReviewsPage(activeType = "daily") {
  const container = document.getElementById("page-content");
  if (!container) return;
  const type = REVIEW_TYPES.includes(activeType) ? activeType : "daily";
  const currentReview = getReviewForPeriod(type);
  const currentPeriod = getPeriodDate(type);

  container.innerHTML = `
    <div class="page-heading-row">
      <div>
        <h1 class="page-title">复盘 / Reviews</h1>
        <p class="page-subtitle">记录这一周期的情况，并为下一周期留下重点。</p>
      </div>
      <button class="btn btn-primary" type="button" data-review-current>
        ${currentReview ? `编辑本期${TYPE_LABELS[type]}` : `新增本期${TYPE_LABELS[type]}`}
      </button>
    </div>

    <div class="review-tabs" role="tablist" aria-label="复盘类型">
      ${REVIEW_TYPES.map((item) => `
        <button class="review-tab ${item === type ? "is-active" : ""}" type="button" role="tab" aria-selected="${item === type}" data-review-tab="${item}">
          ${TYPE_LABELS[item].replace("复盘", "")}
        </button>
      `).join("")}
    </div>

    <section class="card review-current-card">
      <div class="section-header">
        <div>
          <h2>当前周期</h2>
          <p class="muted">${getPeriodLabel(type, currentPeriod)}</p>
        </div>
        <span class="status-badge">${currentReview ? "已记录" : "未记录"}</span>
      </div>
      ${currentReview ? `
        <div class="review-preview-grid">
          ${getFieldConfig(type).map(([name, label]) => `
            <div class="review-preview-field">
              <span>${label}</span>
              <p>${escapeHtml(currentReview[name] || "未填写")}</p>
            </div>
          `).join("")}
        </div>
      ` : `<div class="empty-state">本期还没有复盘记录，点击右上角开始记录。</div>`}
    </section>

    <section class="card review-history-card">
      <div class="section-header">
        <div>
          <h2>最近${TYPE_LABELS[type]}</h2>
          <p class="muted">${type === "daily" ? "最多显示最近 7 条" : type === "weekly" ? "最多显示最近 4 条" : "最多显示最近 6 条"}</p>
        </div>
      </div>
      ${renderHistory(type)}
    </section>
  `;

  bindReviewEvents(type);
}

export function renderDashboardReviews() {
  const latest = REVIEW_TYPES.map((type) => getReviewsByType(type)[0]).filter(Boolean);

  if (!latest.length) {
    return `
      <section class="card dashboard-review-card">
        <div class="section-header">
          <div>
            <h2>最近复盘</h2>
            <p class="muted">还没有复盘记录</p>
          </div>
          <a class="text-link" href="#/reviews">进入复盘</a>
        </div>
        <div class="empty-state">开始记录日、周或月复盘。</div>
      </section>
    `;
  }

  return `
    <section class="card dashboard-review-card">
      <div class="section-header">
        <div>
          <h2>最近复盘</h2>
          <p class="muted">最近一次日、周、月复盘</p>
        </div>
        <a class="text-link" href="#/reviews">进入复盘</a>
      </div>
      <div class="dashboard-review-list">
        ${REVIEW_TYPES.map((type) => {
          const review = getReviewsByType(type)[0];
          if (!review) return `
            <div class="dashboard-review-item">
              <strong>${TYPE_LABELS[type]}</strong>
              <span class="muted">暂无记录</span>
            </div>
          `;
          return `
            <div class="dashboard-review-item">
              <div>
                <strong>${TYPE_LABELS[type]}</strong>
                <span>${escapeHtml(getPeriodLabel(type, review.date))}</span>
              </div>
              <p>${escapeHtml(previewReview(review))}</p>
            </div>
          `;
        }).join("")}
      </div>
    </section>
  `;
}

export const reviewTestApi = {
  getPeriodDate,
  getWeekStart,
  getMonthStart,
  getReviewsByType,
  getReviewForPeriod,
  saveReview,
  deleteReview
};
