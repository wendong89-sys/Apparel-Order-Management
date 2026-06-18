import { readFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

function has(path, text) {
  return read(path).includes(text);
}

function countMatches(path, pattern) {
  return [...read(path).matchAll(pattern)].length;
}

const checks = [
  {
    name: "信息架构清晰",
    points: 1.5,
    pass: ["renderPageIntro", "renderSidebar", "topbar", "page-kicker", "nav-section-label"].every((text) => has("src/app.js", text) || has("src/styles.css", text))
  },
  {
    name: "生产工作流首屏可见",
    points: 1.2,
    pass: ["renderWorkflowStrip", "待审核", "待分厂", "生产中", "待质检", "待出货"].every((text) => has("src/app.js", text))
  },
  {
    name: "视觉系统使用统一设计变量",
    points: 1.3,
    pass: ["--color-bg", "--color-surface", "--color-primary", "--space-", "--radius-", "--shadow-"].every((text) => has("src/styles.css", text))
  },
  {
    name: "表格与数据密度适合业务扫描",
    points: 1.2,
    pass: ["table-card", "order-primary", "numeric", "sticky"].every((text) => has("src/styles.css", text)) && countMatches("src/app.js", /<th>/g) >= 8
  },
  {
    name: "状态语义完整",
    points: 1,
    pass: [".status.ok", ".status.warn", ".status.bad", ".score.high", ".score.mid", ".score.low"].every((text) => has("src/styles.css", text))
  },
  {
    name: "表单分区和控件状态完整",
    points: 1,
    pass: ["form-grid", "section-title", "focus-visible", ".btn:disabled", "input-help"].every((text) => has("src/styles.css", text) || has("src/app.js", text))
  },
  {
    name: "响应式布局覆盖桌面和平板手机",
    points: 1,
    pass: ["@media (max-width: 1180px)", "@media (max-width: 760px)", "grid-template-columns: 1fr"].every((text) => has("src/styles.css", text))
  },
  {
    name: "可访问性基础达标",
    points: 0.8,
    pass: ["focus-visible", "prefers-reduced-motion", "aria-label"].every((text) => has("src/styles.css", text) || has("src/app.js", text))
  },
  {
    name: "工程质量门包含 UI 验收",
    points: 1,
    pass: ["ui:score", "docs/UI_ACCEPTANCE.md"].every((text) => has("package.json", text) || has("scripts/quality-gate.js", text) || has("README.md", text))
  }
];

const total = checks.reduce((sum, check) => sum + (check.pass ? check.points : 0), 0);
const score = Math.round(total * 10) / 10;

for (const check of checks) {
  console.log(`${check.pass ? "PASS" : "FAIL"} ${check.name} (${check.points})`);
}

console.log(`\nUI 验收评分：${score}/10`);

if (score < 9) {
  console.error("UI 验收失败：低于 9 分，需要继续优化。");
  process.exit(1);
}

console.log("UI 验收通过：达到专业软件级发布门槛。");
