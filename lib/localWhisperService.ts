import { spawn } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Types for local Whisper service
export interface LocalWhisperResponse {
  text: string;
  language?: string;
  duration?: number;
  segments?: WhisperSegment[];
}

export interface WhisperSegment {
  id: number;
  seek: number;
  start: number;
  end: number;
  text: string;
  tokens: number[];
  temperature: number;
  avg_logprob: number;
  compression_ratio: number;
  no_speech_prob: number;
}

export interface LocalWhisperOptions {
  language?: string;
  model?: string;
  task?: 'transcribe' | 'translate';
  temperature?: number;
  best_of?: number;
  beam_size?: number;
  word_timestamps?: boolean;
  vad_filter?: boolean;
  vad_parameters?: {
    threshold?: number;
    min_speech_duration_ms?: number;
    max_speech_duration_s?: number;
    min_silence_duration_ms?: number;
    speech_pad_ms?: number;
  };
}

// Supported audio formats
const SUPPORTED_FORMATS = [
  'wav', 'mp3', 'mp4', 'm4a', 'ogg', 'flac', 'aac', 'wma', 'webm'
];

// Language code mapping (Whisper uses ISO 639-1 codes)
const LANGUAGE_MAPPING: Record<string, string> = {
  'en': 'english',
  'es': 'spanish',
  'fr': 'french',
  'de': 'german',
  'it': 'italian',
  'pt': 'portuguese',
  'ja': 'japanese',
  'ko': 'korean',
  'zh': 'chinese',
  'ru': 'russian',
  'ar': 'arabic',
  'hi': 'hindi',
  'tr': 'turkish',
  'pl': 'polish',
  'nl': 'dutch',
  'sv': 'swedish',
  'da': 'danish',
  'no': 'norwegian',
  'fi': 'finnish',
};

/**
 * Downloads audio from URL to temporary file
 */
async function downloadAudioFromUrl(audioUrl: string): Promise<string> {
  const response = await fetch(audioUrl);
  if (!response.ok) {
    throw new Error(`Failed to download audio: ${response.status} ${response.statusText}`);
  }

  // Get file extension from URL or Content-Type
  let extension = 'mp3'; // default
  const urlPath = new URL(audioUrl).pathname;
  const urlExtension = path.extname(urlPath).slice(1).toLowerCase();
  
  if (urlExtension && SUPPORTED_FORMATS.includes(urlExtension)) {
    extension = urlExtension;
  } else {
    const contentType = response.headers.get('content-type');
    if (contentType?.includes('wav')) extension = 'wav';
    else if (contentType?.includes('mp4')) extension = 'mp4';
    else if (contentType?.includes('ogg')) extension = 'ogg';
    else if (contentType?.includes('flac')) extension = 'flac';
  }

  const tempDir = os.tmpdir();
  const tempFileName = `whisper_${Date.now()}_${Math.random().toString(36).substring(7)}.${extension}`;
  const tempFilePath = path.join(tempDir, tempFileName);

  const buffer = await response.arrayBuffer();
  await fs.promises.writeFile(tempFilePath, Buffer.from(buffer));

  return tempFilePath;
}

/**
 * Cleans up temporary file
 */
async function cleanupTempFile(filePath: string): Promise<void> {
  try {
    await fs.promises.unlink(filePath);
  } catch (error) {
    console.warn(`Failed to cleanup temp file ${filePath}:`, error);
  }
}

/**
 * Executes faster-whisper command and returns parsed result
 */
