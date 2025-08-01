import { createTogetherAI } from "@ai-sdk/togetherai";
import { Together } from "together-ai";
import { createOpenAI } from "@ai-sdk/openai";

const APP_NAME_HELICONE = "whisper-app";

// Local AI service configuration
const LOCAL_WHISPER_URL = process.env.LOCAL_WHISPER_URL || "http://localhost:9000";
const LOCAL_LLM_URL = process.env.LOCAL_LLM_URL || "http://localhost:11434";
const LOCAL_LLM_MODEL = process.env.LOCAL_LLM_MODEL || "llama3.1:8b";

export const togetheraiClient = createTogetherAI({
  apiKey: process.env.TOGETHER_API_KEY ?? "",
  baseURL: "https://together.helicone.ai/v1",
  headers: {
    "Helicone-Auth": `Bearer ${process.env.HELICONE_API_KEY}`,
    "Helicone-Property-AppName": APP_NAME_HELICONE,
  },
});

// Dynamic TogetherAI client for client-side use
export function togetherVercelAiClient(apiKey?: string) {
  return createTogetherAI({
    apiKey: apiKey || process.env.TOGETHER_API_KEY || "",
    baseURL: "https://together.helicone.ai/v1",
    headers: {
      "Helicone-Auth": `Bearer ${process.env.HELICONE_API_KEY}`,
      "Helicone-Property-AppName": APP_NAME_HELICONE,
    },
  });
}

export function togetherBaseClientWithKey(apiKey?: string) {
  const baseSDKOptions: ConstructorParameters<typeof Together>[0] = {
    apiKey: apiKey || process.env.TOGETHER_API_KEY,
  };

  if (process.env.HELICONE_API_KEY) {
    baseSDKOptions.baseURL = "https://together.helicone.ai/v1";
    baseSDKOptions.defaultHeaders = {
      "Helicone-Auth": `Bearer ${process.env.HELICONE_API_KEY}`,
      "Helicone-Property-Appname": APP_NAME_HELICONE,
    };
  }

  return new Together(baseSDKOptions);
}

// Local LLM clients for Ollama integration
export const ollamaClient = createOllamaClient();
export { localLLMClient, checkOllamaHealth };

// Unified client that can switch between Together.ai and local LLM
export function createUnifiedLLMClient(useLocal: boolean = false, apiKey?: string) {
  if (useLocal) {
    return localLLMClient;
  }
  return togetherVercelAiClient(apiKey);
}

// Local Whisper service client using faster-whisper subprocess
export async function transcribeWithLocalWhisper(audioUrl: string, language: string = "en") {
  // Import the local service dynamically to avoid import issues
  const { transcribeAudioFromUrl, checkFasterWhisperAvailability } = await import('./localWhisperService');
  
  try {
    // Check if faster-whisper is available
    const isAvailable = await checkFasterWhisperAvailability();
    if (!isAvailable) {
      throw new Error('faster-whisper is not installed or not available in PATH. Please install it using: pip install faster-whisper');
    }

    console.log('Using local faster-whisper for transcription');
    const result = await transcribeAudioFromUrl(audioUrl, {
      language: language,
      model: process.env.WHISPER_MODEL || 'base', // Configurable model
      task: 'transcribe',
      vad_filter: true, // Enable voice activity detection for better accuracy
      vad_parameters: {
        threshold: 0.5,
        min_speech_duration_ms: 250,
        max_speech_duration_s: 10,
        min_silence_duration_ms: 100,
        speech_pad_ms: 30
      }
    });

    return { text: result.text, language: result.language };
  } catch (error) {
    console.error('Local Whisper transcription failed:', error);
    
    // Fallback to HTTP API if configured
    if (process.env.LOCAL_WHISPER_URL) {
      console.log('Falling back to HTTP API...');
      try {
        const response = await fetch(`${LOCAL_WHISPER_URL}/v1/audio/transcriptions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            url: audioUrl,
            model: 'whisper-1',
            language: language,
            response_format: 'json'
          }),
        });

        if (!response.ok) {
          throw new Error(`Local Whisper service error: ${response.status}`);
        }

        const result = await response.json();
        return { text: result.text };
      } catch (httpError) {
        console.error('HTTP API fallback also failed:', httpError);
      }
    }
    
    throw new Error(`Failed to transcribe audio with local Whisper service: ${error.message}`);
  }
}

// Local LLM client for Ollama-compatible API
export function createLocalLLMClient() {
  return createOpenAI({
    baseURL: `${LOCAL_LLM_URL}/v1`,
    apiKey: 'ollama', // Ollama doesn't require a real API key
  });
}

export function getLocalLLMModel() {
  return LOCAL_LLM_MODEL;
}