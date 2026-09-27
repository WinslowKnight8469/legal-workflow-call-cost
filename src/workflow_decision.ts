import { z } from "zod";

const matterIntake = z.object({
  stage: z.literal("matter_intake"),
  matterId: z.string().min(1),
  clientSummary: z.string().min(20),
});

const signedDelivery = z.object({
  stage: z.literal("signed_document_delivery"),
  matterId: z.string().min(1),
  documentName: z.string().min(1),
  recipient: z.string().email(),
});

const deadlineFollowUp = z.object({
  stage: z.literal("deadline_follow_up"),
  matterId: z.string().min(1),
  deadline: z.string().date(),
  openItems: z.array(z.string().min(1)).min(1),
});

export const workflowRequestSchema = z.discriminatedUnion("stage", [
  matterIntake,
  signedDelivery,
  deadlineFollowUp,
]);

export type WorkflowRequest = z.infer<typeof workflowRequestSchema>;

export type WorkflowDecision = {
  action: "classify_matter" | "draft_delivery_note" | "draft_deadline_follow_up";
  systemInstruction: string;
  facts: string;
};

export function decideWorkflow(input: WorkflowRequest, today = new Date()): WorkflowDecision {
  if (input.stage === "matter_intake") {
    return {
      action: "classify_matter",
      systemInstruction: "Classify the legal matter and return a terse intake summary with risks and next action.",
      facts: `Matter ${input.matterId}. Client summary: ${input.clientSummary}`,
    };
  }

  if (input.stage === "signed_document_delivery") {
    return {
      action: "draft_delivery_note",
      systemInstruction: "Draft a concise delivery note for a signed legal document. State the document and recipient.",
      facts: `Matter ${input.matterId}. Deliver ${input.documentName} to ${input.recipient}.`,
    };
  }

  const due = new Date(`${input.deadline}T00:00:00Z`);
  const daysRemaining = Math.ceil((due.getTime() - today.getTime()) / 86_400_000);
  const urgency = daysRemaining <= 3 ? "urgent" : "routine";
  return {
    action: "draft_deadline_follow_up",
    systemInstruction: `Draft a ${urgency} deadline follow-up. Include the date and every open item.`,
    facts: `Matter ${input.matterId}. Deadline ${input.deadline}. Open items: ${input.openItems.join("; ")}.`,
  };
}
