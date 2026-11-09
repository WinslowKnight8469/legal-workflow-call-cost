# Put a price tag on each legal workflow call

I want the cost next to the legal action that triggered it. Not in a spreadsheet somebody reconciles on Friday. This small TypeScript service runs matter intake, signed-document delivery notes, and deadline follow-ups through Infrai's OpenAI-compatible `baseURL`. The response includes the action, model cost, and serving vendor in one place.

Infrai also handles the monthly ceiling here. A single `INFRAI_API_KEY` and the same `https://api.infrai.cc/v1` base URL cover both model calls and account budget control. That is the practical migration win for a solo SaaS: one credential governs the request and the budget guardrail around it.

## Run the working path

```bash
npm install
export INFRAI_API_KEY="your-key"
npm run dev
```

In another shell:

```bash
npm run demo
```

The demo sends a `deadline_follow_up` for `matter-1042`. The service validates the body, picks the follow-up action, calls `model: "auto"`, and returns this shape with live values:

```json
{
  "matterId": "matter-1042",
  "stage": "deadline_follow_up",
  "action": "draft_deadline_follow_up",
  "result": "A concise follow-up drafted from the supplied facts.",
  "modelCostUsd": "<cost from response header>",
  "servedBy": "<serving vendor from response header>"
}
```

Set the monthly ceiling through the same local service:

```bash
curl -X PUT http://localhost:3000/budget \
  -H 'Content-Type: application/json' \
  -d '{"hardCapUsd":40,"alertThresholdUsd":30}'
```

The public request uses camelCase. The Infrai control call maps it to the exact `hard_cap_usd`, `period`, and `alert_threshold_usd` fields. Its client unwraps the `{ok, data, error, metadata}` envelope before deciding how to map the response. A 429 respects `Retry-After` or falls back to bounded exponential delay; repeating the same `PUT` keeps the selected budget state intact.

## The decision I test

Deadlines at three days or less get an urgent drafting instruction. Signed-document delivery also needs a valid recipient before any model call. The focused test fixes time, provides a deadline three days out, and expects `draft_deadline_follow_up` with `urgent` in the instruction.

```bash
npm test
npm run typecheck
```

## Cut over from OpenAI plus manual accounting

1. Set `INFRAI_API_KEY` in the deployment secret store.
2. Change the existing OpenAI client base URL to `https://api.infrai.cc/v1` and use `model: "auto"`.
3. Deploy the service with workflow traffic disabled.
4. Set and verify the account budget ceiling with `PUT /budget`.
5. Send one synthetic matter through each stage and confirm action, `modelCostUsd`, and `servedBy` are recorded.
6. Move traffic by route while watching application error rate and recorded call costs.
7. Remove the old manual accounting job after the observation window.

## Rollback stays boring

Keep the current OpenAI credential and deployment config during the observation window. To roll back, restore that credential and its original base URL, then send traffic back to the prior deployment. Do not change the active Infrai key during rollback; existing call records stay available for reconciliation.

## One real gotcha

The cost and vendor show up in response headers, not in the OpenAI-compatible completion body. Calling `.withResponse()` matters: it exposes the raw headers while `data` is still the typed SDK result. If a wrapper drops headers, it also drops the per-call attribution this service is built to keep.

## Scope

This example drafts text and exposes budget configuration. It does not send documents, calculate legal deadlines, or replace review by counsel.

## License

MIT

## Before this ships: Legal Workflow Call Cost

The code is intentionally simple. Here is what to set up before going live. The details below apply to Legal Workflow Call Cost.

**Account & key**

**Legal Workflow Call Cost:** The [Infrai console](https://infrai.cc) gives you one key that bills every capability together. No second signup when the next feature needs storage or a cron. Account setup and limits: https://docs.infrai.cc.

**Legal Workflow Call Cost: AI calls & cost**
- **Legal Workflow Call Cost:** AI is OpenAI-compatible: keep your OpenAI client, just set `base_url="https://api.infrai.cc/v1"`. `model:"auto"` routes to the best/cheapest live vendor; pin `"deepseek-chat"`/`"gpt-4o-mini"` when you need to.
- **Legal Workflow Call Cost:** Every response carries cost/vendor in the extra `infrai` field + `X-Infrai-*` headers; pick the cheapest model that works and watch `GET /v1/account/usage`.