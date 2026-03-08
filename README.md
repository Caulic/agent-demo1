# agent-demo1 使用文档

基于 [Mastra](https://mastra.ai) 框架构建的 JavaScript 生态系统分析服务，数据来源为 [bestofjs](https://bestofjs.org)（即 risingstars.js.org 的数据源）。

## 目录

- [快速开始](#快速开始)
- [项目结构](#项目结构)
- [Agent：JS Rising Stars](#agentjs-rising-stars)
- [Workflow：生态报告](#workflow生态报告)
- [Tools](#tools)
- [部署到 Cloudflare](#部署到-cloudflare)
- [API 参考](./api-reference.md)

---

## 快速开始

### 前置条件

- Node.js 18+
- OpenAI 兼容 API Key（本项目使用 [api.n.cv](https://api.n.cv)）

### 安装与启动

```bash
# 安装依赖
npm install

# 配置环境变量
cp .env.example .env
# 编辑 .env，填入你的 API Key：
# OPENAI_API_KEY=your_api_key_here

# 启动开发服务器
npm run dev
```

服务启动后：
- **HTTP API**：`http://localhost:4111`
- **可视化 Studio**：`http://localhost:4111` （浏览器打开）

---

## 项目结构

```
src/
├── mastra/
│   └── index.ts          # Mastra 入口，注册 agent 和 workflow
├── agents/
│   └── risingstarsAgent.ts   # JS Rising Stars Agent
├── tools/
│   └── risingstars.ts    # 数据获取工具集
└── workflows/
    └── ecosystemReport.ts    # 生态报告 Workflow（3 步流水线）
```

---

## Agent：JS Rising Stars

一个专注于 JavaScript 生态分析的对话式 Agent。每次调用时自动拉取 bestofjs 最新数据注入上下文，无需手动传入数据。

**调用方式：**

```bash
curl -X POST http://localhost:4111/api/agents/rising-stars-agent/generate \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      { "role": "user", "content": "列出最热门的5个JS项目，简要介绍" }
    ]
  }'
```

**示例问题：**

```bash
# 按分类提问
"React 生态今年有哪些值得关注的项目？"

# 对比分析
"Bun 和 Node.js 相比有什么优势？"

# 趋势分析
"2024 年 JS 生态整体趋势是什么？"
```

更多 Agent API 详见 [API 参考 → Agent](./api-reference.md#agent)。

---

## Workflow：生态报告

一个自动化的 3 步数据处理流水线，最终由 AI 生成完整的生态分析报告。

```
输入参数
  ↓
Step 1: fetch-projects    拉取 bestofjs 热门项目数据
  ↓
Step 2: analyze-projects  按分类聚合，计算各维度统计
  ↓
Step 3: generate-report   调用 AI Agent 生成完整 Markdown 报告
  ↓
输出：Markdown 格式报告
```

**触发方式：**

```bash
curl -X POST http://localhost:4111/api/workflows/ecosystem-report/start-async \
  -H "Content-Type: application/json" \
  -d '{
    "inputData": {
      "limit": 30
    }
  }'
```

**按分类过滤（可选）：**

```bash
curl -X POST http://localhost:4111/api/workflows/ecosystem-report/start-async \
  -H "Content-Type: application/json" \
  -d '{
    "inputData": {
      "limit": 20,
      "tag": "react"
    }
  }'
```

**常用 tag 值：**

| tag | 说明 |
|-----|------|
| `react` | React 相关项目 |
| `vue` | Vue 相关项目 |
| `nodejs-framework` | Node.js 服务端框架 |
| `bundler` | 构建工具 |
| `testing` | 测试工具 |
| `fullstack` | 全栈框架 |
| `desktop` | 桌面应用 |
| `learning` | 学习资源 |

**输出结构：**

```json
{
  "status": "success",
  "result": {
    "report": "# 2024 JS 生态系统趋势报告\n...",
    "generatedAt": "2026-03-08T04:24:39.255Z"
  },
  "steps": {
    "fetch-projects": { "status": "success", "output": { ... } },
    "analyze-projects": { "status": "success", "output": { ... } },
    "generate-report": { "status": "success", "output": { ... } }
  }
}
```

更多 Workflow API 详见 [API 参考 → Workflow](./api-reference.md#workflow)。

---

## Tools

工具模块 `src/tools/risingstars.ts` 提供三个可复用工具，可单独调用或在 Workflow 中使用。

### `getRisingStarsTool`

获取按年度 star 增长排序的热门项目列表。

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `limit` | number | 20 | 返回项目数量 |
| `tag` | string | — | 按 tag 过滤 |

### `getProjectDetailsTool`

获取指定项目的详细信息（包含各维度增长趋势）。

| 参数 | 类型 | 说明 |
|------|------|------|
| `repoFullName` | string | GitHub 仓库全名，如 `facebook/react` |

### `getCategoryBreakdownTool`

按分类统计热门项目，返回各分类的项目数量和总 star 增长。

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `limit` | number | 100 | 分析的项目数量 |
| `topN` | number | 10 | 返回的顶部分类数 |

---

## 部署到 Cloudflare

项目已配置 `CloudflareDeployer`，可一键部署到 Cloudflare Workers。

### 步骤

**1. 登录 Cloudflare**

```bash
npx wrangler login
```

**2. 构建项目**

```bash
npm run build
```

**3. 部署**

```bash
npm run deploy
```

**4. 配置环境变量**

部署后需在 Cloudflare Dashboard 或通过 CLI 设置 Secret：

```bash
npx wrangler secret put OPENAI_API_KEY
# 输入你的 API Key
```

部署完成后，服务地址格式为：
```
https://agent-demo1.<your-account>.workers.dev
```

所有 API 路径与本地开发完全相同，只需替换 base URL。
