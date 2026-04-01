import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import type { ZodType } from "zod";

const apiKey = process.env.OPENAI_API_KEY;

export function hasOpenAIKey() {
  return Boolean(apiKey);
}

function getClient() {
  if (!apiKey) {
    return null;
  }

  return new OpenAI({ apiKey });
}

export async function parseStructuredResponse<T>({
  schema,
  schemaName,
  model,
  system,
  payload,
}: {
  schema: ZodType<T>;
  schemaName: string;
  model: string;
  system: string;
  payload: unknown;
}) {
  const client = getClient();
  if (!client) {
    return null;
  }

  const response = await client.responses.parse({
    model,
    input: [
      { role: "system", content: system },
      {
        role: "user",
        content: JSON.stringify(payload),
      },
    ],
    text: {
      format: zodTextFormat(schema, schemaName),
    },
  });

  return response.output_parsed;
}

