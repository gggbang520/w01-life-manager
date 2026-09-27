import { getData, saveData } from "./store.js";
import { closeModal, openModal, showToast } from "./ui.js";

const PRIORITY_ORDER = { P1: 1, P2: 2, P3: 3 };
const STATUS_LABELS = {
  pending: "待完成",
  inProgress: "进行中",
  completed: "已完成"
};

function createId() {
  return `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeTask(task) {
  return {
    id: String(task.id || createId()),
    title: String(task.title || "").trim(),
    description: String(task.description || "").trim(),
    priority: ["P1", "P2", "P3"].includes(task.priority) ? task.priority : "P2",
    dueDate: task.dueDate || null,
    status: ["pending", "inProgress", "completed"].includes(task.status) ? task.status : "pending",
    goalId: task.goalId || null,
    createdAt: task.createdAt || new Date().toISOString(),
    completedAt: task.completedAt || null
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

function compareTasks(a, b) {
  const aCompleted = a.status === "completed";
  const bCompleted = b.status === "completed";

  if (aCompleted !== bCompleted) return aCompleted ? 1 : -1;

  const dueComparison = compareDates(a.dueDate, b.dueDate);
  if (dueComparison !== 0) return dueComparison;

  const priorityComparison = (PRIORITY_ORDER[a.priority] || 99) - (PRIORITY_ORDER[b.priority] || 99);
  if (priorityComparison !== 0) return priorityComparison;

  return String(a.createdAt).localeCompare(String(b.createdAt));
}

export function getTasks() {
  return [...getData().tasks].map(normalizeTask).sort(compareTasks);
}

export function getIncompleteTasks() {
  return getTasks().filter((task) => task.status !== "completed");
}

export function getTaskById(taskId) {
  return getData().tasks.find((task) => task.id === taskId) || null;
}

export function saveTask(taskInput, existingTaskId = null) {
  const title = String(taskInput.title || "").trim();
  if (!title) {
    showToast("请输入任务名称");
    return null;
  }

  const data = getData();
  const now = new Date().toISOString();
  const existingIndex = existingTaskId
    ? data.tasks.findIndex((task) => task.id === existingTaskId)
    : -1;

  const current = existingIndex >= 0 ? normalizeTask(data.tasks[existingIndex]) : null;
  const status = ["pending", "inProgress", "completed"].includes(taskInput.status)
    ? taskInput.status
    : current?.status || "pending";

  const task = normalizeTask({
    ...current,
    ...taskInput,
    id: current?.id || createId(),
    title,
    dueDate: taskInput.dueDate || null,
    goalId: taskInput.goalId || null,
    status,
    createdAt: current?.createdAt || now,
    completedAt: status === "completed" ? (current?.completedAt || now) : null
  });

  if (existingIndex >= 0) {
    data.tasks[existingIndex] = task;
  } else {
    data.tasks.push(task);
  }

  saveData();
  return task;
}

export function setTaskCompleted(taskId, completed) {
  const data = getData();
  const task = data.tasks.find((item) => item.id === taskId);
  if (!task) return null;

  task.status = completed ? "completed" : "pending";
  task.completedAt = completed ? new Date().toISOString() : null;
  saveData();
  return normalizeTask(task);
}

export function deleteTask(taskId) {
  const data = getData();
  const index = data.tasks.findIndex((task) => task.id === taskId);
  if (index < 0) return false;

  data.tasks.splice(index, 1);
  saveData();
  return true;
}

function getTodayString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getGoalName(goalId) {
  if (!goalId) return "未关联目标";
  const goal = getData().goals.find((item) => item.id === goalId);
  return goal?.title || goal?.name || "目标不存在";
}

function getDisplayGroups(tasks) {
  const today = getTodayString();
  const incomplete = tasks.filter((task) => task.status !== "completed");

  return {
    must: incomplete.filter((task) => task.dueDate === today),
    important: incomplete.filter((task) => task.dueDate !== today && ["P1", "P2"].includes(task.priority)),
    ifTime: incomplete.filter((task) => task.dueDate !== today && task.priority === "P3")
  };
}

function renderTaskRows(tasks) {
  if (!tasks.length) {
    return '<div class="empty-state">暂无任务</div>';
  }

  return `
    <div class="task-list">
      ${tasks.map((task) => `
        <article class="task-item ${task.status === "completed" ? "is-completed" : ""}">
          <div class="task-main">
            <div class="task-title-row">
              <h3>${escapeHtml(task.title)}</h3>
              <span class="badge badge-${task.priority.toLowerCase()}">${task.priority}</span>
            </div>
            ${task.description ? `<p class="task-description">${escapeHtml(task.description)}</p>` : ""}
            <div class="task-meta">
              <span>状态：${STATUS_LABELS[task.status]}</span>
              <span>截止：${formatDate(task.dueDate)}</span>
              <span>目标：${escapeHtml(getGoalName(task.goalId))}</span>
            </div>
          </div>
          <div class="task-actions">
            <button class="btn btn-small" type="button" data-task-action="toggle" data-task-id="${escapeHtml(task.id)}">
              ${task.status === "completed" ? "取消完成" : "完成"}
            </button>
            <button class="btn btn-small" type="button" data-task-action="edit" data-task-id="${escapeHtml(task.id)}">编辑</button>
            <button class="btn btn-small btn-danger" type="button" data-task-action="delete" data-task-id="${escapeHtml(task.id)}">删除</button>
          </div>
        </article>
      `).join("")}
    </div>
  `;
}

function renderGoalOptions(selectedGoalId = "") {
  const goals = getData().goals || [];
  return `
    <option value="">不关联目标</option>
    ${goals.map((goal) => {
      const id = escapeHtml(goal.id);
      const title = escapeHtml(goal.title || goal.name || "未命名目标");
      const selected = goal.id === selectedGoalId ? "selected" : "";
      return `<option value="${id}" ${selected}>${title}</option>`;
    }).join("")}
  `;
}

function openTaskModal(task = null) {
  const isEdit = Boolean(task);

  openModal(`
    <div class="modal-header">
      <div>
        <h2>${isEdit ? "编辑任务" : "新增任务"}</h2>
        <p class="modal-subtitle">任务只保存业务字段，首页分类由系统动态计算。</p>
      </div>
      <button class="icon-button" type="button" data-close-modal aria-label="关闭">×</button>
    </div>
    <form id="task-form" class="form-grid">
      <label>
        <span>任务名称 *</span>
        <input name="title" type="text" maxlength="100" required value="${escapeHtml(task?.title || "")}" />
      </label>
      <label>
        <span>说明</span>
        <textarea name="description" rows="3" maxlength="500">${escapeHtml(task?.description || "")}</textarea>
      </label>
      <div class="form-row">
        <label>
          <span>优先级</span>
          <select name="priority">
            ${["P1", "P2", "P3"].map((priority) => `
              <option value="${priority}" ${task?.priority === priority || (!task && priority === "P2") ? "selected" : ""}>${priority}</option>
            `).join("")}
          </select>
        </label>
        <label>
          <span>截止日期</span>
          <input name="dueDate" type="date" value="${escapeHtml(task?.dueDate || "")}" />
        </label>
      </div>
      <div class="form-row">
        <label>
          <span>状态</span>
          <select name="status">
            ${Object.entries(STATUS_LABELS).map(([value, label]) => `
              <option value="${value}" ${task?.status === value || (!task && value === "pending") ? "selected" : ""}>${label}</option>
            `).join("")}
          </select>
        </label>
        <label>
          <span>关联目标</span>
          <select name="goalId">${renderGoalOptions(task?.goalId || "")}</select>
        </label>
      </div>
      <div class="form-actions">
        <button class="btn" type="button" data-close-modal>取消</button>
        <button class="btn btn-primary" type="submit">保存任务</button>
      </div>
    </form>
  `);

  const form = document.getElementById("task-form");
  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const saved = saveTask(Object.fromEntries(formData.entries()), task?.id || null);
    if (!saved) return;

    closeModal();
    renderTasksPage();
    showToast(isEdit ? "任务已更新" : "任务已新增");
  });

  document.querySelectorAll("[data-close-modal]").forEach((button) => {
    button.addEventListener("click", closeModal);
  });
}

function bindTaskActions() {
  document.querySelectorAll("[data-task-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const taskId = button.dataset.taskId;
      const action = button.dataset.taskAction;
      const task = getTaskById(taskId);
      if (!task) return;

      if (action === "toggle") {
        setTaskCompleted(taskId, task.status !== "completed");
        renderTasksPage();
        showToast(task.status === "completed" ? "任务已取消完成" : "任务已完成");
        return;
      }

      if (action === "edit") {
        openTaskModal(normalizeTask(task));
        return;
      }

      if (action === "delete") {
        const confirmed = window.confirm(`确定删除任务“${task.title}”吗？此操作无法撤销。`);
        if (!confirmed) return;
        deleteTask(taskId);
        renderTasksPage();
        showToast("任务已删除");
      }
    });
  });
}

export function renderTasksPage() {
  const container = document.getElementById("page-content");
  if (!container) return;

  const tasks = getTasks();
  container.innerHTML = `
    <div class="page-heading-row">
      <div>
        <h1 class="page-title">任务 / Tasks</h1>
        <p class="page-subtitle">管理任务、截止日期、优先级和目标关联。</p>
      </div>
      <button id="add-task-button" class="btn btn-primary" type="button">新增任务</button>
    </div>
    <div class="card task-card">
      <div class="section-header">
        <h2>任务列表</h2>
        <span class="muted">共 ${tasks.length} 项</span>
      </div>
      ${renderTaskRows(tasks)}
    </div>
  `;

  document.getElementById("add-task-button")?.addEventListener("click", () => openTaskModal());
  bindTaskActions();
}

export function renderDashboardTasks() {
  const tasks = getTasks();
  const incomplete = tasks.filter((task) => task.status !== "completed");
  const today = getTodayString();
  const topTasks = incomplete.slice(0, 5);

  const now = new Date();
  const configuredStart = Number(getData().settings?.weekStartsOn) === 0 ? 0 : 1;
  const day = now.getDay();
  const diffToWeekStart = (day - configuredStart + 7) % 7;
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diffToWeekStart);
  const weekEnd = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 6);
  const toDateString = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const weekStartString = toDateString(weekStart);
  const weekEndString = toDateString(weekEnd);
  const weekTasks = incomplete.filter((task) => task.dueDate && task.dueDate >= weekStartString && task.dueDate <= weekEndString);

  const upcoming = incomplete
    .filter((task) => task.dueDate && task.dueDate >= today)
    .slice(0, 5);

  const renderCompact = (items, emptyText = "暂无任务") => items.length
    ? `<ul class="compact-task-list">${items.map((task) => `
        <li>
          <span>${escapeHtml(task.title)}</span>
          <span class="badge badge-${task.priority.toLowerCase()}">${task.priority}</span>
        </li>
      `).join("")}</ul>`
    : `<div class="empty-state">${emptyText}</div>`;

  return `
    <section class="card dashboard-task-card">
      <div class="section-header">
        <div>
          <h2>今天</h2>
          <p class="muted">${incomplete.length ? `共 ${incomplete.length} 项未完成任务，首页最多显示 5 项。` : "今天没有待完成任务。"}</p>
        </div>
        <a class="text-link" href="#/tasks">查看全部</a>
      </div>
      ${renderCompact(topTasks)}
    </section>

    <section class="card dashboard-task-week-card">
      <div class="section-header">
        <div>
          <h2>本周</h2>
          <p class="muted">${weekStartString} ～ ${weekEndString}</p>
        </div>
        <a class="text-link" href="#/tasks">任务管理</a>
      </div>
      ${renderCompact(weekTasks, "本周暂时没有设置截止日期的任务")}
    </section>

    <section class="card dashboard-upcoming-card">
      <div class="section-header">
        <div>
          <h2>即将到期</h2>
          <p class="muted">按截止日期显示近期未完成任务。</p>
        </div>
      </div>
      ${renderCompact(upcoming, "近期没有设置截止日期的未完成任务")}
    </section>
  `;
}
