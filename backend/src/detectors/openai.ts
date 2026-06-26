import {
  CATEGORIES,
  DetectionResultSchema,
  QUANTITY_KINDS,
  type Detector,
  type DetectionRun,
  type ImageInput,
} from "../types.js";
import {
  DETECTION_SYSTEM_PROMPT,
  DETECTION_USER_INSTRUCTION,
} from "../prompt.js";
import { openaiStructured, OPENAI_DEFAULT_MODEL } from "../openai.js";

/** Strict JSON Schema mirror of DetectionResultSchema. */
const INVENTORY_OPENAI_SCHEMA = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          quantity: { type: "number" },
          unit: { type: "string" },
          quantityKind: { type: "string", enum: [...QUANTITY_KINDS] },
          category: { type: "string", enum: [...CATEGORIES] },
          confidence: { type: "number" },
        },
        required: [
          "name",
          "quantity",
          "unit",
          "quantityKind",
          "category",
          "confidence",
        ],
        additionalProperties: false,
      },
    },
    notes: { type: "string" },
  },
  required: ["items", "notes"],
  additionalProperties: false,
} as const;

export interface OpenAIDetectorOptions {
  apiKey?: string;
  model?: string;
  maxOutputTokens?: number;
  fetchFn?: typeof fetch;
}

/** OpenAI vision detector using Responses API image input + structured output. */
export class OpenAIDetector implements Detector {
  readonly name = "openai-vision";
  private readonly apiKey: string;
  private readonly model: string;
  private readonly maxOutputTokens: number;
  private readonly fetchFn?: typeof fetch;

  constructor(opts: OpenAIDetectorOptions = {}) {
    this.apiKey = opts.apiKey ?? process.env.OPENAI_API_KEY ?? "";
    if (!this.apiKey) {
      throw new Error(
        "OpenAIDetector needs a key. Set OPENAI_API_KEY.",
      );
    }
    this.model = opts.model ?? OPENAI_DEFAULT_MODEL;
    this.maxOutputTokens = opts.maxOutputTokens ?? 4096;
    this.fetchFn = opts.fetchFn;
  }

  async detect(image: ImageInput): Promise<DetectionRun> {
    const start = performance.now();
    const { value, usage } = await openaiStructured(DetectionResultSchema, {
      apiKey: this.apiKey,
      model: this.model,
      fetchFn: this.fetchFn,
      maxOutputTokens: this.maxOutputTokens,
      system: DETECTION_SYSTEM_PROMPT,
      userContent: [
        {
          type: "input_image",
          image_url: `data:${image.mediaType};base64,${image.base64}`,
        },
        { type: "input_text", text: DETECTION_USER_INSTRUCTION },
      ],
      schemaName: "ingredient_inventory",
      responseSchema: INVENTORY_OPENAI_SCHEMA,
    });

    return {
      result: value,
      meta: {
        detector: this.name,
        model: this.model,
        label: image.label,
        elapsedMs: Math.round(performance.now() - start),
        usage,
      },
    };
  }
}
