import { getData, saveData } from "./store.js";
import { closeModal, openModal, showToast } from "./ui.js";

const STATUS_LABELS = {
  active: "进行中",
  completed: "已完成",
  archived: "已归档"
};

const STATUS_ORDER = { active: 1, completed: 2, archived: 3 };

function createId() {
  return `goal_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function normalizeGoal(goal) {
  const progress = Number.parseInt(goal?.progress, 10);
  return {
    id: String(goal?.id || createId()),
    title: String(goal?.title || "").trim(),
    description: String(goal?.description || "").trim(),
    startDate: goal?.startDate || "",
    dueDate: goal?.dueDate || "",
    progress: Number.isInteger(progress) ? Math.min(100, Math.max(0, progress)) : 0,
    status: ["active", "completed", "archived"].includes(goal?.status) ? goal.status : "active",
    createdAt: goal?.createdAt || new Date().toISOString(),
    completedAt: goal?.status === "completed" ? (goal?.completedAt || null) : null
  };
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(dateString) {
  if (!dateString) return "未设置";
  const date = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "日期无效";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

function compareDates(a, b) {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return a.localeCompare(b);
}

export function compareGoals(a, b) {
  const statusComparison = (STATUS_ORDER[a.status] || 99) - (STATUS_ORDER[b.status] || 99);
  if (statusComparison !== 0) return statusComparison;

  const dueComparison = compareDates(a.dueDate, b.dueDate);
  if (dueComparison !== 0) return dueComparison;

  return String(a.createdAt).localeCompare(String(b.createdAt));
}

export function getGoals() {
  return [...getData().goals].map(normalizeGoal).sort(compareGoals);
}

export function getGoalById(goalId) {
  return getData().goals.find((goal) => goal.id === goalId) || null;
}

export function getGoalTaskCount(goalId) {
  return getData().tasks.filter((task) => task.goalId === goalId).length;
}

export function getActiveGoalsForDashboard(limit = 3) {
  return getGoals().filter((goal) => goal.status === "active").slice(0, limit);
}

function isValidDateString(value) {
  if (!value) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  // 不使用 toISOString() 判断日期，避免本地时区导致日期回退一天。
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

export function saveGoal(goalInput, existingGoalId = null) {
  const title = String(goalInput.title || "").trim();
  if (!title) {
    showToast("请输入目标名称");
    return null;
  }

  const startDate = goalInput.startDate || "";
  const dueDate = goalInput.dueDate || "";
  if (!isValidDateString(startDate) || !isValidDateString(dueDate)) {
    showToast("请输入有效日期");
    return null;
  }
  if (startDate && dueDate && dueDate < startDate) {
    showToast("截止日期不能早于开始日期");
    return null;
  }

  const parsedProgress = Number.parseInt(goalInput.progress, 10);
  if (!Number.isInteger(parsedProgress) || parsedProgress < 0 || parsedProgress > 100) {
    showToast("目标进度必须是 0–100 的整数");
    return null;
  }

  const data = getData();
  const now = new Date().toISOString();
  const existingIndex = existingGoalId
    ? data.goals.findIndex((goal) => goal.id === existingGoalId)
    : -1;
  const current = existingIndex >= 0 ? normalizeGoal(data.goals[existingIndex]) : null;
  const status = ["active", "completed", "archived"].includes(goalInput.status)
    ? goalInput.status
    : current?.status || "active";

  const goal = normalizeGoal({
    ...current,
    ...goalInput,
    id: current?.id || createId(),
    title,
    startDate,
    dueDate,
    progress: parsedProgress,
    status,
    createdAt: current?.createdAt || now,
    completedAt: status === "completed" ? (current?.completedAt || now) : null
  });

  if (existingIndex >= 0) {
    data.goals[existingIndex] = goal;
  } else {
    data.goals.push(goal);
  }

  saveData();
  return goal;
}

export function setGoalCompleted(goalId, completed) {
  const data = getData();
  const goal = data.goals.find((item) => item.id === goalId);
  if (!goal) return null;

  goal.status = completed ? "completed" : "active";
  goal.completedAt = completed ? new Date().toISOString() : null;
  saveData();
  return normalizeGoal(goal);
}

export function deleteGoal(goalId) {
  const data = getData();
  const index = data.goals.findIndex((goal) => goal.id === goalId);
  if (index < 0) return false;

  data.goals.splice(index, 1);
  data.tasks.forEach((task) => {
    if (task.goalId === goalId) task.goalId = null;
  });
  saveData();
  return true;
}

function openGoalModal(goal = null) {
  const isEdit = Boolean(goal);

  openModal(`
    <div class="modal-header">
      <div>
        <h2>${isEdit ? "编辑目标" : "新增目标"}</h2>
        <p class="modal-subtitle">目标进度由你手动设置，不根据任务自动计算。</p>
      </div>
      <button class="icon-button" type="button" data-close-modal aria-label="关闭">×</button>
    </div>
    <form id="goal-form" class="form-grid">
      <label>
        <span>目标名称 *</span>
        <input name="title" type="text" maxlength="100" required value="${escapeHtml(goal?.title || "")}" />
      </label>
      <label>
        <span>目标描述</span>
        <textarea name="description" rows="3" maxlength="500">${escapeHtml(goal?.description || "")}</textarea>
      </label>
      <div class="form-row">
        <label>
          <span>开始日期</span>
          <input name="startDate" type="date" value="${escapeHtml(goal?.startDate || "")}" />
        </label>
        <label>
          <span>截止日期</span>
          <input name="dueDate" type="date" value="${escapeHtml(goal?.dueDate || "")}" />
        </label>
      </div>
      <div class="form-row">
        <label>
          <span>进度（0–100）</span>
          <input name="progress" type="number" min="0" max="100" step="1" required value="${goal?.progress ?? 0}" />
        </label>
        <label>
          <span>状态</span>
          <select name="status">
            ${Object.entries(STATUS_LABELS).map(([value, label]) => `
              <option value="${value}" ${goal?.status === value || (!goal && value === "active") ? "selected" : ""}>${label}</option>
            `).join("")}
          </select>
        </label>
      </div>
      <div class="form-actions">
        <button class="btn" type="button" data-close-modal>取消</button>
        <button class="btn btn-primary" type="submit">保存目标</button>
      </div>
    </form>
  `);

  const form = document.getElementById("goal-form");
  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const saved = saveGoal(Object.fromEntries(formData.entries()), goal?.id || null);
    if (!saved) return;

    closeModal();
    renderGoalsPage();
    showToast(isEdit ? "目标已更新" : "目标已新增");
  });

  document.querySelectorAll("[data-close-modal]").forEach((button) => {
    button.addEventListener("click", closeModal);
  });
}

function renderGoalRows(goals) {
  if (!goals.length) return '<div class="empty-state">暂无目标</div>';

  return `
    <div class="goal-list">
      ${goals.map((goal) => `
        <article class="goal-item ${goal.status === "completed" ? "is-completed" : ""}">
          <div class="goal-main">
            <div class="goal-title-row">
              <h3>${escapeHtml(goal.title)}</h3>
              <span class="status-badge">${STATUS_LABELS[goal.status]}</span>
            </div>
            ${goal.description ? `<p class="goal-description">${escapeHtml(goal.description)}</p>` : ""}
            <div class="goal-meta">
              <span>开始：${formatDate(goal.startDate)}</span>
              <span>截止：${formatDate(goal.dueDate)}</span>
              <span>关联任务：${getGoalTaskCount(goal.id)}</span>
            </div>
            <div class="goal-progress-row">
              <div class="progress-track" aria-label="目标进度 ${goal.progress}%"><span style="width: ${goal.progress}%"></span></div>
              <strong>${goal.progress}%</strong>
            </div>
          </div>
          <div class="goal-actions">
            <button class="btn btn-small" type="button" data-goal-action="toggle" data-goal-id="${escapeHtml(goal.id)}">
              ${goal.status === "completed" ? "取消完成" : "完成"}
            </button>
            <button class="btn btn-small" type="button" data-goal-action="edit" data-goal-id="${escapeHtml(goal.id)}">编辑</button>
            <button class="btn btn-small btn-danger" type="button" data-goal-action="delete" data-goal-id="${escapeHtml(goal.id)}">删除</button>
          </div>
        </article>
      `).join("")}
    </div>
  `;
}

function bindGoalActions() {
  document.querySelectorAll("[data-goal-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const goalId = button.dataset.goalId;
      const action = button.dataset.goalAction;
      const goal = getGoalById(goalId);
      if (!goal) return;

      if (action === "toggle") {
        setGoalCompleted(goalId, goal.status !== "completed");
        renderGoalsPage();
        showToast(goal.status === "completed" ? "目标已取消完成" : "目标已完成");
        return;
      }

      if (action === "edit") {
        openGoalModal(normalizeGoal(goal));
        return;
      }

      if (action === "delete") {
        const taskCount = getGoalTaskCount(goalId);
        const message = taskCount
          ? `确定删除目标“${goal.title}”吗？关联的 ${taskCount} 个任务会保留，但目标关联会被清除。`
          : `确定删除目标“${goal.title}”吗？此操作无法撤销。`;
        if (!window.confirm(message)) return;
        deleteGoal(goalId);
        renderGoalsPage();
        showToast("目标已删除，相关任务仍保留");
      }
    });
  });
}

export function renderGoalsPage() {
  const container = document.getElementById("page-content");
  if (!container) return;

  const goals = getGoals();
  container.innerHTML = `
    <div class="page-heading-row">
      <div>
        <h1 class="page-title">目标 / Goals</h1>
        <p class="page-subtitle">管理长期目标、进度和任务关联。</p>
      </div>
      <button id="add-goal-button" class="btn btn-primary" type="button">新增目标</button>
    </div>
    <div class="card goal-card">
      <div class="section-header">
        <h2>目标列表</h2>
        <span class="muted">共 ${goals.length} 项</span>
      </div>
      ${renderGoalRows(goals)}
    </div>
  `;

  document.getElementById("add-goal-button")?.addEventListener("click", () => openGoalModal());
  bindGoalActions();
}

export function renderDashboardGoals() {
  const goals = getActiveGoalsForDashboard(3);

  return `
    <section class="card dashboard-goal-card">
      <div class="section-header">
        <div>
          <h2>长期目标</h2>
          <p class="muted">当前 active 目标，首页最多显示 3 项。</p>
        </div>
        <a class="text-link" href="#/goals">查看全部</a>
      </div>
      ${goals.length ? `
        <div class="dashboard-goal-list">
          ${goals.map((goal) => `
            <div class="dashboard-goal-item">
              <div class="dashboard-goal-info">
                <strong>${escapeHtml(goal.title)}</strong>
                <span>截止：${formatDate(goal.dueDate)}</span>
              </div>
              <div class="goal-progress-row compact">
                <div class="progress-track" aria-label="目标进度 ${goal.progress}%"><span style="width: ${goal.progress}%"></span></div>
                <strong>${goal.progress}%</strong>
              </div>
            </div>
          `).join("")}
        </div>
      ` : '<div class="empty-state">暂无进行中的目标</div>'}
    </section>
  `;
}
