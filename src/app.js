import {
  canAcceptFactoryOrder,
  canApproveOrder,
  canAssignFactory,
  canCompleteOrder,
  canSendToInspection,
  canShipOrder,
  canSubmitForReview,
  factories,
  factoryName,
  formatDate,
  getInspectionReadyStatus,
  productionSteps,
  scoreOrder,
  sizes,
  statusLabels,
  totalQuantity
} from "./domain.js";

const STORAGE_KEY = "garment-custom-order-system:v1";
const API_TOKEN_KEY = "garment-custom-order-system:api-token";
const API_BASE = window.location.port === "5173" ? "http://127.0.0.1:3000" : "";

const roles = ["管理员", "销售", "技术", "采购", "1号工厂", "2号工厂", "质检", "财务"];
const api = { enabled: false, connecting: false, user: null, error: "" };

const state = loadState();

function defaultState() {
  const today = new Date();
  const due = new Date(Date.now() + 12 * 24 * 60 * 60 * 1000);
  const order = createBlankOrder();
  Object.assign(order, {
    id: crypto.randomUUID(),
    number: nextOrderNumber(1),
    customerName: "示例客户-华东物业",
    contactName: "王经理",
    phone: "13800000000",
    salesOwner: "李预红",
    orderDate: formatDate(today),
    dueDate: formatDate(due),
    category: "工作服",
    urgency: "加急",
    source: "微信",
    status: "review",
    material: {
      mainColor: "藏青",
      contrastColor: "荧光绿",
      lining: "210T里布",
      filling: "无",
      fabricNote: "涤棉斜纹，耐磨，库存已确认"
    },
    accessories: {
      zipper: "5号树脂拉链",
      accessory: "袖口魔术贴",
      buttonType: "四合扣",
      reflective: "前胸和后背反光条",
      thread: "藏青线",
      elastic: "下摆松紧",
      label: "主标+洗水标",
      hangtag: "需要吊牌"
    },
    customization: {
      type: "刺绣",
      content: "客户公司logo",
      position: "左胸",
      logoReady: true,
      effectReady: true
    },
    technical: {
      owner: "孙昌旭",
      confirmed: true,
      note: "左胸刺绣宽 8cm，反光条按样衣位置，袖口魔术贴统一藏青色。"
    },
    procurement: {
      owner: "江悦",
      confirmed: true,
      note: "面料和辅料均有库存，可立即排产。"
    },
    items: [
      {
        id: crypto.randomUUID(),
        product: "单衣",
        quantities: { "175": 1, "180": 1, "185": 1 }
      }
    ],
    files: { logoCount: 1, effectCount: 1, technicalCount: 1 },
    risks: [],
    logs: []
  });
  addLog(order, "系统", "创建示例订单");

  return {
    view: "dashboard",
    role: "管理员",
    selectedOrderId: order.id,
    filters: { keyword: "", status: "all", factory: "all" },
    orders: [order]
  };
}

