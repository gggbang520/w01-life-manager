import { getData, saveData } from "./store.js";
import { closeModal, openModal, showToast } from "./ui.js";

export const DEFAULT_SETTINGS = {
  nickname: "",
  currency: "CNY",
  weekStartsOn: 1
};

const DATA_VERSION = "1.0";

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function normalizeSettings(settings = {}) {
  const source = settings && typeof settings === "object" && !Array.isArray(settings) ? settings : {};
  return {
    nickname: typeof source.nickname === "string" ? source.nickname.trim() : "",
    currency: source.currency === "CNY" ? "CNY" : "CNY",
    weekStartsOn: Number(source.weekStartsOn) === 0 ? 0 : 1
  };
}

export function getSettings() {
  const data = getData();
  data.settings = normalizeSettings(data.settings);
  return data.settings;
}

export function saveSettings(input) {
  const data = getData();
  data.settings = normalizeSettings(input);
  saveData();
  return data.settings;
}

function getDataSummary() {
  const data = getData();
  return {
    tasks: Array.isArray(data.tasks) ? data.tasks.length : 0,
    goals: Array.isArray(data.goals) ? data.goals.length : 0,
    budgets: Array.isArray(data.budgets) ? data.budgets.length : 0,
    transactions: Array.isArray(data.transactions) ? data.transactions.length : 0,
    reviews: Array.isArray(data.reviews) ? data.reviews.length : 0
  };
}

export function createExportData() {
  const data = getData();
  return {
    version: DATA_VERSION,
    exportedAt: new Date().toISOString(),
    tasks: Array.isArray(data.tasks) ? data.tasks : [],
    goals: Array.isArray(data.goals) ? data.goals : [],
    budgets: Array.isArray(data.budgets) ? data.budgets : [],
    transactions: Array.isArray(data.transactions) ? data.transactions : [],
    reviews: Array.isArray(data.reviews) ? data.reviews : [],
    settings: normalizeSettings(data.settings)
  };
}

export function validateImportData(parsed) {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("文件格式不正确");
  }

  const arrayFields = ["tasks", "goals", "budgets", "transactions", "reviews"];
  for (const field of arrayFields) {
    if (Object.prototype.hasOwnProperty.call(parsed, field) && !Array.isArray(parsed[field])) {
      throw new Error("文件格式不正确");
    }
  }

  if (Object.prototype.hasOwnProperty.call(parsed, "settings") &&
      (!parsed.settings || typeof parsed.settings !== "object" || Array.isArray(parsed.settings))) {
    throw new Error("文件格式不正确");
  }

  const goals = Array.isArray(parsed.goals) ? parsed.goals : [];
  const goalIds = new Set(goals.map((goal) => goal?.id).filter(Boolean));
  const tasks = (Array.isArray(parsed.tasks) ? parsed.tasks : []).map((task) => {
    if (!task || typeof task !== "object") return task;
    return {
      ...task,
      goalId: task.goalId && goalIds.has(task.goalId) ? task.goalId : null
    };
  });

  return {
    version: DATA_VERSION,
    tasks,
    goals,
    budgets: Array.isArray(parsed.budgets) ? parsed.budgets : [],
    transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
    reviews: Array.isArray(parsed.reviews) ? parsed.reviews : [],
    settings: normalizeSettings(parsed.settings)
  };
}

export function importData(parsed) {
  const normalized = validateImportData(parsed);
  const data = getData();
  data.version = normalized.version;
  data.tasks = normalized.tasks;
  data.goals = normalized.goals;
  data.budgets = normalized.budgets;
  data.transactions = normalized.transactions;
  data.reviews = normalized.reviews;
  data.settings = normalized.settings;
  saveData();
  return data;
}

export function resetAllData() {
  const data = getData();
  data.version = DATA_VERSION;
  data.tasks = [];
  data.goals = [];
  data.budgets = [];
  data.transactions = [];
  data.reviews = [];
  data.settings = { ...DEFAULT_SETTINGS };
  saveData();
  return data;
}

