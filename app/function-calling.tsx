// @ts-nocheck
import { OpenAI } from "openai";
import { config } from "./config";

const client = new OpenAI({
  baseURL: config.nonOllamaBaseURL,
  apiKey: config.inferenceAPIKey,
});
const MODEL = config.inferenceModel;

export async function functionCalling(query: string) {
  try {
    const messages = [
      {
        role: "system",
        content:
          "You are a function calling agent. You will be given a query and a list of functions. Your task is to call the appropriate function based on the query and return the result in JSON format. ONLY CALL A FUNCTION IF YOU ARE HIGHLY CONFIDENT IT WILL BE USED",
      },
      { role: "user", content: query },
    ];
    const tools = [];
    const response = await client.chat.completions.create({
      model: MODEL,
      messages: messages,
      tools: tools,
      tool_choice: "auto",
      max_tokens: 4096,
    });
    const responseMessage = response.choices[0].message;
    const toolCalls = responseMessage.tool_calls;
    if (toolCalls) {
      const availableFunctions = {};
      messages.push(responseMessage);
      for (const toolCall of toolCalls) {
        const functionName = toolCall.function.name;
        const functionToCall = availableFunctions[functionName];
        const functionArgs = JSON.parse(toolCall.function.arguments);
        let functionResponse;
        try {
          return JSON.parse(functionResponse);
        } catch (error) {
          console.error(`Error calling function ${functionName}:`, error);
          return JSON.stringify({
            error: `Failed to call function ${functionName}`,
          });
        }
      }
    }
  } catch (error) {
    console.error("Error in functionCalling:", error);
    return JSON.stringify({
      error: "An error occurred during function calling",
    });
  }
}
