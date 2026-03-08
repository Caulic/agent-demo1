import 'dotenv/config';
import { Mastra } from '@mastra/core';
import { Agent } from '@mastra/core/agent';
import { createOpenAI } from '@ai-sdk/openai';

"use strict";
const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) throw new Error("Missing environment variable: OPENAI_API_KEY");
const provider = createOpenAI({
  baseURL: "https://api.n.cv/v1",
  apiKey
});
const BESTOFJS_API = "https://bestofjs-static-api.vercel.app/projects.json";
async function fetchTopProjects(limit = 30) {
  const res = await fetch(BESTOFJS_API);
  const data = await res.json();
  return data.projects.filter((p) => (p.trends?.yearly ?? 0) > 0).sort((a, b) => (b.trends?.yearly ?? 0) - (a.trends?.yearly ?? 0)).slice(0, limit).map((p) => ({
    name: p.name,
    repo: p.full_name,
    description: p.description,
    totalStars: p.stars,
    yearlyGain: p.trends?.yearly ?? 0,
    tags: p.tags.map((t) => data.tags[t]?.name ?? t),
    url: p.url ?? `https://github.com/${p.full_name}`
  }));
}
const injectRisingStarsData = {
  id: "inject-rising-stars",
  async processInput({ messages }) {
    const projects = await fetchTopProjects();
    const dataContext = `

\u4EE5\u4E0B\u662F\u6765\u81EA risingstars.js.org \u7684\u6700\u65B0\u70ED\u95E8\u9879\u76EE\u6570\u636E\uFF08\u6309\u5E74\u5EA6 star \u589E\u957F\u6392\u5E8F\uFF09\uFF1A
\`\`\`json
${JSON.stringify(projects, null, 2)}
\`\`\`

\u8BF7\u57FA\u4E8E\u4EE5\u4E0A\u6570\u636E\u56DE\u7B54\u7528\u6237\u7684\u95EE\u9898\u3002`;
    const msgs = messages.getMessages();
    const lastUserIndex = [...msgs].reverse().findIndex((m) => m.role === "user");
    if (lastUserIndex !== -1) {
      const idx = msgs.length - 1 - lastUserIndex;
      const msg = msgs[idx];
      if (typeof msg.content === "string") {
        msgs[idx] = { ...msg, content: msg.content + dataContext };
      }
    }
    return messages;
  }
};
const risingStarsAgent = new Agent({
  id: "rising-stars-agent",
  name: "JS Rising Stars Agent",
  instructions: `\u4F60\u662F\u4E00\u540D JavaScript \u751F\u6001\u7CFB\u7EDF\u4E13\u5BB6\u5206\u6790\u5E08\uFF0C\u5E2E\u52A9\u7528\u6237\u4E86\u89E3\u6765\u81EA risingstars.js.org \u7684\u70ED\u95E8\u5F00\u6E90\u9879\u76EE\u3002
\u6839\u636E\u63D0\u4F9B\u7684\u9879\u76EE\u6570\u636E\u8FDB\u884C\u5206\u6790\uFF1A
- \u6309\u7C7B\u522B\u5206\u7EC4\u4ECB\u7ECD
- \u8BF4\u660E\u9879\u76EE\u53D7\u6B22\u8FCE\u7684\u539F\u56E0
- \u7528\u6E05\u6670\u7684 Markdown \u683C\u5F0F\u8F93\u51FA
- \u59CB\u7EC8\u7528\u4E2D\u6587\u56DE\u7B54`,
  model: provider.responses("gpt-5.3-codex"),
  inputProcessors: [injectRisingStarsData]
});

"use strict";
const mastra = new Mastra({
  agents: {
    risingStarsAgent
  }
});

export { mastra };