function downloadExport() {
  const payload = JSON.stringify(createExportData(), null, 2);
  const blob = new Blob([payload], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const date = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  const filename = `lifeManager-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.json`;
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showToast("数据已导出");
}

function parseImportFile(file) {
  return file.text().then((text) => {
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (error) {
      throw new Error("文件格式不正确");
    }
    return validateImportData(parsed);
  });
}

function confirmImport(normalized) {
  const data = getData();
  const hasCurrentData = [data.tasks, data.goals, data.budgets, data.transactions, data.reviews]
    .some((items) => Array.isArray(items) && items.length > 0) ||
    Object.values(normalizeSettings(data.settings)).some((value) => value !== "" && value !== "CNY" && value !== 1);

  if (!hasCurrentData) {
    importData(normalized);
    renderSettingsPage();
    showToast("数据导入成功");
    return;
  }

  openModal(`
    <div class="modal-header">
      <div>
        <h2>确认导入</h2>
        <p class="modal-subtitle">导入将覆盖当前本地数据。</p>
      </div>
      <button class="icon-button" type="button" data-close-import aria-label="关闭">×</button>
    </div>
    <div class="danger-notice">确定要导入这份数据吗？<br><br>导入将覆盖当前本地数据。</div>
    <div class="form-actions">
      <button class="btn" type="button" data-close-import>取消</button>
      <button class="btn btn-primary" type="button" data-confirm-import>确认导入</button>
    </div>
  `);

  document.querySelectorAll("[data-close-import]").forEach((button) => button.addEventListener("click", closeModal));
  document.querySelector("[data-confirm-import]")?.addEventListener("click", () => {
    importData(normalized);
    closeModal();
    renderSettingsPage();
    showToast("数据导入成功");
  });
}

function handleImportFile(file) {
  if (!file) return;
  parseImportFile(file)
    .then(confirmImport)
    .catch(() => showToast("导入失败：文件格式不正确"));
}

function confirmResetStepTwo() {
  openModal(`
    <div class="modal-header">
      <div>
        <h2>再次确认</h2>
        <p class="modal-subtitle">确认清空全部本地数据？</p>
      </div>
      <button class="icon-button" type="button" data-close-reset aria-label="关闭">×</button>
    </div>
    <div class="danger-notice">此操作会删除当前浏览器中的任务、目标、预算、收支、复盘和设置。</div>
    <div class="form-actions">
      <button class="btn" type="button" data-close-reset>取消</button>
      <button class="btn btn-danger-solid" type="button" data-confirm-reset>确认清空</button>
    </div>
  `);

  document.querySelectorAll("[data-close-reset]").forEach((button) => button.addEventListener("click", closeModal));
  document.querySelector("[data-confirm-reset]")?.addEventListener("click", () => {
    resetAllData();
    closeModal();
    renderSettingsPage();
    showToast("全部数据已清空");
  });
}

function confirmResetStepOne() {
  openModal(`
    <div class="modal-header">
      <div>
        <h2>清空全部数据</h2>
        <p class="modal-subtitle">这是高风险操作。</p>
      </div>
      <button class="icon-button" type="button" data-close-reset aria-label="关闭">×</button>
    </div>
    <div class="danger-notice">确定要清空全部数据吗？<br><br>这将删除：任务、目标、预算、收支、复盘和设置。<br><br>此操作无法从当前浏览器直接恢复。</div>
    <div class="form-actions">
      <button class="btn" type="button" data-close-reset>取消</button>
      <button class="btn btn-danger-solid" type="button" data-continue-reset>继续</button>
    </div>
  `);

  document.querySelectorAll("[data-close-reset]").forEach((button) => button.addEventListener("click", closeModal));
  document.querySelector("[data-continue-reset]")?.addEventListener("click", confirmResetStepTwo);
}

function renderSettingsForm(settings) {
  return `
    <section class="card settings-card">
      <div class="section-header">
        <div>
          <h2>个人设置</h2>
          <p class="muted">只保存基础个人偏好。</p>
        </div>
      </div>
      <form id="settings-form" class="form-grid">
        <label>
          <span>昵称</span>
          <input name="nickname" type="text" maxlength="50" value="${escapeHtml(settings.nickname)}" placeholder="可为空" />
        </label>
        <label>
          <span>货币</span>
          <select name="currency">
            <option value="CNY" selected>CNY（人民币）</option>
          </select>
        </label>
        <label>
          <span>每周开始日</span>
          <select name="weekStartsOn">
            <option value="1" ${settings.weekStartsOn === 1 ? "selected" : ""}>周一</option>
            <option value="0" ${settings.weekStartsOn === 0 ? "selected" : ""}>周日</option>
          </select>
        </label>
        <div class="form-actions">
          <button class="btn btn-primary" type="submit">保存设置</button>
        </div>
      </form>
    </section>
  `;
}

export function renderSettingsPage() {
  const container = document.getElementById("page-content");
  if (!container) return;

  const settings = getSettings();
  const summary = getDataSummary();

  container.innerHTML = `
    <div>
      <h1 class="page-title">设置</h1>
      <p class="page-subtitle">管理基础个人偏好和本地数据。</p>
    </div>
    ${renderSettingsForm(settings)}
    <section class="card settings-card">
      <div class="section-header">
        <div>
          <h2>数据管理</h2>
          <p class="muted">数据仅保存在当前浏览器的 Local Storage。</p>
        </div>
      </div>
      <div class="settings-actions">
        <button id="export-data-button" class="btn" type="button">导出数据</button>
        <button id="import-data-button" class="btn" type="button">导入数据</button>
        <button id="reset-data-button" class="btn btn-danger" type="button">清空全部数据</button>
      </div>
      <input id="import-data-input" class="visually-hidden" type="file" accept=".json,application/json" />
      <div class="data-summary">
        <div><span>任务</span><strong>${summary.tasks}</strong></div>
        <div><span>目标</span><strong>${summary.goals}</strong></div>
        <div><span>预算记录</span><strong>${summary.budgets}</strong></div>
        <div><span>收支记录</span><strong>${summary.transactions}</strong></div>
        <div><span>复盘记录</span><strong>${summary.reviews}</strong></div>
        <div><span>数据版本</span><strong>${escapeHtml(getData().version || DATA_VERSION)}</strong></div>
      </div>
    </section>
    <section class="card settings-card settings-about">
      <div class="section-header">
        <div>
          <h2>关于</h2>
        </div>
      </div>
      <p><strong>W01｜生活管理网站</strong></p>
      <p class="muted">版本：V1.0</p>
      <p class="muted">本网站为个人本地生活管理工具。当前数据仅保存在浏览器 Local Storage。</p>
    </section>
  `;

  document.getElementById("settings-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const saved = saveSettings(Object.fromEntries(new FormData(form).entries()));
    renderSettingsPage();
    showToast("设置已保存");
    return saved;
  });

  document.getElementById("export-data-button")?.addEventListener("click", downloadExport);
  document.getElementById("import-data-button")?.addEventListener("click", () => {
    document.getElementById("import-data-input")?.click();
  });
  document.getElementById("import-data-input")?.addEventListener("change", (event) => {
    handleImportFile(event.target.files?.[0]);
    event.target.value = "";
  });
  document.getElementById("reset-data-button")?.addEventListener("click", confirmResetStepOne);
}

export const settingsTestApi = {
  getSettings,
  saveSettings,
  createExportData,
  validateImportData,
  importData,
  resetAllData,
  getDataSummary
};
