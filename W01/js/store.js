const STORAGE_KEY = "lifeManager";

export const DEFAULT_DATA = {
  version: "1.0",
  tasks: [],
  goals: [],
  budgets: [],
  transactions: [],
  reviews: [],
  settings: {
    nickname: "",
    currency: "CNY",
    weekStartsOn: 1
  }
};

let data = null;

function createDefaultData() {
  return structuredClone(DEFAULT_DATA);
}

function normalizeSettings(settings) {
  const source = settings && typeof settings === "object" && !Array.isArray(settings) ? settings : {};
  return {
    nickname: typeof source.nickname === "string" ? source.nickname.trim() : "",
    currency: "CNY",
    weekStartsOn: Number(source.weekStartsOn) === 0 ? 0 : 1
  };
}

export function normalizeData(parsed) {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("lifeManager 数据格式不正确");
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
    version: "1.0",
    tasks,
    goals,
    budgets: Array.isArray(parsed.budgets) ? parsed.budgets : [],
    transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
    reviews: Array.isArray(parsed.reviews) ? parsed.reviews : [],
    settings: normalizeSettings(parsed.settings)
  };
}

function storageError(action, error) {
  const message = action === "read"
    ? "本地数据读取失败，请检查浏览器存储权限；原有数据未被覆盖。"
    : "本地数据保存失败，请检查浏览器存储空间或权限。";
  const wrapped = new Error(message);
  wrapped.name = "StorageError";
  wrapped.cause = error;
  return wrapped;
}

export function loadData() {
  let raw;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch (error) {
    data = createDefaultData();
    throw storageError("read", error);
  }

  if (!raw) {
    data = createDefaultData();
    saveData();
    return data;
  }

  try {
    data = normalizeData(JSON.parse(raw));
    return data;
  } catch (error) {
    if (error?.name === "StorageError") throw error;
    data = createDefaultData();
    throw new Error("本地数据格式无法读取，请使用设置中的 JSON 备份恢复数据。", { cause: error });
  }
}

export function saveData() {
  if (!data) data = createDefaultData();

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    throw storageError("write", error);
  }

  return data;
}

export function getData() {
  if (!data) loadData();
  return data;
}
