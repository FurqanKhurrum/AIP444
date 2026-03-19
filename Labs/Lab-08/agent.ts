import OpenAI from "openai";
import * as dotenv from "dotenv";
import { tools, executeTool } from "./tools";
import { SYSTEM_PROMPT } from "./prompt";

import * as path from "path";
import { fileURLToPath } from "url";


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.resolve(__dirname, "..", "..", ".env");
dotenv.config({ path: envPath });

const client = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY!,
});

const MODEL = "google/gemini-2.0-flash-001";

export async function runAgent(
  base64Image: string,
  userPrompt: string
): Promise<string> {
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    {
      role: "system",
      content: SYSTEM_PROMPT,
    },
    {
      role: "user",
      content: [
        {
          type: "image_url",
          image_url: {
            url: `data:image/jpeg;base64,${base64Image}`,
          },
        },
        {
          type: "text",
          text: userPrompt,
        },
      ],
    },
  ];

  console.error(`[Agent] Sending image to model...`);

  // First call — model may respond with a tool call or a direct answer
  const firstResponse = await client.chat.completions.create({
    model: MODEL,
    messages,
    tools,
    tool_choice: "required",
  });

  const firstMessage = firstResponse.choices[0].message;
  console.error(`[Agent] Finish reason: ${firstResponse.choices[0].finish_reason}`);

  // No tool call — model answered directly
  if (!firstMessage.tool_calls || firstMessage.tool_calls.length === 0) {
    console.error(`[Agent] No tool call made, returning direct answer`);
    return firstMessage.content ?? "No response from model.";
  }

  // Tool call was made — execute each one and collect results
  console.error(`[Agent] Model made ${firstMessage.tool_calls.length} tool call(s)`);

  // Append the assistant's tool call message to history
  messages.push(firstMessage);

  for (const toolCall of firstMessage.tool_calls) {
    const toolName = toolCall.function.name;
    const toolArgs = JSON.parse(toolCall.function.arguments);

    const toolResult = await executeTool(toolName, toolArgs);

    // Append tool result to history
    messages.push({
      role: "tool",
      tool_call_id: toolCall.id,
      content: toolResult,
    });
  }

  console.error(`[Agent] Sending tool results back to model...`);

  // Second call — model now has search results and gives final answer
  const finalResponse = await client.chat.completions.create({
    model: MODEL,
    messages,
    tools,
    tool_choice: "none", // Don't allow another tool call, just answer
  });

  const finalMessage = finalResponse.choices[0].message;
  return finalMessage.content ?? "No response from model.";
}