const ROUTES = {
  dashboard: "首页 / Dashboard",
  tasks: "任务 / Tasks",
  goals: "目标 / Goals",
  budget: "预算 / Budget",
  reviews: "复盘 / Reviews",
  settings: "设置 / Settings"
};

let currentRoute = "dashboard";
let renderPage = () => {};
let updateNavigation = () => {};

function normalizeHash() {
  const hash = window.location.hash.replace(/^#\//, "");
  return ROUTES[hash] ? hash : "dashboard";
}

export function initRouter({ onRouteChange, onNavigationUpdate }) {
  renderPage = onRouteChange;
  updateNavigation = onNavigationUpdate;

  window.addEventListener("hashchange", handleRouteChange);
  handleRouteChange();
}

function handleRouteChange() {
  currentRoute = normalizeHash();

  const expectedHash = `#/${currentRoute}`;
  if (window.location.hash !== expectedHash) {
    window.history.replaceState(null, "", expectedHash);
  }

  renderPage(currentRoute, ROUTES[currentRoute]);
  updateNavigation(currentRoute);
}

export function navigateTo(route) {
  if (ROUTES[route]) {
    window.location.hash = `#/${route}`;
  }
}

export function getCurrentRoute() {
  return currentRoute;
}

export function getRoutes() {
  return { ...ROUTES };
}
