export const config = {
  useOllamaInference: false,
  useOllamaEmbeddings: false,
  searchProvider: "serper", // 'serper', 'google' // 'serper' adalah default
  inferenceModel: "llama3-70b-8192", // Groq: 'mixtral-8x7b-32768', 'gemma-7b-it' // OpenAI: 'gpt-3.5-turbo', 'gpt-4' // Ollama 'mistral', 'llama3'
  inferenceAPIKey: process.env.GROQ_API_KEY, // Groq: process.env.GROQ_API_KEY // OpenAI: process.env.OPENAI_API_KEY // Ollama: 'ollama' adalah default
  embeddingsModel: "text-embedding-3-small", // Ollama: 'llama2', 'nomic-embed-text' // OpenAI 'text-embedding-3-small', 'text-embedding-3-large'
  textChunkSize: 800,
  textChunkOverlap: 200,
  numberOfSimilarityResults: 4, // Jumlah hasil mirip yang akan dikembalikan perhalaman
  numberOfPagesToScan: 10,
  nonOllamaBaseURL: "https://api.groq.com/openai/v1", //Groq: https://api.groq.com/openai/v1 // OpenAI: https://api.openai.com/v1
  useFunctionCalling: true, // set true untuk enable function calling dan streaming UI
  useRateLimiting: false, // Upstash rate limit untuk membatasi jumlah request tiap user
  useSemanticCache: false, // Upstash semantic cache untuk menyimpan & mengambil data agar response lebih cepat
  usePortkey: false,
};
