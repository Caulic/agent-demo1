# API 参考

Base URL（本地开发）：`http://localhost:4111`

## 目录

- [Agent](#agent)
  - [generate — 单次生成](#post-apiagentsrising-stars-agentgenerate)
  - [stream — 流式生成](#post-apiagentsrising-stars-agentstream)
- [Workflow](#workflow)
  - [start-async — 同步执行](#post-apiworkflowsecosystem-reportstart-async)
  - [查询 Workflow 列表](#get-apiworkflows)

---

## Agent

Agent ID：`rising-stars-agent`

### POST `/api/agents/rising-stars-agent/generate`

单次生成，等待完整响应后返回。

**Request Body**

```json
{
  "messages": [
    { "role": "user", "content": "string" }
  ]
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `messages` | array | ✓ | 对话消息列表 |
| `messages[].role` | `"user"` \| `"assistant"` | ✓ | 消息角色 |
| `messages[].content` | string | ✓ | 消息内容 |

**Response**

```json
{
  "text": "## 热门 JS 项目\n\n...",
  "usage": {
    "promptTokens": 2048,
    "completionTokens": 512,
    "totalTokens": 2560
  }
}
```

**示例**

```bash
curl -X POST http://localhost:4111/api/agents/rising-stars-agent/generate \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      { "role": "user", "content": "2024年最受关注的前5个JS项目是什么？" }
    ]
  }'
```

---

### POST `/api/agents/rising-stars-agent/stream`

流式生成，以 SSE（Server-Sent Events）格式逐步返回内容。

**Request Body**：同 `/generate`

**Response**：SSE 流

```
data: {"type":"text-delta","textDelta":"## "}
data: {"type":"text-delta","textDelta":"热门"}
data: {"type":"finish","finishReason":"stop"}
```

**示例**

```bash
curl -X POST http://localhost:4111/api/agents/rising-stars-agent/stream \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      { "role": "user", "content": "分析一下 React 生态的现状" }
    ]
  }'
```

---

## Workflow

Workflow ID：`ecosystem-report`

### POST `/api/workflows/ecosystem-report/start-async`

触发 Workflow 并等待所有步骤执行完成后返回。

**Request Body**

```json
{
  "inputData": {
    "limit": 30,
    "tag": "react"
  }
}
```

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `inputData.limit` | number | — | `50` | 分析的项目数量（建议 20–50） |
| `inputData.tag` | string | — | — | 按 tag 过滤，留空则分析全部分类 |

**Response**

```json
{
  "status": "success",
  "input": { "limit": 30 },
  "stepExecutionPath": ["fetch-projects", "analyze-projects", "generate-report"],
  "steps": {
    "fetch-projects": {
      "status": "success",
      "output": {
        "projects": [ ... ],
        "updatedAt": "2024-08-10T21:30:55.705Z",
        "totalTracked": 2005
      },
      "startedAt": 1772943840292,
      "endedAt": 1772943841754
    },
    "analyze-projects": {
      "status": "success",
      "output": {
        "topCategories": [
          {
            "name": "react",
            "count": 6,
            "totalYearlyGain": 117357,
            "topProject": "shadcn/ui"
          }
        ],
        "topProjects": [ ... ],
        "totalYearlyStars": 349771,
        "updatedAt": "2024-08-10T21:30:55.705Z"
      }
    },
    "generate-report": {
      "status": "success",
      "output": {
        "report": "# 2024 JS 生态系统趋势报告\n\n...",
        "generatedAt": "2026-03-08T04:24:39.255Z"
      }
    }
  },
  "result": {
    "report": "# 2024 JS 生态系统趋势报告\n\n...",
    "generatedAt": "2026-03-08T04:24:39.255Z"
  }
}
```

**步骤说明**

| 步骤 | ID | 输入 | 输出 |
|------|-----|------|------|
| 1 | `fetch-projects` | `limit`, `tag?` | `projects[]`, `updatedAt`, `totalTracked` |
| 2 | `analyze-projects` | Step 1 输出 | `topCategories[]`, `topProjects[]`, `totalYearlyStars` |
| 3 | `generate-report` | Step 2 输出 | `report` (Markdown), `generatedAt` |

**错误响应**

```json
{
  "status": "failed",
  "steps": {
    "fetch-projects": {
      "status": "failed",
      "error": "Failed to fetch: 503"
    }
  }
}
```

**示例：基础调用**

```bash
curl -X POST http://localhost:4111/api/workflows/ecosystem-report/start-async \
  -H "Content-Type: application/json" \
  -d '{"inputData": {"limit": 30}}'
```

**示例：按分类过滤**

```bash
# 只分析 React 相关项目
curl -X POST http://localhost:4111/api/workflows/ecosystem-report/start-async \
  -H "Content-Type: application/json" \
  -d '{"inputData": {"limit": 20, "tag": "react"}}'

# 只分析构建工具
curl -X POST http://localhost:4111/api/workflows/ecosystem-report/start-async \
  -H "Content-Type: application/json" \
  -d '{"inputData": {"limit": 20, "tag": "bundler"}}'
```

---

### GET `/api/workflows`

查询所有已注册的 Workflow 及其步骤定义（含输入/输出 Schema）。

**示例**

```bash
curl http://localhost:4111/api/workflows
```
