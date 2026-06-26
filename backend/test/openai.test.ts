import assert from "node:assert/strict";
import test from "node:test";
import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import {
  detectorFromEnv,
  imageFromBuffer,
  OpenAIDetector,
} from "../src/detector.js";
import { openaiStructured } from "../src/openai.js";
import { generateRecipe, RecipeSchema } from "../src/recipe.js";
import {
  DetectionResultSchema,
  type DetectionResult,
} from "../src/types.js";

const SAMPLE_INVENTORY: DetectionResult = {
  items: [
    {
      name: "cucumber",
      quantity: 2,
      unit: "count",
      quantityKind: "exact",
      category: "produce",
      confidence: 0.9,
    },
    {
      name: "feta",
      quantity: 150,
      unit: "g",
      quantityKind: "estimate",
      category: "dairy",
      confidence: 0.7,
    },
  ],
  notes: "Clear shot.",
};

const SAMPLE_RECIPE = {
  title: "Cucumber feta salad",
  description: "A crisp, quick salad.",
  servings: 2,
  timeMinutes: 10,
  usesFromInventory: ["cucumber", "feta"],
  pantryAssumptions: ["salt", "pepper", "olive oil"],
  missingButRecommended: [],
  steps: ["Chop the cucumber.", "Toss with feta and seasonings."],
};

function fakeResponse(
  payload: unknown,
  captured?: { url?: string; headers?: RequestInit["headers"]; body?: any },
): typeof fetch {
  return (async (
    url: string | URL | Request,
    init?: RequestInit,
  ): Promise<Response> => {
    if (captured) {
      captured.url = String(url);
      captured.headers = init?.headers;
      captured.body = init?.body ? JSON.parse(String(init.body)) : undefined;
    }
    return {
      ok: true,
      status: 200,
      async json() {
        return payload;
      },
      async text() {
        return JSON.stringify(payload);
      },
    } as unknown as Response;
  }) as unknown as typeof fetch;
}

function completedResponse(value: unknown): unknown {
  return {
    status: "completed",
    output: [
      {
        type: "message",
        content: [{ type: "output_text", text: JSON.stringify(value) }],
      },
    ],
    usage: { input_tokens: 321, output_tokens: 88 },
  };
}

