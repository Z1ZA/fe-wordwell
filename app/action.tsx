import "server-only";
import { createAI, createStreamableValue } from "ai/rsc";
import OpenAI from "openai";
import cheerio from "cheerio";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { Document as DocumentInterface } from "langchain/document";
import { OpenAIEmbeddings } from "@langchain/openai";
import { OllamaEmbeddings } from "@langchain/community/embeddings/ollama";
import { config } from "./config";
import { functionCalling } from "./function-calling";
// Use Upstash rate limiting to limit the number of requests per user
import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";
import { headers } from "next/headers";
import { toolConfig } from "./config-tools";

let ratelimit: Ratelimit | undefined;
if (config.useRateLimiting) {
  ratelimit = new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(10, "10 m"),
  });
}

// Use Upstash semantic cache to store and retrieve data for faster response times
import { SemanticCache } from "@upstash/semantic-cache";
import { Index } from "@upstash/vector";
let semanticCache: SemanticCache | undefined;
if (config.useSemanticCache) {
  const index = new Index();
  semanticCache = new SemanticCache({ index, minProximity: 0.95 });
}

import {
  braveSearch,
  googleSearch,
  serperSearch,
} from "./tools/searchProvider";

// Determine which embeddings mode and which inference model to use based on the config.tsx. Currently suppport for OpenAI, Groq and partial support for Ollama embeddings and inference
let openai: OpenAI;
if (config.useOllamaInference) {
  openai = new OpenAI({
    baseURL: "http://localhost:11434/v1",
    apiKey: "ollama",
  });
} else {
  openai = new OpenAI({
    baseURL: config.nonOllamaBaseURL,
    apiKey: config.inferenceAPIKey,
  });
}

// Set up the embeddings model based on the config.tsx
let embeddings: OllamaEmbeddings | OpenAIEmbeddings;
if (config.useOllamaEmbeddings) {
  embeddings = new OllamaEmbeddings({
    model: config.embeddingsModel,
    baseUrl: "http://localhost:11434",
  });
} else {
  embeddings = new OpenAIEmbeddings({
    modelName: config.embeddingsModel,
  });
}

// Define interfaces for search results and content results
interface SearchResult {
  title: string;
  link: string;
  favicon: string;
}
interface ContentResult extends SearchResult {
  html: string;
}

// Fetch content of top 10 search result
export async function get10BlueLinksContents(
  sources: SearchResult[]
): Promise<ContentResult[]> {
  async function fetchWithTimeout(
    url: string,
    options: RequestInit = {},
    timeout = 800
  ): Promise<Response> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      if (error) {
        console.log(`Skipping ${url}!`);
      }
      throw error;
    }
  }
  function extractMainContent(html: string): string {
    try {
      const $ = cheerio.load(html);
      $("script, style, head, nav, footer, iframe, img").remove();
      return $("body").text().replace(/\s+/g, " ").trim();
    } catch (error) {
      console.error("Error extracting main content:", error);
      throw error;
    }
  }
  const promises = sources.map(
    async (source): Promise<ContentResult | null> => {
      try {
        const response = await fetchWithTimeout(source.link, {}, 800);
        if (!response.ok) {
          throw new Error(
            `Failed to fetch ${source.link}. Status: ${response.status}`
          );
        }
        const html = await response.text();
        const mainContent = extractMainContent(html);
        return { ...source, html: mainContent };
      } catch (error) {
        // console.error(`Error processing ${source.link}:`, error);
        return null;
      }
    }
  );
  try {
    const results = await Promise.all(promises);
    return results.filter((source): source is ContentResult => source !== null);
  } catch (error) {
    console.error("Error fetching and processing blue links contents:", error);
    throw error;
  }
}

// Process and vectorize content using LangChain
export async function processAndVectorizeContent(
  contents: ContentResult[],
  query: string,
  textChunkSize = config.textChunkSize,
  textChunkOverlap = config.textChunkOverlap,
  numberOfSimilarityResults = config.numberOfSimilarityResults
): Promise<DocumentInterface[]> {
  const allResults: DocumentInterface[] = [];
  try {
    for (let i = 0; i < contents.length; i++) {
      const content = contents[i];
      if (content.html.length > 0) {
        try {
          const splitText = await new RecursiveCharacterTextSplitter({
            chunkSize: textChunkSize,
            chunkOverlap: textChunkOverlap,
          }).splitText(content.html);
          const vectorStore = await MemoryVectorStore.fromTexts(
            splitText,
            { title: content.title, link: content.link },
            embeddings
          );
          const contentResults = await vectorStore.similaritySearch(
            query,
            numberOfSimilarityResults
          );
          allResults.push(...contentResults);
        } catch (error) {
          console.error(`Error processing content for ${content.link}:`, error);
        }
      }
    }
    return allResults;
  } catch (error) {
    console.error("Error processing and vectorizing content:", error);
    throw error;
  }
}

