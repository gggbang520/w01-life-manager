import { loadData } from "./store.js";
import { initRouter, navigateTo } from "./router.js";
import { initUI, updateNavigation, showToast } from "./ui.js";
import { renderTasksPage, renderDashboardTasks } from "./tasks.js";
import { renderGoalsPage, renderDashboardGoals } from "./goals.js";
import { renderBudgetPage, renderDashboardBudget } from "./budget.js";
import { renderReviewsPage, renderDashboardReviews } from "./reviews.js";
import { renderSettingsPage } from "./settings.js";

function renderDashboard() {
  const container = document.getElementById("page-content");
  if (!container) return;

  container.innerHTML = `
    <div>
      <h1 class="page-title">首页</h1>
      <p class="page-subtitle">今天、本周、长期目标、预算和最近复盘的统一概览。</p>
    </div>
    ${renderDashboardTasks()}
    ${renderDashboardGoals()}
    ${renderDashboardBudget()}
    ${renderDashboardReviews()}
  `;
}

function renderPage(route) {
  const pages = {
    dashboard: renderDashboard,
    tasks: renderTasksPage,
    goals: renderGoalsPage,
    budget: renderBudgetPage,
    reviews: renderReviewsPage,
    settings: renderSettingsPage
  };

  (pages[route] || renderDashboard)();
}

function handleRuntimeError(event) {
  const error = event.error;
  if (error?.name !== "StorageError") return;
  event.preventDefault();
  showToast(error.message);
}

function handleUnhandledRejection(event) {
  const error = event.reason;
  if (error?.name !== "StorageError") return;
  event.preventDefault();
  showToast(error.message);
}

function startApp() {
  initUI({ onNavigate: navigateTo });
  window.addEventListener("error", handleRuntimeError);
  window.addEventListener("unhandledrejection", handleUnhandledRejection);

  try {
    loadData();
  } catch (error) {
    if (error?.name !== "StorageError") {
      showToast(error.message || "本地数据读取失败。");
    } else {
      showToast(error.message);
    }
  }

  initRouter({
    onRouteChange: renderPage,
    onNavigationUpdate: updateNavigation
  });
}

startApp();