async function withProviderEnv(
  values: Partial<Record<string, string>>,
  fn: () => void | Promise<void>,
): Promise<void> {
  const names = [
    "REMY_DETECTOR",
    "GEMINI_API_KEY",
    "ANTHROPIC_API_KEY",
    "OPENAI_API_KEY",
  ];
  const previous = new Map(names.map((name) => [name, process.env[name]]));
  for (const name of names) delete process.env[name];
  Object.assign(process.env, values);
  try {
    await fn();
  } finally {
    for (const name of names) {
      const value = previous.get(name);
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
}

test("OpenAIDetector parses structured inventory and reports usage", async () => {
  const captured: {
    url?: string;
    headers?: RequestInit["headers"];
    body?: any;
  } = {};
  const detector = new OpenAIDetector({
    apiKey: "test-key",
    model: "gpt-5.4-nano",
    fetchFn: fakeResponse(completedResponse(SAMPLE_INVENTORY), captured),
  });

  const run = await detector.detect(
    imageFromBuffer(Buffer.from("fakeimage"), "image/png", "salad.png"),
  );

  assert.doesNotThrow(() => DetectionResultSchema.parse(run.result));
  assert.equal(run.result.items[0]!.name, "cucumber");
  assert.equal(run.meta.detector, "openai-vision");
  assert.equal(run.meta.model, "gpt-5.4-nano");
  assert.deepEqual(run.meta.usage, { inputTokens: 321, outputTokens: 88 });
});

test("OpenAIDetector sends image, prompt, and strict JSON schema", async () => {
  const captured: {
    url?: string;
    headers?: RequestInit["headers"];
    body?: any;
  } = {};
  const detector = new OpenAIDetector({
    apiKey: "test-key",
    model: "gpt-5.4-nano",
    fetchFn: fakeResponse(completedResponse(SAMPLE_INVENTORY), captured),
  });
  await detector.detect(imageFromBuffer(Buffer.from("img"), "image/jpeg"));

  assert.equal(captured.url, "https://api.openai.com/v1/responses");
  assert.deepEqual(captured.headers, {
    "Content-Type": "application/json",
    Authorization: "Bearer test-key",
  });
  const userContent = captured.body?.input?.[1]?.content ?? [];
  assert.ok(
    userContent.some(
      (part: any) =>
        part.type === "input_image" &&
        part.image_url === "data:image/jpeg;base64,aW1n",
    ),
  );
  assert.ok(
    userContent.some(
      (part: any) =>
        part.type === "input_text" && typeof part.text === "string",
    ),
  );
  assert.equal(captured.body?.text?.format?.type, "json_schema");
  assert.equal(captured.body?.text?.format?.strict, true);
  assert.equal(
    captured.body?.text?.format?.schema?.additionalProperties,
    false,
  );
});

test("OpenAIDetector throws a clear error without a key", async () => {
  await withProviderEnv({}, () => {
    assert.throws(() => new OpenAIDetector(), /OPENAI_API_KEY/);
  });
});

test("OpenAI helper reports API, incomplete, refusal, and malformed-output errors", async () => {
  const schema = z.object({ ok: z.boolean() });
  const baseCall = {
    apiKey: "test-key",
    model: "gpt-5.4-nano",
    system: "Return JSON.",
    userContent: "Hello",
    schemaName: "test_result",
    responseSchema: {
      type: "object",
      properties: { ok: { type: "boolean" } },
      required: ["ok"],
      additionalProperties: false,
    },
  };

  const apiFailure = (async (): Promise<Response> =>
    ({
      ok: false,
      status: 429,
      async text() {
        return "rate limited";
      },
    }) as Response) as unknown as typeof fetch;
  await assert.rejects(
    openaiStructured(schema, { ...baseCall, fetchFn: apiFailure }),
    /OpenAI API 429: rate limited/,
  );

  await assert.rejects(
    openaiStructured(schema, {
      ...baseCall,
      fetchFn: fakeResponse({
        status: "incomplete",
        incomplete_details: { reason: "max_output_tokens" },
      }),
    }),
    /incomplete.*max_output_tokens/,
  );

  await assert.rejects(
    openaiStructured(schema, {
      ...baseCall,
      fetchFn: fakeResponse({
        status: "completed",
        output: [
          {
            type: "message",
            content: [{ type: "refusal", refusal: "Cannot comply." }],
          },
        ],
      }),
    }),
    /refused.*Cannot comply/,
  );

  await assert.rejects(
    openaiStructured(schema, {
      ...baseCall,
      fetchFn: fakeResponse({
        status: "completed",
        output: [
          {
            type: "message",
            content: [{ type: "output_text", text: "{not-json" }],
          },
        ],
      }),
    }),
    /non-JSON output/,
  );
});

test("detector selection supports OpenAI without changing existing priority", async () => {
  await withProviderEnv(
    { REMY_DETECTOR: "openai", OPENAI_API_KEY: "openai-key" },
    () => assert.equal(detectorFromEnv().name, "openai-vision"),
  );
  await withProviderEnv(
    { OPENAI_API_KEY: "openai-key" },
    () => assert.equal(detectorFromEnv().name, "openai-vision"),
  );
  await withProviderEnv(
    {
      GEMINI_API_KEY: "gemini-key",
      ANTHROPIC_API_KEY: "anthropic-key",
      OPENAI_API_KEY: "openai-key",
    },
    () => assert.equal(detectorFromEnv().name, "gemini-vision"),
  );
  await withProviderEnv(
    {
      ANTHROPIC_API_KEY: "anthropic-key",
      OPENAI_API_KEY: "openai-key",
    },
    () => assert.equal(detectorFromEnv().name, "claude-vision"),
  );
});

test("recipe generation uses OpenAI when it is the only configured provider", async () => {
  const captured: { body?: any } = {};
  const previousFetch = globalThis.fetch;
  await withProviderEnv({ OPENAI_API_KEY: "openai-key" }, async () => {
    globalThis.fetch = fakeResponse(completedResponse(SAMPLE_RECIPE), captured);
    try {
      const recipe = await generateRecipe(SAMPLE_INVENTORY, {
        model: "gpt-5.4-nano",
      });
      assert.doesNotThrow(() => RecipeSchema.parse(recipe));
      assert.equal(recipe.title, "Cucumber feta salad");
      assert.equal(captured.body?.model, "gpt-5.4-nano");
      assert.equal(captured.body?.text?.format?.name, "recipe");
      assert.equal(captured.body?.text?.format?.strict, true);
    } finally {
      globalThis.fetch = previousFetch;
    }
  });
});

test("recipe generation preserves Gemini priority over OpenAI", async () => {
  const captured: { url?: string; body?: any } = {};
  const previousFetch = globalThis.fetch;
  await withProviderEnv(
    { GEMINI_API_KEY: "gemini-key", OPENAI_API_KEY: "openai-key" },
    async () => {
      globalThis.fetch = fakeResponse(
        {
          candidates: [
            {
              content: {
                parts: [{ text: JSON.stringify(SAMPLE_RECIPE) }],
              },
              finishReason: "STOP",
            },
          ],
          usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 20 },
        },
        captured,
      );
      try {
        const recipe = await generateRecipe(SAMPLE_INVENTORY, {
          model: "gemini-2.5-flash",
        });
        assert.equal(recipe.title, "Cucumber feta salad");
        assert.match(captured.url ?? "", /generativelanguage\.googleapis\.com/);
      } finally {
        globalThis.fetch = previousFetch;
      }
    },
  );
});

test("recipe generation preserves an Anthropic client over OpenAI", async () => {
  let called = false;
  const client = {
    messages: {
      async create() {
        called = true;
        return {
          content: [
            {
              type: "tool_use",
              id: "tool_1",
              name: "propose_recipe",
              input: SAMPLE_RECIPE,
            },
          ],
          stop_reason: "tool_use",
          usage: { input_tokens: 10, output_tokens: 20 },
        };
      },
    },
  } as unknown as Anthropic;

  await withProviderEnv(
    {
      ANTHROPIC_API_KEY: "anthropic-key",
      OPENAI_API_KEY: "openai-key",
    },
    async () => {
      const recipe = await generateRecipe(SAMPLE_INVENTORY, {
        client,
        model: "claude-test",
      });
      assert.equal(called, true);
      assert.equal(recipe.title, "Cucumber feta salad");
    },
  );
});
