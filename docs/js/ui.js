const DESKTOP_NAV_ITEMS = [
  ["dashboard", "首页"],
  ["tasks", "任务"],
  ["goals", "目标"],
  ["budget", "预算"],
  ["reviews", "复盘"],
  ["settings", "设置"]
];

const MOBILE_NAV_ITEMS = [
  ["dashboard", "首页"],
  ["tasks", "任务"],
  ["goals", "目标"],
  ["budget", "预算"]
];

export function initUI({ onNavigate }) {
  renderNavigation("desktop-nav", DESKTOP_NAV_ITEMS, onNavigate);
  renderNavigation("mobile-nav", MOBILE_NAV_ITEMS, onNavigate, true);
  renderMoreButton(onNavigate);
}

function renderNavigation(containerId, items, onNavigate, mobile = false) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = items.map(([route, label]) => `
    <button class="nav-item" type="button" data-route="${route}">${label}</button>
  `).join("");

  container.addEventListener("click", (event) => {
    const button = event.target.closest("[data-route]");
    if (!button) return;
    onNavigate(button.dataset.route);
  });

  if (mobile) {
    container.setAttribute("aria-label", "移动端主导航");
  }
}

function renderMoreButton(onNavigate) {
  const container = document.getElementById("mobile-nav");
  if (!container) return;

  const button = document.createElement("button");
  button.className = "nav-item";
  button.type = "button";
  button.dataset.more = "true";
  button.textContent = "更多";
  container.appendChild(button);

  button.addEventListener("click", () => {
    openModal(`
      <h2>更多</h2>
      <div class="more-links">
        <button class="btn more-link" type="button" data-more-route="reviews">复盘</button>
        <button class="btn more-link" type="button" data-more-route="settings">设置</button>
        <button class="btn more-link" type="button" data-close-more>关闭</button>
      </div>
    `);

    document.querySelectorAll("[data-more-route]").forEach((item) => {
      item.addEventListener("click", () => {
        const route = item.dataset.moreRoute;
        closeModal();
        onNavigate(route);
      });
    });

    document.querySelector("[data-close-more]")?.addEventListener("click", closeModal);
  });
}

export function updateNavigation(activeRoute) {
  document.querySelectorAll(".nav-item").forEach((button) => {
    const isActive = button.dataset.route === activeRoute;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-current", isActive ? "page" : "false");
  });
}

export function openModal(content = "") {
  const root = document.getElementById("modal-root");
  if (!root) return;

  root.innerHTML = `<div class="modal" role="dialog" aria-modal="true">${content}</div>`;
  root.hidden = false;
}

export function closeModal() {
  const root = document.getElementById("modal-root");
  if (!root) return;
  root.hidden = true;
  root.innerHTML = "";
}

export function showToast(message) {
  const root = document.getElementById("toast-root");
  if (!root) return;

  root.innerHTML = `<div class="toast">${message}</div>`;
  window.setTimeout(() => {
    root.innerHTML = "";
  }, 1800);
}