const relevantQuestions = async (
  sources: SearchResult[],
  userMessage: String
): Promise<any> => {
  return await openai.chat.completions.create({
    messages: [
      {
        role: "system",
        content: `
          You are a Question generator who generates an array of 3 follow-up questions in JSON format.
          The JSON schema should include:
          {
            "original": "The original search query or context",
            "followUp": [
              "Question 1",
              "Question 2", 
              "Question 3"
            ]
          }
          `,
      },
      {
        role: "user",
        content: `Generate follow-up questions based on the top results from a similarity search: ${JSON.stringify(
          sources
        )}. The original search query is: "${userMessage}".`,
      },
    ],
    model: config.inferenceModel,
    response_format: { type: "json_object" },
  });
};

async function lookupTool(
  mentionTool: string,
  userMessage: string,
  streamable: any
) {
  const toolInfo = toolConfig.mentionTools.find(
    (tool) => tool.id === mentionTool
  );
}

function isSentence(message: string): boolean {
  return message.trim().split(/\s+/).length > 1;
}

async function myAction(
  userMessage: string,
  mentionTool: string | null,
  logo: string | null
): Promise<any> {
  "use server";
  const streamable = createStreamableValue({});
  (async () => {
    if (config.useRateLimiting && ratelimit) {
      const identifier =
        headers().get("x-forwarded-for") ||
        headers().get("x-real-ip") ||
        headers().get("cf-connecting-ip") ||
        headers().get("client-ip") ||
        "";
      const { success } = await ratelimit.limit(identifier);
      if (!success) {
        return streamable.done({ status: "rateLimitReached" });
      }
    }
    if (mentionTool) {
      await lookupTool(mentionTool, userMessage, streamable);
      return;
    }
    if (config.useSemanticCache && semanticCache) {
      const cachedData = await semanticCache.get(userMessage);
      if (cachedData) {
        streamable.update({ cachedData: cachedData });
        return;
      }
    }

    const [sources, condtionalFunctionCallUI] = await Promise.all([
      config.searchProvider === "brave"
        ? braveSearch(userMessage)
        : config.searchProvider === "serper"
        ? serperSearch(userMessage)
        : config.searchProvider === "google"
        ? googleSearch(userMessage)
        : Promise.reject(
            new Error(`Unsupported search provider: ${config.searchProvider}`)
          ),
      functionCalling(userMessage),
    ]);
    streamable.update({ searchResults: sources });
    if (config.useFunctionCalling) {
      streamable.update({
        conditionalFunctionCallUI: condtionalFunctionCallUI,
      });
    }
    const html = await get10BlueLinksContents(sources);
    const vectorResults = await processAndVectorizeContent(html, userMessage);
    const prompt = isSentence(userMessage)
      ? `
        - Berikut adalah kalimat kasar "${userMessage}". HANYA Berikan "versi yang lebih halus" dari kalimat ini dalam bahasa Indonesia. Jawaban harus ringkas dan singkat dalam format markdown.
        `
      : `
        - Berikut adalah kata kasar "${userMessage}". HANYA Berikan "pengertian", "contoh penggunaan", dan "kata yang terkait" dalam bahasa Indonesia. Jawaban harus ringkas dan singkat dalam format markdown.
        `;

    const chatCompletion = await openai.chat.completions.create({
      messages: [
        {
          role: "system",
          content: prompt,
        },
        {
          role: "user",
          content: ` - Berikut adalah hasil teratas untuk menjawab, dalam bahasa Indonesia dan format markdown!:,  ${JSON.stringify(
            vectorResults
          )}. `,
        },
      ],
      stream: true,
      model: config.inferenceModel,
    });
    let accumulatedLLMResponse = "";
    for await (const chunk of chatCompletion) {
      if (
        chunk.choices[0].delta &&
        chunk.choices[0].finish_reason !== "stop" &&
        chunk.choices[0].delta.content !== null
      ) {
        streamable.update({ llmResponse: chunk.choices[0].delta.content });
        accumulatedLLMResponse += chunk.choices[0].delta.content;
      } else if (chunk.choices[0].finish_reason === "stop") {
        streamable.update({ llmResponseEnd: true });
      }
    }
    let followUp;
    if (!config.useOllamaInference) {
      followUp = await relevantQuestions(sources, userMessage);
      streamable.update({ followUp: followUp });
    }
    const dataToCache = {
      searchResults: sources,
      conditionalFunctionCallUI: config.useFunctionCalling
        ? condtionalFunctionCallUI
        : undefined,
      llmResponse: accumulatedLLMResponse,
      followUp,
      condtionalFunctionCallUI,
      semanticCacheKey: userMessage,
    };
    if (
      config.useSemanticCache &&
      semanticCache &&
      dataToCache.llmResponse.length > 0
    ) {
      await semanticCache.set(userMessage, JSON.stringify(dataToCache));
    }
    streamable.done({ status: "done" });
  })();
  return streamable.value;
}

async function clearSemanticCache(userMessage: string): Promise<any> {
  "use server";
  console.log("Clearing semantic cache for user message:", userMessage);
  if (!config.useSemanticCache || !semanticCache) return;
  await semanticCache.delete(userMessage);
}

// Define intial AI and UI states
const initialAIState: {
  role: "user" | "assistant" | "system" | "function";
  content: string;
  id?: string;
  name?: string;
}[] = [];
const initialUIState: {
  id: number;
  display: React.ReactNode;
}[] = [];
// Export the AI instance
export const AI = createAI({
  actions: {
    myAction,
    clearSemanticCache,
  },
  initialUIState,
  initialAIState,
});
