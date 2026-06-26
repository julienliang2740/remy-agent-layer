import type { ZodType } from "zod";

export const OPENAI_DEFAULT_MODEL =
  process.env.OPENAI_MODEL || "gpt-5.4-nano";

export type OpenAIContent =
  | string
  | Array<
      | { type: "input_text"; text: string }
      | {
          type: "input_image";
          image_url: string;
          detail?: "auto" | "low" | "high";
        }
    >;

export interface OpenAICall {
  apiKey: string;
  model: string;
  system: string;
  userContent: OpenAIContent;
  schemaName: string;
  responseSchema: Record<string, unknown>;
  maxOutputTokens?: number;
  /** Injectable for tests; defaults to global fetch. */
  fetchFn?: typeof fetch;
}

export interface OpenAIResult<T> {
  value: T;
  usage: { inputTokens: number; outputTokens: number };
}

const RESPONSES_URL = "https://api.openai.com/v1/responses";

/** Call the OpenAI Responses API for strict structured JSON, then validate it. */
export async function openaiStructured<T>(
  schema: ZodType<T>,
  call: OpenAICall,
): Promise<OpenAIResult<T>> {
  const fetchFn = call.fetchFn ?? fetch;
  const res = await fetchFn(RESPONSES_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${call.apiKey}`,
    },
    body: JSON.stringify({
      model: call.model,
      input: [
        { role: "system", content: call.system },
        { role: "user", content: call.userContent },
      ],
      max_output_tokens: call.maxOutputTokens ?? 4096,
      text: {
        format: {
          type: "json_schema",
          name: call.schemaName,
          strict: true,
          schema: call.responseSchema,
        },
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`OpenAI API ${res.status}: ${body.slice(0, 300)}`);
  }

  let data: OpenAIResponse;
  try {
    data = (await res.json()) as OpenAIResponse;
  } catch {
    throw new Error("OpenAI returned an invalid JSON response.");
  }

  if (data.error) {
    throw new Error(`OpenAI API error: ${data.error.message ?? "unknown error"}`);
  }
  if (data.status === "incomplete") {
    throw new Error(
      `OpenAI response incomplete (${data.incomplete_details?.reason ?? "unknown reason"}).`,
    );
  }
  if (data.status && data.status !== "completed") {
    throw new Error(`OpenAI response status=${data.status}.`);
  }

  const contents =
    data.output
      ?.filter((item) => item.type === "message")
      .flatMap((item) => item.content ?? []) ?? [];
  const refusal = contents.find((content) => content.type === "refusal");
  if (refusal?.refusal) {
    throw new Error(`OpenAI refused the request: ${refusal.refusal}`);
  }

  const text = contents
    .filter((content) => content.type === "output_text")
    .map((content) => content.text ?? "")
    .join("");
  if (!text) {
    throw new Error("OpenAI returned no structured output.");
  }

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`OpenAI returned non-JSON output: ${text.slice(0, 200)}`);
  }

  return {
    value: schema.parse(json),
    usage: {
      inputTokens: data.usage?.input_tokens ?? 0,
      outputTokens: data.usage?.output_tokens ?? 0,
    },
  };
}

interface OpenAIResponse {
  status?: string;
  incomplete_details?: { reason?: string };
  error?: { message?: string } | null;
  output?: Array<{
    type?: string;
    content?: Array<{
      type?: string;
      text?: string;
      refusal?: string;
    }>;
  }>;
  usage?: { input_tokens?: number; output_tokens?: number };
}
