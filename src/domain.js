export const sizes = ["150", "155", "160", "165", "170", "175", "180", "185", "190", "195", "200", "special"];

export const factories = [
  { id: "factory-1", name: "1号工厂", strengths: "工作服、Polo、T恤、常规刺绣", capacity: 3200 },
  { id: "factory-2", name: "2号工厂", strengths: "校服、冲锋衣、反光条、复杂拼色", capacity: 2600 }
];

export const productionSteps = [
  ["accepted", "工厂接单"],
  ["cutting", "裁剪"],
  ["sewingStart", "上线"],
  ["sewingEnd", "下线"],
  ["finishing", "后整"],
  ["counting", "点数"],
  ["packing", "包装"],
  ["shipping", "出货"]
];

export const statusLabels = {
  draft: "草稿",
  needs_info: "待资料完善",
  review: "待审核",
  allocation: "待分厂",
  assigned: "已下发工厂",
  accepted: "工厂已接单",
  production: "生产中",
  inspection: "待质检",
  rework: "返工中",
  ready_ship: "待出货",
  shipped: "已出货",
  completed: "已完成",
  canceled: "已取消"
};

export function totalQuantity(order) {
  return (order.items || []).reduce((sum, item) => {
    return sum + sizes.reduce((sizeSum, size) => sizeSum + Number(item.quantities?.[size] || 0), 0);
  }, 0);
}

export function factoryName(id) {
  return factories.find((factory) => factory.id === id)?.name || "未分配";
}

export function isOverdue(order, now = new Date()) {
  if (!order.dueDate || ["completed", "shipped", "canceled"].includes(order.status)) return false;
  const today = new Date(formatDate(now));
  return new Date(order.dueDate) < today;
}

export function scoreOrder(order, now = new Date()) {
  const material = order.material || {};
  const accessories = order.accessories || {};
  const customization = order.customization || {};
  const technical = order.technical || {};
  const procurement = order.procurement || {};
  const risks = order.risks || [];

  const checks = [
    {
      key: "basic",
      label: "客户与交期信息",
      points: 1,
      pass: Boolean(order.customerName && order.contactName && order.phone && order.orderDate && order.dueDate)
    },
    {
      key: "sizes",
      label: "尺码数量",
      points: 1.5,
      pass: (order.items || []).some((item) => item.product && Object.values(item.quantities || {}).some((qty) => Number(qty) > 0))
    },
    {
      key: "material",
      label: "面料信息",
      points: 1.2,
      pass: Boolean(material.mainColor && (material.contrastColor || material.lining || material.filling) && material.fabricNote)
    },
    {
      key: "accessories",
      label: "辅料信息",
      points: 1,
      pass: [accessories.zipper, accessories.buttonType, accessories.reflective, accessories.thread, accessories.label, accessories.hangtag].filter(Boolean).length >= 4
    },
    {
      key: "customization",
      label: "定制内容",
      points: 1,
      pass: Boolean(customization.type && customization.content && customization.position && (customization.logoReady || customization.effectReady))
    },
    {
      key: "technical",
      label: "技术参数",
      points: 1.2,
      pass: Boolean(technical.confirmed && technical.owner && technical.note)
    },
    {
      key: "procurement",
      label: "采购确认",
      points: 1,
      pass: Boolean(procurement.confirmed && procurement.owner && procurement.note)
    },
    {
      key: "factory",
      label: "工厂匹配",
      points: 1,
      pass: Boolean(order.factoryId || order.status === "review" || order.status === "allocation")
    },
    {
      key: "risk",
      label: "质量与交付风险",
      points: 1.1,
      pass: risks.length === 0 && !isOverdue(order, now)
    }
  ];
  const score = checks.reduce((sum, item) => sum + (item.pass ? item.points : 0), 0);
  return {
    score: Math.round(score * 10) / 10,
    checks,
    missing: checks.filter((item) => !item.pass)
  };
}

export function canSubmitForReview(order, now = new Date()) {
  const result = scoreOrder(order, now);
  return ["draft", "needs_info"].includes(order.status) && result.score >= 6;
}

export function canApproveOrder(order, now = new Date()) {
  return order.status === "review" && scoreOrder(order, now).score >= 9;
}

export function canAssignFactory(order, now = new Date()) {
  return order.status === "allocation" && scoreOrder(order, now).score >= 9;
}

export function canAcceptFactoryOrder(order) {
  return order.status === "assigned" && Boolean(order.factoryId);
}

export function canSendToInspection(order) {
  return order.status === "production";
}

export function canShipOrder(order) {
  return order.status === "ready_ship" && Boolean(order.inspection?.counted && order.inspection?.passed && Number(order.inspection?.photoCount || 0) > 0);
}

export function canCompleteOrder(order) {
  return order.status === "shipped";
}

export function getInspectionReadyStatus(order) {
  return Boolean(order.inspection?.counted && order.inspection?.passed && Number(order.inspection?.photoCount || 0) > 0);
}

export function formatDate(date) {
  return date.toISOString().slice(0, 10);
}
