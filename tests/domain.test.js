import test from "node:test";
import assert from "node:assert/strict";

import {
  canApproveOrder,
  canAssignFactory,
  canShipOrder,
  canSubmitForReview,
  getInspectionReadyStatus,
  scoreOrder,
  totalQuantity
} from "../src/domain.js";

function productionReadyOrder(overrides = {}) {
  return {
    customerName: "华东物业",
    contactName: "王经理",
    phone: "13800000000",
    orderDate: "2026-06-13",
    dueDate: "2026-06-30",
    status: "review",
    factoryId: "",
    items: [
      {
        product: "单衣",
        quantities: { "175": 10, "180": 12, "185": 8 }
      }
    ],
    material: {
      mainColor: "藏青",
      contrastColor: "荧光绿",
      lining: "210T里布",
      filling: "无",
      fabricNote: "涤棉斜纹，库存已确认"
    },
    accessories: {
      zipper: "5号树脂拉链",
      buttonType: "四合扣",
      reflective: "前胸和后背反光条",
      thread: "藏青线",
      label: "主标+洗水标",
      hangtag: "需要吊牌"
    },
    customization: {
      type: "刺绣",
      content: "客户logo",
      position: "左胸",
      logoReady: true,
      effectReady: true
    },
    technical: {
      owner: "孙昌旭",
      confirmed: true,
      note: "左胸刺绣宽 8cm，反光条按样衣位置。"
    },
    procurement: {
      owner: "江悦",
      confirmed: true,
      note: "面料和辅料均有库存。"
    },
    risks: [],
    inspection: { counted: false, passed: false, photoCount: 0 },
    ...overrides
  };
}

test("production-ready review order scores 10 and can be approved", () => {
  const order = productionReadyOrder();
  const result = scoreOrder(order, new Date("2026-06-13"));

  assert.equal(result.score, 10);
  assert.equal(result.missing.length, 0);
  assert.equal(totalQuantity(order), 30);
  assert.equal(canApproveOrder(order), true);
});

test("low score order cannot be approved or assigned", () => {
  const order = productionReadyOrder({
    status: "needs_info",
    customerName: "",
    dueDate: "",
    items: [{ product: "单衣", quantities: {} }],
    material: { mainColor: "", contrastColor: "", lining: "", filling: "", fabricNote: "" },
    accessories: {},
    customization: {},
    technical: { confirmed: false },
    procurement: { confirmed: false }
  });
  const result = scoreOrder(order, new Date("2026-06-13"));

  assert.equal(result.score < 9, true);
  assert.equal(canSubmitForReview(order), false);
  assert.equal(canApproveOrder(order), false);
  assert.equal(canAssignFactory(order), false);
  assert.equal(result.missing.some((item) => item.key === "sizes"), true);
});

test("factory assignment requires allocation status and score above 9", () => {
  const reviewOrder = productionReadyOrder({ status: "review" });
  const allocationOrder = productionReadyOrder({ status: "allocation" });

  assert.equal(canAssignFactory(reviewOrder), false);
  assert.equal(canAssignFactory(allocationOrder), true);
});

test("risk and overdue checks reduce score below release threshold", () => {
  const riskyOrder = productionReadyOrder({ risks: ["质检返工"] });
  const overdueOrder = productionReadyOrder({ dueDate: "2026-06-01" });

  assert.equal(scoreOrder(riskyOrder, new Date("2026-06-13")).score, 8.9);
  assert.equal(scoreOrder(overdueOrder, new Date("2026-06-13")).score, 8.9);
});

test("shipping requires counted quantity, passed inspection, and photos", () => {
  const order = productionReadyOrder({
    status: "ready_ship",
    factoryId: "factory-1",
    inspection: { counted: true, passed: true, photoCount: 2 }
  });
  const missingPhotoOrder = productionReadyOrder({
    status: "ready_ship",
    factoryId: "factory-1",
    inspection: { counted: true, passed: true, photoCount: 0 }
  });

  assert.equal(getInspectionReadyStatus(order), true);
  assert.equal(canShipOrder(order), true);
  assert.equal(canShipOrder(missingPhotoOrder), false);
});
