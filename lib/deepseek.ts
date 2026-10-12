const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";

export class DeepSeekError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "DeepSeekError";
  }
}

export async function askDeepSeek(
  systemPrompt: string,
  userPrompt: string,
  options: { temperature?: number } = {},
) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new DeepSeekError(
      "DeepSeek is not configured yet. Add DEEPSEEK_API_KEY to .env.local and restart the app.",
      503,
    );
  }

  let response: Response;
  try {
    response = await fetch(DEEPSEEK_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        temperature: options.temperature ?? 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(45_000),
    });
  } catch (cause) {
    if (cause instanceof Error && cause.name === "TimeoutError") {
      throw new DeepSeekError("DeepSeek took too long to respond. Please try again.", 504);
    }
    throw new DeepSeekError("Could not connect to DeepSeek. Check your connection and try again.", 502);
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new DeepSeekError("DeepSeek rejected the API key. Check DEEPSEEK_API_KEY in .env.local.", 502);
    }
    if (response.status === 402) {
      throw new DeepSeekError(
        "DeepSeek reports that your API account has insufficient balance. Check your DeepSeek API billing and add balance, then try again.",
        402,
      );
    }
    if (response.status === 429) {
      throw new DeepSeekError("DeepSeek is busy or rate-limiting requests. Please wait a moment and try again.", 503);
    }
    throw new DeepSeekError(`DeepSeek could not complete the request (HTTP ${response.status}). Please try again.`, 502);
  }

  const payload: unknown = await response.json().catch(() => null);
  if (!isRecord(payload) || !Array.isArray(payload.choices)) {
    throw new DeepSeekError("DeepSeek returned an unexpected response. Please try again.", 502);
  }

  const firstChoice = payload.choices[0];
  if (!isRecord(firstChoice) || !isRecord(firstChoice.message) || typeof firstChoice.message.content !== "string") {
    throw new DeepSeekError("DeepSeek returned an empty response. Please try again.", 502);
  }

  return parseModelJson(firstChoice.message.content);
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseModelJson(content: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(content);
    if (isRecord(parsed)) return parsed;
  } catch {
    throw new DeepSeekError("DeepSeek returned an invalid response. Please try again.", 502);
  }
  throw new DeepSeekError("DeepSeek returned an invalid response. Please try again.", 502);
}
