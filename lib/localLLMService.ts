import { LanguageModel, streamText } from "ai";

/**
 * Local LLM Service for Ollama integration
 * Replaces Together.ai with local models for text transformation
 */

// Ollama API endpoint configuration
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";

// Model configuration for different languages
const MODEL_CONFIG = {
  chinese: "qwen2.5:7b",
  english: "llama3.1:8b",
  default: "llama3.1:8b"
};

// Retry configuration
const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
};

/**
 * Detects if text contains Chinese characters
 */
function containsChinese(text: string): boolean {
  const chineseRegex = /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/;
  return chineseRegex.test(text);
}

/**
 * Selects appropriate model based on content language
 */
function selectModel(content: string): string {
  if (containsChinese(content)) {
    return MODEL_CONFIG.chinese;
  }
  return MODEL_CONFIG.english;
}

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Calculate exponential backoff delay
 */
function getRetryDelay(attempt: number): number {
  const delay = RETRY_CONFIG.baseDelay * Math.pow(2, attempt);
  return Math.min(delay, RETRY_CONFIG.maxDelay);
}

/**
 * Custom Ollama LanguageModel implementation
 */
class OllamaLanguageModel implements LanguageModel {
  public readonly specificationVersion = "v1";
  public readonly provider = "ollama";
  public readonly modelId: string;
  public readonly settings: any;

  constructor(modelId: string, settings: any = {}) {
    this.modelId = modelId;
    this.settings = {
      temperature: 0.7,
      max_tokens: 4000,
      ...settings
    };
  }

  async doGenerate(options: any): Promise<any> {
    throw new Error("doGenerate not implemented - use doStream instead");
  }

  async doStream(options: any): Promise<any> {
    const { prompt, abortSignal } = options;
    
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
      try {
        const response = await this.makeOllamaRequest(prompt, abortSignal);
        return response;
      } catch (error) {
        lastError = error as Error;
        console.error(`Ollama request attempt ${attempt + 1} failed:`, error);
        
        // If this is the last attempt, throw the error
        if (attempt === RETRY_CONFIG.maxRetries) {
          break;
        }
        
        // Wait before retrying
        const delay = getRetryDelay(attempt);
        console.log(`Retrying in ${delay}ms...`);
        await sleep(delay);
      }
    }
    
    throw new Error(`Ollama request failed after ${RETRY_CONFIG.maxRetries + 1} attempts. Last error: ${lastError?.message}`);
  }

  private async makeOllamaRequest(prompt: string, abortSignal?: AbortSignal) {
    const requestBody = {
      model: this.modelId,
      prompt: prompt,
      stream: true,
      options: {
        temperature: this.settings.temperature,
        num_predict: this.settings.max_tokens,
      }
    };

    const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
      signal: abortSignal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    if (!response.body) {
      throw new Error("No response body from Ollama API");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    return {
      stream: this.createAsyncIterable(reader, decoder),
      rawCall: { rawPrompt: prompt, rawSettings: this.settings },
      rawResponse: { headers: response.headers },
      warnings: undefined,
    };
  }

  private async *createAsyncIterable(
    reader: ReadableStreamDefaultReader<Uint8Array>,
    decoder: TextDecoder
  ): AsyncIterable<any> {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(line => line.trim());

        for (const line of lines) {
          try {
            const parsed = JSON.parse(line);
            if (parsed.response) {
              yield {
                type: "text-delta",
                textDelta: parsed.response,
              };
            }
            if (parsed.done) {
              return;
            }
          } catch (parseError) {
            console.warn("Failed to parse Ollama response line:", line, parseError);
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}

/**
 * Creates an Ollama model instance compatible with Vercel AI SDK
 */
export function createOllamaModel(modelId?: string, settings?: any): LanguageModel {
  return new OllamaLanguageModel(modelId || MODEL_CONFIG.default, settings);
}

/**
 * Creates a client function that returns Ollama models
 * Compatible with the existing togetherVercelAiClient interface
 */
export function createOllamaClient() {
  return function(modelId?: string) {
    // If no modelId provided, we'll need to determine it at runtime
    return createOllamaModel(modelId);
  };
}

/**
 * Smart model selector that chooses the best model based on content
 */
export function createSmartOllamaClient() {
  return function(content?: string) {
    const selectedModel = content ? selectModel(content) : MODEL_CONFIG.default;
    return createOllamaModel(selectedModel);
  };
}

/**
 * Health check for Ollama service
 */
export async function checkOllamaHealth(): Promise<{ status: 'healthy' | 'unhealthy'; error?: string }> {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      return {
        status: 'unhealthy',
        error: `Ollama API returned ${response.status}: ${response.statusText}`
      };
    }

    const data = await response.json();
    console.log("Available Ollama models:", data.models?.map((m: any) => m.name) || []);
    
    return { status: 'healthy' };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: `Failed to connect to Ollama: ${(error as Error).message}`
    };
  }
}

/**
 * Ensures required models are available in Ollama
 */
export async function ensureModelsAvailable(): Promise<{ success: boolean; message: string }> {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`);
    if (!response.ok) {
      return {
        success: false,
        message: `Cannot connect to Ollama API: ${response.status} ${response.statusText}`
      };
    }

    const data = await response.json();
    const availableModels = data.models?.map((m: any) => m.name) || [];
    
    const requiredModels = [MODEL_CONFIG.chinese, MODEL_CONFIG.english];
    const missingModels = requiredModels.filter(model => !availableModels.includes(model));
    
    if (missingModels.length > 0) {
      return {
        success: false,
        message: `Missing required models: ${missingModels.join(', ')}. Please run: ${missingModels.map(m => `ollama pull ${m}`).join(' && ')}`
      };
    }
    
    return {
      success: true,
      message: `All required models are available: ${requiredModels.join(', ')}`
    };
  } catch (error) {
    return {
      success: false,
      message: `Error checking models: ${(error as Error).message}`
    };
  }
}

/**
 * Local LLM transformation function that mirrors the Together.ai implementation
 */
export async function transformWithLocalLLM(
  prompt: string,
  transcription: string,
  options: {
    abortSignal?: AbortSignal;
    onChunk?: (chunk: string) => void;
  } = {}
): Promise<AsyncIterable<string>> {
  // Select model based on transcription language
  const selectedModel = selectModel(transcription);
  console.log(`Selected model for transformation: ${selectedModel}`);
  
  const model = createOllamaModel(selectedModel);
  
  const { textStream } = await streamText({
    model,
    prompt,
    abortSignal: options.abortSignal,
  });

  return textStream;
}

// Export default client for easy replacement
export const localLLMClient = createSmartOllamaClient();

// Export types for TypeScript support
export interface LocalLLMConfig {
  baseUrl?: string;
  chineseModel?: string;
  englishModel?: string;
  temperature?: number;
  maxTokens?: number;
  maxRetries?: number;
  baseDelay?: number;
}

/**
 * Configure local LLM service
 */
export function configureLocalLLM(config: LocalLLMConfig) {
  if (config.baseUrl) {
    process.env.OLLAMA_BASE_URL = config.baseUrl;
  }
  if (config.chineseModel) {
    MODEL_CONFIG.chinese = config.chineseModel;
  }
  if (config.englishModel) {
    MODEL_CONFIG.english = config.englishModel;
  }
  if (config.maxRetries !== undefined) {
    RETRY_CONFIG.maxRetries = config.maxRetries;
  }
  if (config.baseDelay) {
    RETRY_CONFIG.baseDelay = config.baseDelay;
  }
}