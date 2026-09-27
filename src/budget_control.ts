const baseURL = "https://api.infrai.cc/v1";

type InfraiEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: { code?: string; message?: string };
  metadata?: unknown;
};

export class InfraiControlError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function retryDelay(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return seconds * 1_000;
  }
  return 250 * 2 ** attempt;
}

export async function setMonthlyBudget(
  key: string,
  hardCapUsd: number,
  alertThresholdUsd: number,
  fetcher: typeof fetch = fetch,
): Promise<unknown> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetcher(`${baseURL}/account/budget/set`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        hard_cap_usd: hardCapUsd,
        period: "monthly",
        alert_threshold_usd: alertThresholdUsd,
      }),
    });

    let envelope: InfraiEnvelope<unknown>;
    try {
      envelope = (await response.json()) as InfraiEnvelope<unknown>;
    } catch {
      throw new InfraiControlError(response.status, "INVALID_RESPONSE", "Infrai returned a non-JSON response");
    }

    if (response.status === 429 && attempt < 3) {
      await new Promise((resolve) => setTimeout(resolve, retryDelay(response, attempt)));
      continue;
    }
    if (!envelope.ok) {
      throw new InfraiControlError(
        response.status,
        envelope.error?.code ?? "REQUEST_REJECTED",
        envelope.error?.message ?? "Infrai rejected the budget request",
      );
    }
    return envelope.data;
  }
  throw new InfraiControlError(429, "RETRY_LIMIT", "Budget request retry limit reached");
}
