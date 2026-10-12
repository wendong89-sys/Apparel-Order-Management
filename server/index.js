import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import {
  canAcceptFactoryOrder,
  canApproveOrder,
  canAssignFactory,
  canCompleteOrder,
  canSendToInspection,
  canShipOrder,
  factories,
  scoreOrder
} from "../src/domain.js";
import { authenticate, login } from "./auth.js";
import { ensureDataStore, findOrder, readOrders, upsertOrder, writeOrders } from "./store.js";

const PORT = Number(process.env.PORT || 3000);
const PUBLIC_DIR = process.env.PUBLIC_DIR || join(process.cwd(), "dist");
const DEV_PUBLIC_DIR = process.env.DEV_PUBLIC_DIR || process.cwd();

export async function createAppServer() {
  await ensureDataStore();

  return createServer(async (req, res) => {
    try {
      await route(req, res);
    } catch (error) {
      console.error(error);
      sendJson(res, 500, { error: "服务器内部错误" });
    }
  });
}

async function route(req, res) {
  const url = new URL(req.url, "http://localhost");

  if (req.method === "OPTIONS") return sendNoContent(res);
  if (url.pathname === "/api/health" && req.method === "GET") {
    return sendJson(res, 200, { ok: true, mode: "api", locale: "zh-CN", message: "服务正常" });
  }
  if (url.pathname === "/api/auth/login" && req.method === "POST") return handleLogin(req, res);

  if (url.pathname.startsWith("/api/")) {
    const user = authenticate(req);
    if (!user) return sendJson(res, 401, { error: "未登录或登录已过期" });
    return handleApi(req, res, url, user);
  }

  return serveStatic(req, res, url);
}

async function handleLogin(req, res) {
  const body = await readBody(req);
  const session = await login(body.username, body.password);
  if (!session) return sendJson(res, 401, { error: "用户名或密码错误" });
  return sendJson(res, 200, session);
}

async function handleApi(req, res, url, user) {
  if (url.pathname === "/api/factories" && req.method === "GET") {
    return sendJson(res, 200, factories);
  }

  if (url.pathname === "/api/orders" && req.method === "GET") {
    return sendJson(res, 200, await readOrders());
  }

  if (url.pathname === "/api/orders" && req.method === "PUT") {
    const orders = await readBody(req);
    if (!Array.isArray(orders)) return sendJson(res, 400, { error: "订单数据必须是数组" });
    await writeOrders(orders);
    return sendJson(res, 200, orders);
  }

  if (url.pathname === "/api/orders" && req.method === "POST") {
    const order = await readBody(req);
    await upsertOrder(order);
    return sendJson(res, 201, order);
  }

  const orderMatch = url.pathname.match(/^\/api\/orders\/([^/]+)$/);
  if (orderMatch && req.method === "GET") {
    const order = await findOrder(orderMatch[1]);
    if (!order) return sendJson(res, 404, { error: "订单不存在" });
    return sendJson(res, 200, order);
  }

  if (orderMatch && req.method === "PATCH") {
    const order = await findOrder(orderMatch[1]);
    if (!order) return sendJson(res, 404, { error: "订单不存在" });
    const patch = await readBody(req);
    const updated = { ...order, ...patch };
    await upsertOrder(updated);
    return sendJson(res, 200, updated);
  }

  const scoreMatch = url.pathname.match(/^\/api\/orders\/([^/]+)\/score$/);
  if (scoreMatch && req.method === "GET") {
    const order = await findOrder(scoreMatch[1]);
    if (!order) return sendJson(res, 404, { error: "订单不存在" });
    return sendJson(res, 200, scoreOrder(order));
  }

  const actionMatch = url.pathname.match(/^\/api\/orders\/([^/]+)\/actions$/);
  if (actionMatch && req.method === "POST") {
    const order = await findOrder(actionMatch[1]);
    if (!order) return sendJson(res, 404, { error: "订单不存在" });
    const body = await readBody(req);
    const result = applyAction(order, body, user);
    if (!result.ok) return sendJson(res, 422, { error: result.error, score: scoreOrder(order) });
    await upsertOrder(result.order);
    return sendJson(res, 200, result.order);
  }

  return sendJson(res, 404, { error: "接口不存在" });
}

