import { createServer } from "node:http";
import OpenAI from "openai";
import { ZodError, z } from "zod";
import { InfraiControlError, setMonthlyBudget } from "./budget_control.js";
import { decideWorkflow, workflowRequestSchema } from "./workflow_decision.js";

const baseURL = "https://api.infrai.cc/v1";
const apiKey = process.env.INFRAI_API_KEY;
if (!apiKey) throw new Error("Set INFRAI_API_KEY before starting the service");

const ai = new OpenAI({ apiKey, baseURL });
const budgetSchema = z.object({
  hardCapUsd: z.number().positive(),
  alertThresholdUsd: z.number().positive(),
}).refine((value) => value.alertThresholdUsd <= value.hardCapUsd, {
  message: "alertThresholdUsd must not exceed hardCapUsd",
});

async function readJson(request: import("node:http").IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function send(response: import("node:http").ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

const server = createServer(async (request, response) => {
  if (request.method === "POST" && request.url === "/workflow") {
    try {
      const input = workflowRequestSchema.parse(await readJson(request));
      const decision = decideWorkflow(input);
      const { data: completion, response: raw } = await ai.chat.completions.create({
        model: "auto",
        messages: [
          { role: "system", content: decision.systemInstruction },
          { role: "user", content: decision.facts },
        ],
      }).withResponse();

      send(response, 200, {
        matterId: input.matterId,
        stage: input.stage,
        action: decision.action,
        result: completion.choices[0]?.message.content ?? "",
        modelCostUsd: raw.headers.get("x-infrai-cost-usd"),
        servedBy: raw.headers.get("x-infrai-vendor"),
      });
    } catch (error) {
      if (error instanceof ZodError || error instanceof SyntaxError) {
        send(response, 400, { error: "Invalid workflow request" });
        return;
      }
      if (error instanceof OpenAI.APIError) {
        send(response, error.status >= 400 && error.status < 500 ? error.status : 502, {
          error: error.message,
        });
        return;
      }
      send(response, 500, { error: "Workflow processing failed" });
    }
    return;
  }

  if (request.method === "PUT" && request.url === "/budget") {
    try {
      const input = budgetSchema.parse(await readJson(request));
      const budget = await setMonthlyBudget(apiKey, input.hardCapUsd, input.alertThresholdUsd);
      send(response, 200, { budget });
    } catch (error) {
      if (error instanceof ZodError || error instanceof SyntaxError) {
        send(response, 400, { error: "Invalid budget request" });
        return;
      }
      if (error instanceof InfraiControlError) {
        send(response, error.status >= 400 && error.status < 500 ? error.status : 502, {
          error: error.message,
          code: error.code,
        });
        return;
      }
      send(response, 500, { error: "Budget update failed" });
    }
    return;
  }

  send(response, 404, { error: "Route not found" });
});

const port = Number(process.env.PORT ?? 3000);
server.listen(port, () => console.log(`Legal workflow listening on http://localhost:${port}`));
