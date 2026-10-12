import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

async function withServer(run) {
  const dataDir = await mkdtemp(join(tmpdir(), "garment-system-"));
  process.env.DATA_DIR = dataDir;
  const { createAppServer } = await import(`../server/index.js?test=${Date.now()}-${Math.random()}`);
  const server = await createAppServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;
  try {
    await run(baseUrl);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await rm(dataDir, { recursive: true, force: true });
    delete process.env.DATA_DIR;
  }
}

async function login(baseUrl) {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "admin", password: "admin123" })
  });
  assert.equal(response.status, 200);
  const session = await response.json();
  assert.equal(Boolean(session.token), true);
  return session.token;
}

function authHeaders(token) {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`
  };
}

test("server exposes health, login, and authenticated orders", async () => {
  await withServer(async (baseUrl) => {
    const health = await fetch(`${baseUrl}/api/health`);
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), { ok: true, mode: "api", locale: "zh-CN", message: "服务正常" });

    const token = await login(baseUrl);
    const orders = await fetch(`${baseUrl}/api/orders`, { headers: authHeaders(token) });
    assert.equal(orders.status, 200);
    const payload = await orders.json();
    assert.equal(Array.isArray(payload), true);
    assert.equal(payload.length, 1);
  });
});

test("server rejects unauthenticated order access", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/orders`);
    assert.equal(response.status, 401);
  });
});

test("server enforces approve then assign workflow for 9 point orders", async () => {
  await withServer(async (baseUrl) => {
    const token = await login(baseUrl);
    const ordersResponse = await fetch(`${baseUrl}/api/orders`, { headers: authHeaders(token) });
    const [order] = await ordersResponse.json();

    const assignBeforeApprove = await fetch(`${baseUrl}/api/orders/${order.id}/actions`, {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({ action: "assign", factoryId: "factory-1" })
    });
    assert.equal(assignBeforeApprove.status, 422);

    const approve = await fetch(`${baseUrl}/api/orders/${order.id}/actions`, {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({ action: "approve" })
    });
    assert.equal(approve.status, 200);
    assert.equal((await approve.json()).status, "allocation");

    const assign = await fetch(`${baseUrl}/api/orders/${order.id}/actions`, {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({ action: "assign", factoryId: "factory-1", reason: "产能充足" })
    });
    assert.equal(assign.status, 200);
    const assigned = await assign.json();
    assert.equal(assigned.status, "assigned");
    assert.equal(assigned.factoryId, "factory-1");
  });
});

test("server blocks low-score order assignment", async () => {
  await withServer(async (baseUrl) => {
    const token = await login(baseUrl);
    const lowOrder = {
      id: "low-order",
      number: "GD-LOW",
      customerName: "",
      contactName: "",
      phone: "",
      orderDate: "2026-06-13",
      dueDate: "",
      status: "allocation",
      items: [{ product: "单衣", quantities: {} }],
      material: {},
      accessories: {},
      customization: {},
      technical: {},
      procurement: {},
      inspection: { counted: false, passed: false, photoCount: 0 },
      risks: [],
      logs: []
    };

    const create = await fetch(`${baseUrl}/api/orders`, {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify(lowOrder)
    });
    assert.equal(create.status, 201);

    const assign = await fetch(`${baseUrl}/api/orders/low-order/actions`, {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({ action: "assign", factoryId: "factory-1" })
    });
    assert.equal(assign.status, 422);
    const body = await assign.json();
    assert.equal(body.score.score < 9, true);
  });
});

test("server blocks shipping before inspection requirements are met", async () => {
  await withServer(async (baseUrl) => {
    const token = await login(baseUrl);
    const ordersResponse = await fetch(`${baseUrl}/api/orders`, { headers: authHeaders(token) });
    const [order] = await ordersResponse.json();
    order.status = "ready_ship";
    order.inspection = { counted: true, passed: true, photoCount: 0 };

    const update = await fetch(`${baseUrl}/api/orders/${order.id}`, {
      method: "PATCH",
      headers: authHeaders(token),
      body: JSON.stringify(order)
    });
    assert.equal(update.status, 200);

    const ship = await fetch(`${baseUrl}/api/orders/${order.id}/actions`, {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({ action: "ship" })
    });
    assert.equal(ship.status, 422);
  });
});