function applyAction(order, body, user) {
  const actor = user.name || user.username;
  const action = body.action;
  const result = scoreOrder(order);

  if (action === "submit") {
    if (result.score < 6 || !["draft", "needs_info"].includes(order.status)) return fail("低于 6 分不能提交审核");
    order.status = result.score >= 9 ? "review" : "needs_info";
    addLog(order, actor, `提交审核，当前评分 ${result.score}`);
    return ok(order);
  }

  if (action === "approve") {
    if (!canApproveOrder(order)) return fail("只有 9 分以上且待审核订单才能审核通过");
    order.status = "allocation";
    addLog(order, actor, "审核通过，进入待分厂");
    return ok(order);
  }

  if (action === "assign") {
    if (!canAssignFactory(order)) return fail("只有 9 分以上且待分厂订单才能下发工厂");
    if (!factories.some((factory) => factory.id === body.factoryId)) return fail("请选择有效工厂");
    order.factoryId = body.factoryId;
    order.assignmentReason = body.reason || "评分达到 9 分，资料完整，可生产";
    order.status = "assigned";
    addLog(order, actor, `下发至 ${order.factoryId}：${order.assignmentReason}`);
    return ok(order);
  }

  if (action === "accept") {
    if (!canAcceptFactoryOrder(order)) return fail("只有已下发工厂订单才能接单");
    order.status = "accepted";
    order.steps.accepted = "已完成";
    addLog(order, actor, "工厂确认接单");
    return ok(order);
  }

  if (action === "inspection") {
    if (!canSendToInspection(order)) return fail("只有生产中订单才能送检");
    order.status = "inspection";
    addLog(order, actor, "生产完成，送交质检");
    return ok(order);
  }

  if (action === "ship") {
    if (!canShipOrder(order)) return fail("出货前必须完成点数、质检通过并上传照片");
    order.status = "shipped";
    order.steps.shipping = "已完成";
    addLog(order, actor, "确认出货");
    return ok(order);
  }

  if (action === "complete") {
    if (!canCompleteOrder(order)) return fail("只有已出货订单才能完成");
    order.status = "completed";
    addLog(order, actor, "订单完成并归档");
    return ok(order);
  }

  return fail("未知动作");
}

function ok(order) {
  return { ok: true, order };
}

function fail(error) {
  return { ok: false, error };
}

function addLog(order, actor, action) {
  order.logs ||= [];
  order.logs.unshift({ id: cryptoRandomId(), actor, action, time: new Date().toLocaleString("zh-CN", { hour12: false }) });
}

function cryptoRandomId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
}

async function serveStatic(req, res, url) {
  const baseDir = existsSync(PUBLIC_DIR) ? PUBLIC_DIR : DEV_PUBLIC_DIR;
  const requested = url.pathname === "/" ? "/index.html" : url.pathname;
  const filePath = normalize(join(baseDir, requested));
  if (!filePath.startsWith(normalize(baseDir))) return sendJson(res, 403, { error: "禁止访问" });

  try {
    const file = await readFile(filePath);
    res.writeHead(200, { "Content-Type": contentType(filePath) });
    res.end(file);
  } catch {
    const indexPath = join(baseDir, "index.html");
    const file = await readFile(indexPath);
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(file);
  }
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  return JSON.parse(raw);
}

function sendJson(res, statusCode, body) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,OPTIONS"
  });
  res.end(JSON.stringify(body));
}

function sendNoContent(res) {
  res.writeHead(204, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,OPTIONS"
  });
  res.end();
}

function contentType(filePath) {
  const types = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".svg": "image/svg+xml"
  };
  return types[extname(filePath)] || "application/octet-stream";
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const server = await createAppServer();
  server.listen(PORT, () => {
    console.log(`服装定制订单系统服务端已启动：http://127.0.0.1:${PORT}`);
  });
}
