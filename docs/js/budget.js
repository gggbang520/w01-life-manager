import { getData, saveData } from "./store.js";
import { closeModal, openModal, showToast } from "./ui.js";

const EXPENSE_CATEGORIES = ["饮食", "交通", "学习", "居住", "娱乐", "购物", "医疗", "其他"];
const INCOME_CATEGORIES = ["生活费", "奖学金", "兼职", "其他"];
const TRANSACTION_TYPES = ["income", "expense"];

const TYPE_LABELS = {
  income: "收入",
  expense: "支出"
};

function createId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function getTodayString() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function getCurrentMonth() {
  return getTodayString().slice(0, 7);
}

function isValidMonth(value) {
  if (!/^\d{4}-\d{2}$/.test(value)) return false;
  const [year, month] = value.split("-").map(Number);
  return month >= 1 && month <= 12 && year >= 1 && year <= 9999;
}

export function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function normalizeMoney(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) return null;
  return Math.round(amount * 100) / 100;
}

function normalizePositiveMoney(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return Math.round(amount * 100) / 100;
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getCurrencySymbol() {
  const currency = getData().settings?.currency;
  return currency === "CNY" ? "¥" : "¥";
}

function formatAmount(amount) {
  return `${getCurrencySymbol()}${Number(amount).toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

function formatDate(dateString) {
  if (!dateString) return "未设置";
  return dateString;
}

function normalizeBudget(budget) {
  return {
    id: String(budget.id || createId("budget")),
    month: String(budget.month || ""),
    amount: normalizeMoney(budget.amount) ?? 0,
    createdAt: budget.createdAt || new Date().toISOString(),
    updatedAt: budget.updatedAt || budget.createdAt || new Date().toISOString()
  };
}

function normalizeTransaction(transaction) {
  const amount = normalizePositiveMoney(transaction.amount);
  return {
    id: String(transaction.id || createId("transaction")),
    type: TRANSACTION_TYPES.includes(transaction.type) ? transaction.type : "expense",
    amount: amount ?? 0,
    category: String(transaction.category || "").trim(),
    date: String(transaction.date || ""),
    note: String(transaction.note || "").trim(),
    createdAt: transaction.createdAt || new Date().toISOString(),
    updatedAt: transaction.updatedAt || transaction.createdAt || new Date().toISOString()
  };
}

export function getBudgets() {
  return [...getData().budgets]
    .map(normalizeBudget)
    .filter((budget) => isValidMonth(budget.month));
}

export function getTransactions() {
  return [...getData().transactions]
    .map(normalizeTransaction)
    .filter((transaction) => isValidDate(transaction.date) && transaction.amount > 0)
    .sort((a, b) => {
      const dateComparison = b.date.localeCompare(a.date);
      if (dateComparison !== 0) return dateComparison;
      return String(b.createdAt).localeCompare(String(a.createdAt));
    });
}

export function getBudgetForMonth(month = getCurrentMonth()) {
  return getBudgets().find((budget) => budget.month === month) || null;
}

export function saveBudget(input, existingBudgetId = null) {
  const month = String(input.month || "").trim();
  if (!isValidMonth(month)) {
    showToast("请输入有效月份（YYYY-MM）");
    return null;
  }

  if (String(input.amount ?? "").trim() === "") {
    showToast("请输入预算金额");
    return null;
  }

  const amount = normalizeMoney(input.amount);
  if (amount === null) {
    showToast("预算金额必须是大于等于 0 的有效数字");
    return null;
  }

  const data = getData();
  const existingById = existingBudgetId
    ? data.budgets.findIndex((budget) => budget.id === existingBudgetId)
    : -1;
  const existingByMonth = data.budgets.findIndex((budget) => budget.month === month);

  if (existingByMonth >= 0 && existingByMonth !== existingById) {
    const existing = normalizeBudget(data.budgets[existingByMonth]);
    existing.amount = amount;
    existing.updatedAt = new Date().toISOString();
    data.budgets[existingByMonth] = existing;
    saveData();
    return existing;
  }

  const now = new Date().toISOString();
  const current = existingById >= 0 ? normalizeBudget(data.budgets[existingById]) : null;
  const budget = {
    id: current?.id || createId("budget"),
    month,
    amount,
    createdAt: current?.createdAt || now,
    updatedAt: now
  };

  if (existingById >= 0) data.budgets[existingById] = budget;
  else data.budgets.push(budget);

  saveData();
  return budget;
}

export function saveTransaction(input, existingTransactionId = null) {
  const type = String(input.type || "");
  if (!TRANSACTION_TYPES.includes(type)) {
    showToast("请选择有效的收支类型");
    return null;
  }

  const amount = normalizePositiveMoney(input.amount);
  if (amount === null) {
    showToast("金额必须是大于 0 的有效数字");
    return null;
  }

  const category = String(input.category || "").trim();
  if (!category) {
    showToast("请选择分类");
    return null;
  }

  const allowedCategories = type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  if (!allowedCategories.includes(category)) {
    showToast("请选择当前类型对应的有效分类");
    return null;
  }

  const date = String(input.date || "").trim();
  if (!isValidDate(date)) {
    showToast("请输入有效日期（YYYY-MM-DD）");
    return null;
  }

  const data = getData();
  const existingIndex = existingTransactionId
    ? data.transactions.findIndex((transaction) => transaction.id === existingTransactionId)
    : -1;
  const current = existingIndex >= 0 ? normalizeTransaction(data.transactions[existingIndex]) : null;
  const now = new Date().toISOString();

  const transaction = {
    id: current?.id || createId("transaction"),
    type,
    amount,
    category,
    date,
    note: String(input.note || "").trim(),
    createdAt: current?.createdAt || now,
    updatedAt: now
  };

  if (existingIndex >= 0) data.transactions[existingIndex] = transaction;
  else data.transactions.push(transaction);

  saveData();
  return transaction;
}

export function deleteTransaction(transactionId) {
  const data = getData();
  const index = data.transactions.findIndex((transaction) => transaction.id === transactionId);
  if (index < 0) return false;
  data.transactions.splice(index, 1);
  saveData();
  return true;
}

export function calculateMonthlyStats(month = getCurrentMonth()) {
  const budget = getBudgetForMonth(month);
  const transactions = getTransactions().filter((transaction) => transaction.date.slice(0, 7) === month);
  const income = transactions
    .filter((transaction) => transaction.type === "income")
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const expense = transactions
    .filter((transaction) => transaction.type === "expense")
    .reduce((sum, transaction) => sum + transaction.amount, 0);

  return {
    budget,
    income: Math.round(income * 100) / 100,
    expense: Math.round(expense * 100) / 100,
    remaining: budget ? Math.round((budget.amount - expense) * 100) / 100 : null,
    balance: Math.round((income - expense) * 100) / 100
  };
}

function renderCategoryOptions(type, selectedCategory = "") {
  const categories = type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  return categories.map((category) => `
    <option value="${escapeHtml(category)}" ${category === selectedCategory ? "selected" : ""}>${escapeHtml(category)}</option>
  `).join("");
}

function openBudgetModal(budget = null) {
  const month = budget?.month || getCurrentMonth();
  openModal(`
    <div class="modal-header">
      <div>
        <h2>${budget ? "修改月度预算" : "设置月度预算"}</h2>
        <p class="modal-subtitle">每个月只维护一条计划预算。</p>
      </div>
      <button class="icon-button" type="button" data-close-modal aria-label="关闭">×</button>
    </div>
    <form id="budget-form" class="form-grid">
      <label>
        <span>月份</span>
        <input name="month" type="month" required value="${escapeHtml(month)}" />
      </label>
      <label>
        <span>预算金额</span>
        <input name="amount" type="number" min="0" step="0.01" required value="${budget?.amount ?? ""}" />
      </label>
      <div class="form-actions">
        <button class="btn" type="button" data-close-modal>取消</button>
        <button class="btn btn-primary" type="submit">保存预算</button>
      </div>
    </form>
  `);

  const form = document.getElementById("budget-form");
  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    const saved = saveBudget(Object.fromEntries(new FormData(form).entries()), budget?.id || null);
    if (!saved) return;
    closeModal();
    renderBudgetPage();
    showToast("预算已保存");
  });

  document.querySelectorAll("[data-close-modal]").forEach((button) => button.addEventListener("click", closeModal));
}

function openTransactionModal(transaction = null) {
  const isEdit = Boolean(transaction);
  const type = transaction?.type || "expense";

  openModal(`
    <div class="modal-header">
      <div>
        <h2>${isEdit ? "编辑收支记录" : "新增收支记录"}</h2>
        <p class="modal-subtitle">收入和支出使用统一记录结构。</p>
      </div>
      <button class="icon-button" type="button" data-close-modal aria-label="关闭">×</button>
    </div>
    <form id="transaction-form" class="form-grid">
      <div class="form-row">
        <label>
          <span>类型</span>
          <select id="transaction-type" name="type">
            <option value="expense" ${type === "expense" ? "selected" : ""}>支出</option>
            <option value="income" ${type === "income" ? "selected" : ""}>收入</option>
          </select>
        </label>
        <label>
          <span>金额</span>
          <input name="amount" type="number" min="0.01" step="0.01" required value="${transaction?.amount ?? ""}" />
        </label>
      </div>
      <div class="form-row">
        <label>
          <span>分类</span>
          <select id="transaction-category" name="category" required>
            ${renderCategoryOptions(type, transaction?.category || "")}
          </select>
        </label>
        <label>
          <span>日期</span>
          <input name="date" type="date" required value="${escapeHtml(transaction?.date || getTodayString())}" />
        </label>
      </div>
      <label>
        <span>备注</span>
        <input name="note" type="text" maxlength="200" value="${escapeHtml(transaction?.note || "")}" />
      </label>
      <div class="form-actions">
        <button class="btn" type="button" data-close-modal>取消</button>
        <button class="btn btn-primary" type="submit">保存记录</button>
      </div>
    </form>
  `);

  const form = document.getElementById("transaction-form");
  const typeSelect = document.getElementById("transaction-type");
  const categorySelect = document.getElementById("transaction-category");
  typeSelect?.addEventListener("change", () => {
    categorySelect.innerHTML = renderCategoryOptions(typeSelect.value);
  });

  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    const saved = saveTransaction(Object.fromEntries(new FormData(form).entries()), transaction?.id || null);
    if (!saved) return;
    closeModal();
    renderBudgetPage();
    showToast(isEdit ? "收支记录已更新" : "收支记录已新增");
  });

  document.querySelectorAll("[data-close-modal]").forEach((button) => button.addEventListener("click", closeModal));
}

function renderTransactionRows(transactions) {
  if (!transactions.length) return '<div class="empty-state">暂无收支记录</div>';
  return `
    <div class="transaction-list">
      ${transactions.map((transaction) => `
        <article class="transaction-item">
          <div class="transaction-main">
            <div class="transaction-title-row">
              <strong>${escapeHtml(transaction.category)}</strong>
              <span class="status-badge ${transaction.type === "income" ? "budget-income" : "budget-expense"}">${TYPE_LABELS[transaction.type]}</span>
            </div>
            <div class="transaction-meta">
              <span>${formatDate(transaction.date)}</span>
              ${transaction.note ? `<span>${escapeHtml(transaction.note)}</span>` : ""}
            </div>
          </div>
          <div class="transaction-amount ${transaction.type === "income" ? "amount-income" : "amount-expense"}">${formatAmount(transaction.amount)}</div>
          <div class="transaction-actions">
            <button class="btn btn-small" type="button" data-transaction-action="edit" data-transaction-id="${escapeHtml(transaction.id)}">编辑</button>
            <button class="btn btn-small btn-danger" type="button" data-transaction-action="delete" data-transaction-id="${escapeHtml(transaction.id)}">删除</button>
          </div>
        </article>
      `).join("")}
    </div>
  `;
}

function bindTransactionActions() {
  document.querySelectorAll("[data-transaction-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.transactionId;
      const transaction = getData().transactions.find((item) => item.id === id);
      if (!transaction) return;
      const normalized = normalizeTransaction(transaction);

      if (button.dataset.transactionAction === "edit") {
        openTransactionModal(normalized);
        return;
      }

      if (button.dataset.transactionAction === "delete") {
        if (!window.confirm(`确定删除 ${TYPE_LABELS[normalized.type]}“${normalized.category}” ${formatAmount(normalized.amount)} 的记录吗？`)) return;
        deleteTransaction(id);
        renderBudgetPage();
        showToast("收支记录已删除");
      }
    });
  });
}

export function renderBudgetPage() {
  const container = document.getElementById("page-content");
  if (!container) return;

  const month = getCurrentMonth();
  const stats = calculateMonthlyStats(month);
  const transactions = getTransactions().filter((transaction) => transaction.date.slice(0, 7) === month);

  container.innerHTML = `
    <div class="page-heading-row">
      <div>
        <h1 class="page-title">预算 / Budget</h1>
        <p class="page-subtitle">当前月份：${month}</p>
      </div>
      <div class="page-heading-actions">
        <button id="budget-setting-button" class="btn btn-primary" type="button">${stats.budget ? "修改本月预算" : "设置本月预算"}</button>
        <button id="add-transaction-button" class="btn" type="button">新增收支</button>
      </div>
    </div>

    <section class="budget-summary-grid">
      <div class="card budget-stat"><span>本月预算</span><strong>${stats.budget ? formatAmount(stats.budget.amount) : "未设置"}</strong></div>
      <div class="card budget-stat"><span>本月收入</span><strong>${formatAmount(stats.income)}</strong></div>
      <div class="card budget-stat"><span>本月支出</span><strong>${formatAmount(stats.expense)}</strong></div>
      <div class="card budget-stat"><span>预算剩余</span><strong>${stats.remaining === null ? "—" : formatAmount(stats.remaining)}</strong></div>
    </section>

    <section class="card budget-card">
      <div class="section-header">
        <div>
          <h2>月度预算</h2>
          <p class="muted">Budget 是计划金额，Transaction 是实际发生记录。</p>
        </div>
      </div>
      ${stats.budget ? `<p>本月计划预算：<strong>${formatAmount(stats.budget.amount)}</strong></p>` : '<div class="empty-state">本月尚未设置预算</div>'}
      <div class="budget-balance-line">本月结余：<strong>${formatAmount(stats.balance)}</strong></div>
    </section>

    <section class="card budget-card">
      <div class="section-header">
        <div>
          <h2>本月收支记录</h2>
          <p class="muted">按日期从近到远排列。</p>
        </div>
        <span class="muted">共 ${transactions.length} 条</span>
      </div>
      ${renderTransactionRows(transactions)}
    </section>
  `;

  document.getElementById("budget-setting-button")?.addEventListener("click", () => openBudgetModal(stats.budget));
  document.getElementById("add-transaction-button")?.addEventListener("click", () => openTransactionModal());
  bindTransactionActions();
}

export function renderDashboardBudget() {
  const stats = calculateMonthlyStats();
  return `
    <section class="card dashboard-budget-card">
      <div class="section-header">
        <div>
          <h2>本月预算</h2>
          <p class="muted">只显示基础预算信息。</p>
        </div>
        <a class="text-link" href="#/budget">进入预算</a>
      </div>
      <div class="dashboard-budget-stats">
        <div><span>预算</span><strong>${stats.budget ? formatAmount(stats.budget.amount) : "未设置"}</strong></div>
        <div><span>支出</span><strong>${formatAmount(stats.expense)}</strong></div>
        <div><span>剩余</span><strong>${stats.remaining === null ? "—" : formatAmount(stats.remaining)}</strong></div>
      </div>
    </section>
  `;
}

export const budgetCategories = {
  expense: [...EXPENSE_CATEGORIES],
  income: [...INCOME_CATEGORIES]
};
