import assert from "node:assert/strict";
import test from "node:test";
import { decideWorkflow, workflowRequestSchema } from "../src/workflow_decision.js";

test("a deadline within three days gets an urgent follow-up", () => {
  const input = workflowRequestSchema.parse({
    stage: "deadline_follow_up",
    matterId: "matter-1042",
    deadline: "2026-10-03",
    openItems: ["client affidavit", "filing authorization"],
  });

  const decision = decideWorkflow(input, new Date("2026-09-30T12:00:00Z"));

  assert.equal(decision.action, "draft_deadline_follow_up");
  assert.match(decision.systemInstruction, /urgent/);
  assert.match(decision.facts, /client affidavit; filing authorization/);
});

test("signed delivery rejects a malformed recipient before model spend", () => {
  const result = workflowRequestSchema.safeParse({
    stage: "signed_document_delivery",
    matterId: "matter-1042",
    documentName: "Settlement agreement",
    recipient: "not-an-email",
  });

  assert.equal(result.success, false);
});