async function executeFasterWhisper(
  audioPath: string, 
  options: LocalWhisperOptions = {}
): Promise<LocalWhisperResponse> {
  return new Promise((resolve, reject) => {
    const args: string[] = [];
    
    // Audio file path
    args.push(audioPath);
    
    // Model selection (default to base model)
    const model = options.model || 'base';
    args.push('--model', model);
    
    // Language (if specified)
    if (options.language) {
      const whisperLang = LANGUAGE_MAPPING[options.language] || options.language;
      args.push('--language', whisperLang);
    }
    
    // Task (transcribe or translate)
    args.push('--task', options.task || 'transcribe');
    
    // Output format (JSON for easier parsing)
    args.push('--output_format', 'json');
    
    // Temperature
    if (options.temperature) {
      args.push('--temperature', options.temperature.toString());
    }
    
    // Best of (for sampling)
    if (options.best_of) {
      args.push('--best_of', options.best_of.toString());
    }
    
    // Beam size
    if (options.beam_size) {
      args.push('--beam_size', options.beam_size.toString());
    }
    
    // Word timestamps
    if (options.word_timestamps) {
      args.push('--word_timestamps', 'True');
    }
    
    // VAD (Voice Activity Detection) filter
    if (options.vad_filter) {
      args.push('--vad_filter', 'True');
      
      // VAD parameters
      if (options.vad_parameters) {
        const vad = options.vad_parameters;
        if (vad.threshold) args.push('--vad_threshold', vad.threshold.toString());
        if (vad.min_speech_duration_ms) args.push('--vad_min_speech_duration_ms', vad.min_speech_duration_ms.toString());
        if (vad.max_speech_duration_s) args.push('--vad_max_speech_duration_s', vad.max_speech_duration_s.toString());
        if (vad.min_silence_duration_ms) args.push('--vad_min_silence_duration_ms', vad.min_silence_duration_ms.toString());
        if (vad.speech_pad_ms) args.push('--vad_speech_pad_ms', vad.speech_pad_ms.toString());
      }
    }

    // Verbose output for debugging
    args.push('--verbose', 'False');

    console.log('Executing faster-whisper with args:', args);

    // Spawn faster-whisper process
    const whisperProcess = spawn('faster-whisper', args, {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    whisperProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    whisperProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    whisperProcess.on('close', (code) => {
      if (code !== 0) {
        console.error('faster-whisper stderr:', stderr);
        reject(new Error(`faster-whisper process exited with code ${code}: ${stderr}`));
        return;
      }

      try {
        // Parse JSON output
        const result = JSON.parse(stdout);
        
        // Extract transcription text
        let text = '';
        let segments: WhisperSegment[] = [];
        
        if (result.segments && Array.isArray(result.segments)) {
          segments = result.segments;
          text = segments.map(segment => segment.text).join(' ').trim();
        } else if (result.text) {
          text = result.text.trim();
        } else {
          text = stdout.trim();
        }

        const response: LocalWhisperResponse = {
          text,
          language: result.language || options.language || 'en',
          duration: result.duration,
          segments: segments.length > 0 ? segments : undefined
        };

        resolve(response);
      } catch (parseError) {
        // If JSON parsing fails, treat stdout as plain text
        const text = stdout.trim();
        if (text) {
          resolve({
            text,
            language: options.language || 'en'
          });
        } else {
          reject(new Error(`Failed to parse faster-whisper output: ${parseError}`));
        }
      }
    });

    whisperProcess.on('error', (error) => {
      reject(new Error(`Failed to start faster-whisper process: ${error.message}`));
    });

    // Set timeout (10 minutes)
    const timeout = setTimeout(() => {
      whisperProcess.kill('SIGTERM');
      reject(new Error('Whisper transcription timed out after 10 minutes'));
    }, 10 * 60 * 1000);

    whisperProcess.on('close', () => {
      clearTimeout(timeout);
    });
  });
}

/**
 * Main function to transcribe audio from URL using local faster-whisper
 */
export async function transcribeAudioFromUrl(
  audioUrl: string,
  options: LocalWhisperOptions = {}
): Promise<LocalWhisperResponse> {
  let tempFilePath: string | null = null;
  
  try {
    console.log('Starting local Whisper transcription for URL:', audioUrl);
    
    // Download audio to temporary file
    console.log('Downloading audio file...');
    tempFilePath = await downloadAudioFromUrl(audioUrl);
    console.log('Audio downloaded to:', tempFilePath);
    
    // Check if file exists and has content
    const stats = await fs.promises.stat(tempFilePath);
    if (stats.size === 0) {
      throw new Error('Downloaded audio file is empty');
    }
    console.log('Audio file size:', stats.size, 'bytes');
    
    // Transcribe using faster-whisper
    console.log('Starting transcription...');
    const result = await executeFasterWhisper(tempFilePath, options);
    console.log('Transcription completed. Text length:', result.text.length);
    
    return result;
    
  } catch (error) {
    console.error('Local Whisper transcription failed:', error);
    throw error;
  } finally {
    // Cleanup temporary file
    if (tempFilePath) {
      await cleanupTempFile(tempFilePath);
      console.log('Cleaned up temporary file:', tempFilePath);
    }
  }
}

/**
 * Transcribe from local file path
 */
export async function transcribeAudioFromFile(
  filePath: string,
  options: LocalWhisperOptions = {}
): Promise<LocalWhisperResponse> {
  try {
    console.log('Starting local Whisper transcription for file:', filePath);
    
    // Check if file exists
    const stats = await fs.promises.stat(filePath);
    if (stats.size === 0) {
      throw new Error('Audio file is empty');
    }
    console.log('Audio file size:', stats.size, 'bytes');
    
    // Transcribe using faster-whisper
    console.log('Starting transcription...');
    const result = await executeFasterWhisper(filePath, options);
    console.log('Transcription completed. Text length:', result.text.length);
    
    return result;
    
  } catch (error) {
    console.error('Local Whisper transcription failed:', error);
    throw error;
  }
}

/**
 * Check if faster-whisper is installed and available
 */
export async function checkFasterWhisperAvailability(): Promise<boolean> {
  return new Promise((resolve) => {
    const process = spawn('faster-whisper', ['--help'], { stdio: 'pipe' });
    
    process.on('close', (code) => {
      resolve(code === 0);
    });
    
    process.on('error', () => {
      resolve(false);
    });
    
    // Timeout after 5 seconds
    setTimeout(() => {
      process.kill();
      resolve(false);
    }, 5000);
  });
}

/**
 * Get available Whisper models
 */
export function getAvailableModels(): string[] {
  return [
    'tiny',
    'tiny.en',
    'base',
    'base.en', 
    'small',
    'small.en',
    'medium',
    'medium.en',
    'large-v1',
    'large-v2',
    'large-v3',
    'large'
  ];
}

/**
 * Get supported languages
 */
export function getSupportedLanguages(): Array<{code: string, name: string}> {
  return Object.entries(LANGUAGE_MAPPING).map(([code, name]) => ({
    code,
    name: name.charAt(0).toUpperCase() + name.slice(1)
  }));
}