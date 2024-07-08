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
// Upstash rate limiting untuk membatasi request per user
import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";
import { headers } from "next/headers";
import { toolConfig } from "./config-tools";

let ratelimit: Ratelimit | undefined;
if (config.useRateLimiting) {
  ratelimit = new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(10, "10 m"), // 10 Request tiap 10 menit
  });
}

// Upstash semantic cache untuk menyimpan dan mengambil data untuk waktu response yg lebih cepat
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

// Menentukan mode embedding dan inteface model yang akan digunakan berdasarkan config.tsx (currently support untuk OpenAI Groq dan partial support untuk ollama)
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

// Setup embedding model berdasarkan config.tsx
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

// Mendefinisikan interface untuk search results dan content results
interface SearchResult {
  title: string;
  link: string;
  favicon: string;
}
interface ContentResult extends SearchResult {
  html: string;
}

// Mengambil content dari 10 hasil teratas
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

// Process dan vectorize content menggunakan LangChain
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

// Fungsi utama yang mengatur seluruh proses
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

    const dataToCache = {
      searchResults: sources,
      conditionalFunctionCallUI: config.useFunctionCalling
        ? condtionalFunctionCallUI
        : undefined,
      llmResponse: accumulatedLLMResponse,
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

// Mendefinisikan initial AI dan UI states
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
// Export AI instance
export const AI = createAI({
  actions: {
    myAction,
    clearSemanticCache,
  },
  initialUIState,
  initialAIState,
});