function createBlankOrder() {
  return {
    id: crypto.randomUUID(),
    number: "",
    customerName: "",
    contactName: "",
    phone: "",
    salesOwner: "",
    orderDate: formatDate(new Date()),
    dueDate: "",
    category: "工作服",
    urgency: "普通",
    source: "微信",
    status: "draft",
    factoryId: "",
    assignmentReason: "",
    material: { mainColor: "", contrastColor: "", lining: "", filling: "", fabricNote: "" },
    accessories: {
      zipper: "",
      accessory: "",
      buttonType: "",
      reflective: "",
      thread: "",
      elastic: "",
      label: "",
      hangtag: ""
    },
    customization: { type: "", content: "", position: "", logoReady: false, effectReady: false },
    technical: { owner: "", confirmed: false, note: "" },
    procurement: { owner: "", confirmed: false, note: "" },
    items: [{ id: crypto.randomUUID(), product: "单衣", quantities: {} }],
    steps: Object.fromEntries(productionSteps.map(([key]) => [key, "未开始"])),
    inspection: { counted: false, passed: false, photoCount: 0, note: "" },
    files: { logoCount: 0, effectCount: 0, technicalCount: 0 },
    risks: [],
    payment: { deposit: 0, final: 0, factoryCost: 0 },
    logs: []
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
  return defaultState();
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  if (api.enabled) {
    syncOrdersToApi().catch((error) => {
      api.error = error.message;
      render();
    });
  }
}

function nextOrderNumber(sequence) {
  const date = new Date();
  const stamp = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
  return `GD-${stamp}-${String(sequence).padStart(3, "0")}`;
}

function addLog(order, actor, action) {
  order.logs.unshift({
    id: crypto.randomUUID(),
    actor,
    action,
    time: new Date().toLocaleString("zh-CN", { hour12: false })
  });
}

function setView(view) {
  state.view = view;
  saveState();
  render();
}

function selectedOrder() {
  return state.orders.find((order) => order.id === state.selectedOrderId) || state.orders[0];
}

function statusClass(status) {
  if (["completed", "ready_ship", "shipped"].includes(status)) return "ok";
  if (["needs_info", "rework"].includes(status)) return "bad";
  if (["review", "allocation", "inspection"].includes(status)) return "warn";
  return "";
}

function scoreClass(score) {
  if (score >= 9) return "high";
  if (score >= 8) return "mid";
  return "low";
}

function filteredOrders() {
  return state.orders.filter((order) => {
    const keyword = state.filters.keyword.trim().toLowerCase();
    const matchKeyword = !keyword || [order.number, order.customerName, order.contactName, order.category].join(" ").toLowerCase().includes(keyword);
    const matchStatus = state.filters.status === "all" || order.status === state.filters.status;
    const matchFactory = state.filters.factory === "all" || order.factoryId === state.filters.factory;
    return matchKeyword && matchStatus && matchFactory;
  });
}

function render() {
  document.querySelector("#app").innerHTML = `
    <div class="app-shell">
      ${renderSidebar()}
      <main class="main">
        <header class="topbar">
          <div>
            <div class="page-kicker">Apparel Order Management</div>
            <h1>${pageTitle()}</h1>
          </div>
          <div class="topbar-actions">
            <button class="btn ghost" data-action="export" aria-label="导出订单 JSON">导出 JSON</button>
            <button class="btn primary" data-action="new-order" aria-label="新建服装定制订单">新建订单</button>
          </div>
        </header>
        <section class="content">
          ${renderPageIntro()}
          ${renderView()}
        </section>
      </main>
    </div>
  `;
}

function renderSidebar() {
  const nav = [
    ["dashboard", "看板"],
    ["orders", "订单"],
    ["factory", "工厂"],
    ["quality", "质检"],
    ["settings", "设置"]
  ];
  return `
    <aside class="sidebar">
      <div class="brand">
        <div class="brand-mark">OM</div>
        <div>
          <strong>服装定制系统</strong>
          <span>订单评分 · 分厂 · 生产 · 质检</span>
        </div>
      </div>
      <div class="nav-section-label">工作区</div>
      <nav class="nav">
        ${nav.map(([id, label]) => `<button class="${state.view === id ? "active" : ""}" data-view="${id}" aria-label="打开${label}页面"><span class="nav-dot"></span>${label}</button>`).join("")}
      </nav>
      <div class="sidebar-footer">
        <div class="tag">${api.enabled ? `API: ${api.user?.name || "已连接"}` : "本地模式"}</div>
        ${api.error ? `<div class="notice">${escapeHtml(api.error)}</div>` : ""}
        <label>当前角色</label>
        <select class="select" data-role>
          ${roles.map((role) => `<option ${state.role === role ? "selected" : ""}>${role}</option>`).join("")}
        </select>
        <button class="btn ghost" data-action="reset-demo">重置示例数据</button>
      </div>
    </aside>
  `;
}

function pageTitle() {
  return {
    dashboard: "订单生产看板",
    orders: "订单管理",
    new: "新建订单",
    detail: "订单详情",
    factory: "工厂工作台",
    quality: "点数质检",
    settings: "系统设置"
  }[state.view];
}

function renderView() {
  if (state.view === "dashboard") return renderDashboard();
  if (state.view === "orders") return renderOrders();
  if (state.view === "new") return renderOrderForm();
  if (state.view === "detail") return renderDetail();
  if (state.view === "factory") return renderFactory();
  if (state.view === "quality") return renderQuality();
  return renderSettings();
}

function renderPageIntro() {
  const orders = state.orders;
  const riskCount = orders.filter((order) => scoreOrder(order).score < 9 || ["needs_info", "rework"].includes(order.status)).length;
  const dueSoon = orders.filter((order) => {
    if (!order.dueDate || ["completed", "shipped", "canceled"].includes(order.status)) return false;
    const days = Math.ceil((new Date(order.dueDate) - new Date(formatDate(new Date()))) / 86400000);
    return days >= 0 && days <= 7;
  }).length;
  return `
    <div class="page-intro">
      <div>
        <div class="intro-label">生产协同总览</div>
        <p>统一管理客户订单、9 分评分、工厂分配、生产节点、点数质检与出货。</p>
      </div>
      <div class="intro-summary" aria-label="当前业务摘要">
        <span>风险订单 <strong>${riskCount}</strong></span>
        <span>7 天内交期 <strong>${dueSoon}</strong></span>
        <span>当前角色 <strong>${state.role}</strong></span>
      </div>
    </div>
  `;
}

function renderDashboard() {
  const orders = state.orders;
  const avgScore = orders.length ? orders.reduce((sum, order) => sum + scoreOrder(order).score, 0) / orders.length : 0;
  const metrics = [
    ["订单总数", orders.length, "全部订单池"],
    ["平均评分", avgScore.toFixed(1), "9 分可下发"],
    ["待审核", orders.filter((order) => order.status === "review").length, "需管理员处理"],
    ["待分厂", orders.filter((order) => order.status === "allocation").length, "选择 1/2 号工厂"],
    ["生产中", orders.filter((order) => ["assigned", "accepted", "production", "inspection", "rework"].includes(order.status)).length, "工厂进行中"]
  ];
  return `
    <div class="grid metrics">
      ${metrics.map(([label, value, meta]) => `<div class="metric"><span>${label}</span><strong>${value}</strong><em>${meta}</em></div>`).join("")}
    </div>
    ${renderWorkflowStrip()}
    <div class="grid page-stack">
      <div class="panel table-card">
        <div class="panel-header">
          <div>
            <h2>最近订单</h2>
            <p>按交期、评分、状态快速判断下一步动作</p>
          </div>
          <button class="btn ghost" data-view="orders">查看全部</button>
        </div>
        <div class="table-wrap">${renderOrderTable(orders.slice(0, 8))}</div>
      </div>
    </div>
  `;
}

function renderWorkflowStrip() {
  const steps = [
    ["待审核", state.orders.filter((order) => order.status === "review").length],
    ["待分厂", state.orders.filter((order) => order.status === "allocation").length],
    ["生产中", state.orders.filter((order) => ["assigned", "accepted", "production"].includes(order.status)).length],
    ["待质检", state.orders.filter((order) => ["inspection", "rework"].includes(order.status)).length],
    ["待出货", state.orders.filter((order) => order.status === "ready_ship").length]
  ];
  return `
    <div class="workflow-strip" aria-label="生产主流程">
      ${steps.map(([label, count], index) => `
        <div class="workflow-step">
          <span>${String(index + 1).padStart(2, "0")}</span>
          <strong>${label}</strong>
          <em>${count} 单</em>
        </div>
      `).join("")}
    </div>
  `;
}

function renderOrders() {
  return `
    <div class="panel">
      <div class="panel-header">
        <div>
          <h2>订单列表</h2>
          <p>筛选订单、查看评分和生产状态</p>
        </div>
        <div class="toolbar">
          <input class="input toolbar-search" aria-label="搜索订单客户联系人" placeholder="搜索订单/客户/联系人" data-filter="keyword" value="${escapeHtml(state.filters.keyword)}" />
          <select class="select toolbar-select" data-filter="status" aria-label="筛选订单状态">
            <option value="all">全部状态</option>
            ${Object.entries(statusLabels).map(([key, label]) => `<option value="${key}" ${state.filters.status === key ? "selected" : ""}>${label}</option>`).join("")}
          </select>
          <select class="select toolbar-select" data-filter="factory" aria-label="筛选工厂">
            <option value="all">全部工厂</option>
            ${factories.map((factory) => `<option value="${factory.id}" ${state.filters.factory === factory.id ? "selected" : ""}>${factory.name}</option>`).join("")}
          </select>
        </div>
      </div>
      <div class="table-wrap">${renderOrderTable(filteredOrders())}</div>
    </div>
  `;
}

function renderOrderTable(orders) {
  if (!orders.length) return `<div class="empty">暂无订单</div>`;
  return `
    <table class="data-table">
      <thead>
        <tr>
          <th>订单编号</th>
          <th>客户</th>
          <th>品类</th>
          <th>数量</th>
          <th>交期</th>
          <th>评分</th>
          <th>状态</th>
          <th>工厂</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        ${orders.map((order) => {
          const result = scoreOrder(order);
          return `
            <tr>
              <td><div class="order-primary"><strong>${order.number}</strong><span>${escapeHtml(order.contactName || "-")}</span></div></td>
              <td>${escapeHtml(order.customerName || "未填写")}</td>
              <td>${escapeHtml(order.category)}</td>
              <td class="numeric">${totalQuantity(order)}</td>
              <td>${order.dueDate || "未填写"}</td>
              <td><span class="score ${scoreClass(result.score)}">${result.score}</span></td>
              <td><span class="status ${statusClass(order.status)}">${statusLabels[order.status]}</span></td>
              <td>${factoryName(order.factoryId)}</td>
              <td><button class="btn ghost compact" data-open="${order.id}" aria-label="打开订单 ${order.number}">打开</button></td>
            </tr>
          `;
        }).join("")}
      </tbody>
    </table>
  `;
}

function renderOrderForm() {
  const order = createBlankOrder();
  return `
    <form class="sections" data-create-order>
      <div class="form-banner">
        <strong>新建生产订单</strong>
        <span>保存后系统会自动评分，低于 9 分不能下发工厂。</span>
      </div>
      ${renderBasicFields(order)}
      ${renderItemsEditor(order)}
      ${renderMaterialFields(order)}
      ${renderConfirmFields(order)}
      <div class="panel">
        <div class="panel-body toolbar">
          <button class="btn primary" type="submit">保存订单</button>
          <button class="btn ghost" type="button" data-view="orders">返回列表</button>
        </div>
      </div>
    </form>
  `;
}

function renderBasicFields(order) {
  return `
    <div class="section">
      <h2 class="section-title">订单基础信息</h2>
      <p class="section-desc">客户、交期和负责人是提交审核的基础条件。</p>
      <div class="form-grid">
        ${field("客户名称", "customerName", order.customerName)}
        ${field("联系人", "contactName", order.contactName)}
        ${field("联系电话", "phone", order.phone)}
        ${field("销售负责人", "salesOwner", order.salesOwner)}
        ${field("下单日期", "orderDate", order.orderDate, "date")}
        ${field("计划交期", "dueDate", order.dueDate, "date")}
        ${selectField("订单品类", "category", order.category, ["工作服", "校服", "团服", "冲锋衣", "Polo", "T恤", "马甲"])}
        ${selectField("紧急程度", "urgency", order.urgency, ["普通", "加急", "特急"])}
        ${field("订单来源", "source", order.source)}
        <div class="field full">
          <label>备注</label>
          <textarea class="textarea" name="remark">${escapeHtml(order.remark || "")}</textarea>
        </div>
      </div>
    </div>
  `;
}

function renderItemsEditor(order) {
  const item = order.items[0];
  return `
    <div class="section">
      <h2 class="section-title">尺码数量</h2>
      <p class="section-desc">至少录入一个产品和一个尺码数量，系统会自动计算合计。</p>
      <div class="table-wrap">
        <table class="size-table">
          <thead>
            <tr>
              <th>产品</th>
              ${sizes.map((size) => `<th>${size === "special" ? "特体" : size}</th>`).join("")}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><input class="input" name="itemProduct" value="${escapeHtml(item.product)}" /></td>
              ${sizes.map((size) => `<td><input class="input" type="number" min="0" name="size_${size}" value="${Number(item.quantities[size] || 0)}" /></td>`).join("")}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderMaterialFields(order) {
  return `
    <div class="section">
      <h2 class="section-title">面辅料与定制信息</h2>
      <p class="section-desc">面料、辅料、logo 和定制位置越明确，工厂返工风险越低。</p>
      <div class="form-grid">
        ${field("面料主色", "material.mainColor", order.material.mainColor)}
        ${field("面料拼色", "material.contrastColor", order.material.contrastColor)}
        ${field("里布", "material.lining", order.material.lining)}
        ${field("填充物", "material.filling", order.material.filling)}
        ${field("面料备注", "material.fabricNote", order.material.fabricNote, "text", "full")}
        ${field("门襟拉链", "accessories.zipper", order.accessories.zipper)}
        ${field("扣子分类", "accessories.buttonType", order.accessories.buttonType)}
        ${field("反光条", "accessories.reflective", order.accessories.reflective)}
        ${field("缝纫线", "accessories.thread", order.accessories.thread)}
        ${field("商标", "accessories.label", order.accessories.label)}
        ${field("吊牌", "accessories.hangtag", order.accessories.hangtag)}
        ${field("其他辅料", "accessories.accessory", order.accessories.accessory)}
        ${field("定制类型", "customization.type", order.customization.type)}
        ${field("定制内容", "customization.content", order.customization.content)}
        ${field("定制位置", "customization.position", order.customization.position)}
        ${field("logo 文件数量", "files.logoCount", order.files.logoCount, "number")}
        ${field("效果图数量", "files.effectCount", order.files.effectCount, "number")}
        ${field("技术图数量", "files.technicalCount", order.files.technicalCount, "number")}
      </div>
    </div>
  `;
}

function renderConfirmFields(order) {
  return `
    <div class="section">
      <h2 class="section-title">技术与采购确认</h2>
      <p class="section-desc">技术和采购确认后，订单才具备进入生产的条件。</p>
      <div class="form-grid">
        ${field("技术负责人", "technical.owner", order.technical.owner)}
        ${selectField("技术确认", "technical.confirmed", String(order.technical.confirmed), [["true", "已确认"], ["false", "未确认"]])}
        ${field("技术说明", "technical.note", order.technical.note, "text", "half")}
        ${field("采购负责人", "procurement.owner", order.procurement.owner)}
        ${selectField("采购确认", "procurement.confirmed", String(order.procurement.confirmed), [["true", "已确认"], ["false", "未确认"]])}
        ${field("采购说明", "procurement.note", order.procurement.note, "text", "half")}
      </div>
    </div>
  `;
}

function field(label, name, value, type = "text", span = "") {
  return `
    <div class="field ${span}">
      <label>${label}</label>
      <input class="input" type="${type}" name="${name}" value="${escapeHtml(value ?? "")}" />
    </div>
  `;
}

function selectField(label, name, value, options) {
  return `
    <div class="field">
      <label>${label}</label>
      <select class="select" name="${name}">
        ${options.map((option) => {
          const optionValue = Array.isArray(option) ? option[0] : option;
          const optionLabel = Array.isArray(option) ? option[1] : option;
          return `<option value="${optionValue}" ${String(value) === String(optionValue) ? "selected" : ""}>${optionLabel}</option>`;
        }).join("")}
      </select>
    </div>
  `;
}

function renderDetail() {
  const order = selectedOrder();
  if (!order) return `<div class="empty">请选择订单</div>`;
  const result = scoreOrder(order);
  return `
    <div class="detail-layout">
      <div class="grid">
        <div class="panel order-hero">
          <div class="panel-header">
            <div>
              <h2>${order.number}</h2>
              <p>${escapeHtml(order.customerName || "未填写客户")} · ${escapeHtml(order.category)}</p>
            </div>
            <span class="status ${statusClass(order.status)}">${statusLabels[order.status]}</span>
          </div>
          <div class="panel-body">
            <div class="info-grid">
              ${infoItem("联系人", escapeHtml(order.contactName || "-"))}
              ${infoItem("电话", escapeHtml(order.phone || "-"))}
              ${infoItem("计划交期", order.dueDate || "-")}
              ${infoItem("合计数量", totalQuantity(order))}
              ${infoItem("生产工厂", factoryName(order.factoryId))}
              ${infoItem("技术负责人", escapeHtml(order.technical.owner || "-"))}
              ${infoItem("采购负责人", escapeHtml(order.procurement.owner || "-"))}
              ${infoItem("当前评分", `${result.score}/10`)}
            </div>
          </div>
        </div>
        <div class="panel">
          <div class="panel-header"><div><h2>生产节点</h2><p>工厂按节点更新进度，后整完成后进入质检。</p></div></div>
          <div class="panel-body">
            <div class="timeline">
              ${productionSteps.map(([key, label]) => `
                <div class="step">
                  <div><strong>${label}</strong><span>${order.steps?.[key] || "未开始"}</span></div>
                  <select class="select step-select" data-step="${key}" aria-label="更新${label}状态">
                    ${["未开始", "进行中", "已完成"].map((value) => `<option ${order.steps?.[key] === value ? "selected" : ""}>${value}</option>`).join("")}
                  </select>
                </div>
              `).join("")}
            </div>
          </div>
        </div>
        <div class="panel">
          <div class="panel-header"><div><h2>操作日志</h2><p>保留审核、分厂、质检、出货等关键动作。</p></div></div>
          <div class="panel-body logs">
            ${order.logs.map((log) => `<div class="log-item"><time>${log.time} · ${log.actor}</time>${escapeHtml(log.action)}</div>`).join("") || `<div class="empty">暂无日志</div>`}
          </div>
        </div>
      </div>
      <aside class="grid">
        ${renderScorePanel(order, result)}
        ${renderActions(order, result)}
        ${renderInspectionPanel(order)}
      </aside>
    </div>
  `;
}

function infoItem(label, value) {
  return `<div class="info-item"><span>${label}</span><strong>${value}</strong></div>`;
}

function renderScorePanel(order, result) {
  return `
    <div class="panel">
      <div class="panel-header"><div><h2>订单评分</h2><p>9 分以上才允许下发工厂</p></div><span class="score ${scoreClass(result.score)}">${result.score}/10</span></div>
      <div class="panel-body score-card">
        <div class="score-ring" style="--score:${result.score}"><div><strong>${result.score}</strong><span>分</span></div></div>
        ${result.score < 9 ? `<div class="notice">当前低于 9 分，不能下发工厂。请补齐扣分项后重新审核。</div>` : `<div class="status ok">达到 9 分，可下发工厂</div>`}
        <ul class="check-list">
          ${result.checks.map((item) => `<li class="${item.pass ? "pass" : "fail"}"><span>${item.pass ? "通过" : "缺失"}</span>${item.label}（${item.points} 分）</li>`).join("")}
        </ul>
      </div>
    </div>
  `;
}

function renderActions(order, result) {
  const canSubmit = canSubmitForReview(order);
  const canApprove = canApproveOrder(order);
  const canAssign = canAssignFactory(order);
  const canAccept = canAcceptFactoryOrder(order);
  const canInspect = canSendToInspection(order);
  const canShip = canShipOrder(order);
  const canComplete = canCompleteOrder(order);
  return `
    <div class="panel">
      <div class="panel-header"><div><h2>流程动作</h2><p>按评分和状态自动锁定不可执行动作</p></div></div>
      <div class="panel-body action-grid">
        <button class="btn primary" data-flow="submit" ${canSubmit ? "" : "disabled"}>提交审核</button>
        <button class="btn primary" data-flow="approve" ${canApprove ? "" : "disabled"}>审核通过</button>
        <select class="select" data-assign-factory>
          <option value="">选择工厂</option>
          ${factories.map((factory) => `<option value="${factory.id}" ${order.factoryId === factory.id ? "selected" : ""}>${factory.name}</option>`).join("")}
        </select>
        <input class="input" data-assignment-reason placeholder="分配理由" value="${escapeHtml(order.assignmentReason || "")}" />
        <button class="btn primary" data-flow="assign" ${canAssign ? "" : "disabled"}>下发工厂</button>
        <button class="btn primary" data-flow="accept" ${canAccept ? "" : "disabled"}>工厂接单</button>
        <button class="btn primary" data-flow="inspection" ${canInspect ? "" : "disabled"}>送检</button>
        <button class="btn primary" data-flow="ship" ${canShip ? "" : "disabled"}>确认出货</button>
        <button class="btn primary" data-flow="complete" ${canComplete ? "" : "disabled"}>订单完成</button>
        <button class="btn danger" data-flow="rework" ${["inspection", "ready_ship"].includes(order.status) ? "" : "disabled"}>标记返工</button>
      </div>
    </div>
  `;
}

function renderInspectionPanel(order) {
  return `
    <div class="panel">
      <div class="panel-header"><div><h2>点数质检</h2><p>点数、质检、照片齐全后才可出货</p></div></div>
      <div class="panel-body grid">
        <label class="check-control"><input type="checkbox" data-inspection="counted" ${order.inspection.counted ? "checked" : ""}/> 已完成点数</label>
        <label class="check-control"><input type="checkbox" data-inspection="passed" ${order.inspection.passed ? "checked" : ""}/> 质检通过</label>
        <div class="field">
          <label>质检照片数量</label>
          <input class="input" type="number" min="0" data-inspection="photoCount" value="${Number(order.inspection.photoCount || 0)}" />
        </div>
        <div class="field">
          <label>质检备注</label>
          <textarea class="textarea" data-inspection="note">${escapeHtml(order.inspection.note || "")}</textarea>
        </div>
      </div>
    </div>
  `;
}

function renderFactory() {
  const factoryOrders = state.orders.filter((order) => order.factoryId);
  return `
    <div class="grid">
      <div class="grid metrics">
        ${factories.map((factory) => `
          <div class="metric factory-metric">
            <span>${factory.name}</span>
            <strong>${state.orders.filter((order) => order.factoryId === factory.id && !["completed", "canceled"].includes(order.status)).length}</strong>
            <em>${factory.strengths}</em>
          </div>
        `).join("")}
      </div>
      <div class="panel">
        <div class="panel-header"><h2>已分配订单</h2></div>
        <div class="table-wrap">${renderOrderTable(factoryOrders)}</div>
      </div>
    </div>
  `;
}

function renderQuality() {
  const orders = state.orders.filter((order) => ["inspection", "rework", "ready_ship"].includes(order.status));
  return `
    <div class="panel">
      <div class="panel-header"><h2>点数质检队列</h2></div>
      <div class="table-wrap">${renderOrderTable(orders)}</div>
    </div>
  `;
}

function renderSettings() {
  return `
    <div class="grid">
      <div class="panel">
        <div class="panel-header"><h2>默认工厂</h2></div>
        <div class="panel-body">
          <table>
            <thead><tr><th>工厂</th><th>擅长品类</th><th>月产能</th></tr></thead>
            <tbody>${factories.map((factory) => `<tr><td>${factory.name}</td><td>${factory.strengths}</td><td>${factory.capacity}</td></tr>`).join("")}</tbody>
          </table>
        </div>
      </div>
      <div class="panel">
        <div class="panel-header"><h2>系统规则</h2></div>
        <div class="panel-body">
          <ul class="check-list">
            <li>✓ 订单低于 9 分不能下发工厂</li>
            <li>✓ 质检不通过不能出货</li>
            <li>✓ 出货前必须完成点数和照片记录</li>
            <li>✓ 关键动作自动写入订单日志</li>
          </ul>
        </div>
      </div>
    </div>
  `;
}

function createOrderFromForm(form) {
  const data = new FormData(form);
  const order = createBlankOrder();
  order.number = nextOrderNumber(state.orders.length + 1);
  for (const [key, value] of data.entries()) {
    if (key.startsWith("size_")) continue;
    setDeep(order, key, normalizeValue(key, value));
  }
  const item = order.items[0];
  item.product = data.get("itemProduct") || "单衣";
  sizes.forEach((size) => {
    item.quantities[size] = Number(data.get(`size_${size}`) || 0);
  });
  order.customization.logoReady = Number(order.files.logoCount) > 0;
  order.customization.effectReady = Number(order.files.effectCount) > 0;
  const result = scoreOrder(order);
  order.status = result.score >= 6 ? "review" : "needs_info";
  addLog(order, state.role, `创建订单，初始评分 ${result.score}`);
  state.orders.unshift(order);
  state.selectedOrderId = order.id;
  state.view = "detail";
  saveState();
  render();
}

function normalizeValue(key, value) {
  if (["technical.confirmed", "procurement.confirmed"].includes(key)) return value === "true";
  if (key.startsWith("files.")) return Number(value || 0);
  return String(value).trim();
}

function setDeep(target, path, value) {
  const parts = path.split(".");
  let current = target;
  while (parts.length > 1) current = current[parts.shift()];
  current[parts[0]] = value;
}

function updateStatusFromSteps(order) {
  const completed = productionSteps.filter(([key]) => order.steps[key] === "已完成").length;
  if (completed >= 1 && !["inspection", "ready_ship", "shipped", "completed", "rework"].includes(order.status)) {
    order.status = "production";
  }
  if (order.steps.finishing === "已完成" && order.status === "production") {
    order.status = "inspection";
  }
}

function runFlow(action) {
  const order = selectedOrder();
  const result = scoreOrder(order);
  if (!order) return;
  if (action === "submit" && canSubmitForReview(order)) {
    order.status = result.score >= 9 ? "review" : "needs_info";
    addLog(order, state.role, `提交审核，当前评分 ${result.score}`);
  }
  if (action === "approve" && canApproveOrder(order)) {
    order.status = "allocation";
    addLog(order, state.role, "审核通过，进入待分厂");
  }
  if (action === "assign" && canAssignFactory(order)) {
    const factorySelect = document.querySelector("[data-assign-factory]");
    const reason = document.querySelector("[data-assignment-reason]");
    if (!factorySelect.value) return alert("请选择 1 号工厂或 2 号工厂");
    order.factoryId = factorySelect.value;
    order.assignmentReason = reason.value.trim() || "评分达到 9 分，资料完整，可生产";
    order.status = "assigned";
    addLog(order, state.role, `下发至 ${factoryName(order.factoryId)}：${order.assignmentReason}`);
  }
  if (action === "accept" && canAcceptFactoryOrder(order)) {
    order.status = "accepted";
    order.steps.accepted = "已完成";
    addLog(order, state.role, `${factoryName(order.factoryId)} 确认接单`);
  }
  if (action === "inspection" && canSendToInspection(order)) {
    order.status = "inspection";
    addLog(order, state.role, "生产完成，送交质检");
  }
  if (action === "rework") {
    order.status = "rework";
    order.risks.push("质检返工");
    addLog(order, state.role, "质检不通过，标记返工");
  }
  if (action === "ship" && canShipOrder(order)) {
    order.status = "shipped";
    order.steps.shipping = "已完成";
    addLog(order, state.role, "确认出货");
  }
  if (action === "complete" && canCompleteOrder(order)) {
    order.status = "completed";
    addLog(order, state.role, "订单完成并归档");
  }
  saveState();
  render();
}

function exportJson() {
  const blob = new Blob([JSON.stringify(state.orders, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `garment-orders-${formatDate(new Date())}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

async function connectApi() {
  if (api.connecting || api.enabled) return;
  api.connecting = true;
  try {
    const health = await fetch(`${API_BASE}/api/health`);
    if (!health.ok) throw new Error("API 未启用，继续使用本地模式");
    let token = localStorage.getItem(API_TOKEN_KEY);
    let user = null;
    if (!token) {
      const session = await loginApi();
      token = session.token;
      user = session.user;
    }
    let orders;
    try {
      orders = await apiRequest("/api/orders", { token });
    } catch (error) {
      localStorage.removeItem(API_TOKEN_KEY);
      const session = await loginApi();
      token = session.token;
      user = session.user;
      orders = await apiRequest("/api/orders", { token });
    }
    api.enabled = true;
    api.user = user || { name: "系统管理员", role: "管理员" };
    api.error = "";
    state.orders = orders;
    state.selectedOrderId = state.orders[0]?.id || state.selectedOrderId;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    render();
  } catch (error) {
    api.error = "";
  } finally {
    api.connecting = false;
  }
}

async function loginApi() {
  const session = await apiRequest("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ username: "admin", password: "admin123" }),
    skipAuth: true
  });
  localStorage.setItem(API_TOKEN_KEY, session.token);
  return session;
}

async function syncOrdersToApi() {
  await apiRequest("/api/orders", {
    method: "PUT",
    body: JSON.stringify(state.orders)
  });
}

async function apiRequest(path, options = {}) {
  const token = options.token || localStorage.getItem(API_TOKEN_KEY);
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (!options.skipAuth && token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${API_BASE}${path}`, {
    method: options.method || "GET",
    headers,
    body: options.body
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) localStorage.removeItem(API_TOKEN_KEY);
    throw new Error(payload.error || `API 请求失败：${response.status}`);
  }
  return payload;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

document.addEventListener("click", (event) => {
  const viewButton = event.target.closest("[data-view]");
  if (viewButton) setView(viewButton.dataset.view);

  const openButton = event.target.closest("[data-open]");
  if (openButton) {
    state.selectedOrderId = openButton.dataset.open;
    state.view = "detail";
    saveState();
    render();
  }

  const actionButton = event.target.closest("[data-action]");
  if (actionButton?.dataset.action === "new-order") setView("new");
  if (actionButton?.dataset.action === "export") exportJson();
  if (actionButton?.dataset.action === "reset-demo") {
    localStorage.removeItem(STORAGE_KEY);
    Object.assign(state, defaultState());
    saveState();
    render();
  }

  const flowButton = event.target.closest("[data-flow]");
  if (flowButton && !flowButton.disabled) runFlow(flowButton.dataset.flow);
});

document.addEventListener("change", (event) => {
  if (event.target.matches("[data-role]")) {
    state.role = event.target.value;
    saveState();
    render();
  }
  if (event.target.matches("[data-filter]")) {
    state.filters[event.target.dataset.filter] = event.target.value;
    saveState();
    render();
  }
  if (event.target.matches("[data-step]")) {
    const order = selectedOrder();
    order.steps[event.target.dataset.step] = event.target.value;
    updateStatusFromSteps(order);
    addLog(order, state.role, `更新生产节点：${event.target.dataset.step} = ${event.target.value}`);
    saveState();
    render();
  }
  if (event.target.matches("[data-inspection]")) {
    const order = selectedOrder();
    const key = event.target.dataset.inspection;
    order.inspection[key] = event.target.type === "checkbox" ? event.target.checked : event.target.value;
    if (getInspectionReadyStatus(order)) {
      order.status = "ready_ship";
    }
    addLog(order, state.role, "更新点数质检信息");
    saveState();
    render();
  }
});

document.addEventListener("input", (event) => {
  if (event.target.matches("[data-filter]")) {
    state.filters[event.target.dataset.filter] = event.target.value;
    saveState();
    render();
  }
  if (event.target.matches('[data-inspection="photoCount"]')) {
    const order = selectedOrder();
    order.inspection.photoCount = Number(event.target.value || 0);
    if (getInspectionReadyStatus(order)) {
      order.status = "ready_ship";
    }
    saveState();
    render();
  }
});

document.addEventListener("submit", (event) => {
  if (event.target.matches("[data-create-order]")) {
    event.preventDefault();
    createOrderFromForm(event.target);
  }
});

render();
connectApi();
