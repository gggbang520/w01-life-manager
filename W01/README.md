# W01｜生活管理网站

## 项目名称
W01｜生活管理网站

## 技术栈
- HTML
- CSS
- Vanilla JavaScript
- JavaScript ES Modules
- Browser localStorage
- Hash 路由

V1 不使用 React、Vue、Node.js、后端、数据库、登录、云同步或第三方 API。

## 当前版本
V1.0

## 当前开发阶段
整体联调、稳定性检查与 UI 整理完成

## 文件结构
```text
W01/
├── index.html
├── css/
│   └── style.css
├── js/
│   ├── app.js
│   ├── router.js
│   ├── store.js
│   ├── ui.js
│   ├── tasks.js
│   ├── goals.js
│   ├── budget.js
│   ├── reviews.js
│   └── settings.js
├── assets/
└── README.md
```

## 当前数据结构
localStorage 继续只使用一个数据对象 `lifeManager`：

```json
{
  "version": "1.0",
  "tasks": [],
  "goals": [],
  "budgets": [],
  "transactions": [],
  "reviews": [],
  "settings": {
    "nickname": "",
    "currency": "CNY",
    "weekStartsOn": 1
  }
}
```

`store.js` 负责默认结构和旧数据兼容。缺少 `settings` 时自动补齐，不影响任务、目标、预算、收支和复盘。

## Settings 数据结构
```js
{
  nickname: "",
  currency: "CNY",
  weekStartsOn: 1
}
```

- `nickname`：用户称呼，可为空
- `currency`：V1 只提供 `CNY`（人民币），金额显示使用 `¥`
- `weekStartsOn`：`1` 为周一，`0` 为周日

设置通过统一的“保存设置”按钮写入 `lifeManager.settings`。

## V1.0 设置页面
路由：`#/settings`。移动端通过“更多 → 设置”进入。

页面包含：
- 个人设置
- 数据管理
- 数据状态统计
- 关于

## JSON 导出
点击“导出数据”会导出整个 `lifeManager` 数据对象，并额外加入 `exportedAt` 元数据：

```json
{
  "version": "1.0",
  "exportedAt": "2026-09-27T...",
  "tasks": [],
  "goals": [],
  "budgets": [],
  "transactions": [],
  "reviews": [],
  "settings": {
    "nickname": "",
    "currency": "CNY",
    "weekStartsOn": 1
  }
}
```

建议文件名：`lifeManager-YYYY-MM-DD.json`。

## JSON 导入规则
导入前先解析 JSON，再验证：
- 顶层必须是对象
- `tasks`、`goals`、`budgets`、`transactions`、`reviews` 如果存在必须是数组
- `settings` 如果存在必须是对象
- 缺少旧字段时自动补齐默认值

非法 JSON、非对象 JSON 或错误字段类型不会覆盖当前数据，并提示“导入失败：文件格式不正确”。

如果当前浏览器已经有数据，合法文件解析后还需要用户确认“确认导入”，才会覆盖当前 `lifeManager`。

## 清空数据
“清空全部数据”必须经过两次确认。确认后只重置 `lifeManager` 内的数据，不使用 `localStorage.clear()`，因此不会删除其他 localStorage Key。

清空后的结构：

```js
{
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
}
```

## 任务、目标、预算与复盘
V1.0 保留并兼容此前已经开发的：
- V0.2 任务模块
- V0.3 目标模块
- V0.4 预算与收入/支出模块
- V0.5 日 / 周 / 月复盘模块

预算金额显示读取 `settings.currency`；当前 V1 只有 CNY。复盘周起始日读取 `settings.weekStartsOn`。

## 如何本地启动
由于项目使用 ES Modules，建议不要直接双击 `index.html`，而是使用本地静态服务器。

如果电脑已安装 Python，在项目根目录执行：

```bash
python -m http.server 8000
```

然后浏览器打开：

```text
http://localhost:8000
```

设置页面：

```text
http://localhost:8000/#/settings
```

## V1.0 已完成内容
- 设置页面
- 昵称设置
- CNY 货币偏好
- 每周开始日偏好
- 数据数量概览
- 数据版本显示
- 完整 `lifeManager` JSON 导出
- JSON 导入与字段校验
- 导入覆盖前确认
- 全部数据双重确认清空
- 清空后默认结构恢复
- 首页 / 任务 / 目标 / 预算 / 复盘数据兼容
- localStorage 持久化

## V1.0 设计边界
本版本不包含：
- 登录
- 用户系统
- 云同步
- 后端
- 数据库
- 支付
- AI
- 复杂提醒
- 日历
- 番茄钟
- 多用户
- 权限系统
- 复杂主题系统
- 第三方账号绑定

## 测试状态
已完成代码层 JavaScript 语法、数据逻辑、导入校验、导出结构、清空逻辑、旧数据兼容和静态 HTTP 测试。真实浏览器人工验收需要单独执行，不能由代码层测试替代。

## V1.0 联调结果
V1.0 在不改变既有产品逻辑和数据结构的前提下完成整体联调、稳定性检查、错误处理整理和响应式 UI 整理。未新增业务模块。

## 当前状态
V1.0 代码层测试与静态 HTTP 检查已完成。真实浏览器人工联调需要单独执行，不能由代码层测试替代。
