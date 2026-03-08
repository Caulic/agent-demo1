import "dotenv/config";
import { Mastra } from "@mastra/core";
import { CloudflareDeployer } from "@mastra/deployer-cloudflare";
import { risingStarsAgent } from "../agents/risingstarsAgent.js";
import { ecosystemReportWorkflow } from "../workflows/ecosystemReport.js";

export const mastra = new Mastra({
  agents: {
    risingStarsAgent,
  },
  workflows: {
    ecosystemReportWorkflow,
  },
  deployer: new CloudflareDeployer({
    name: "agent-demo1",
  }),
});
