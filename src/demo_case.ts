const serviceURL = process.env.LEGAL_WORKFLOW_URL ?? "http://localhost:3000";

const response = await fetch(`${serviceURL}/workflow`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    stage: "deadline_follow_up",
    matterId: "matter-1042",
    deadline: "2027-01-15",
    openItems: ["client affidavit", "filing authorization"],
  }),
});

const result = await response.json();
if (!response.ok) {
  throw new Error(`Workflow request failed (${response.status}): ${JSON.stringify(result)}`);
}
console.log(JSON.stringify(result, null, 2));
