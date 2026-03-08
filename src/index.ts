import "dotenv/config";
import { Mastra } from "@mastra/core";
import { risingStarsAgent } from "./agents/risingstarsAgent.js";

const mastra = new Mastra({
  agents: {
    risingStarsAgent,
  },
});

async function main() {
  const agent = mastra.getAgent("risingStarsAgent");

  const query =
    process.argv[2] ?? "列出当前最热门的20个 JavaScript 项目，并分类做简要介绍";

  console.log(`\n🔍 查询: ${query}\n`);
  console.log("=".repeat(60));

  const result = await agent.generate(query);
  console.log(result.text);
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
