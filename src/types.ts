export type RuntimeDevice = "webgpu" | "wasm";
export type AppStatus = "idle" | "loading" | "generating" | "ready" | "error";
export type ActivityPhase =
  | "idle"
  | "model-loading"
  | "model-fallback"
  | "generating"
  | "preview-loading"
  | "error";

export type AudioMimeType = "audio/wav";
export type AudioExtension = "wav";

export interface ExportMetadata {
  mimeType: AudioMimeType;
  extension: AudioExtension;
  bitDepth: 16;
  sizeBytes: number;
  fileName: string;
}

export interface GenerationHistoryItem {
  id: string;
  createdAt: number;
  durationMs: number;
  textLength: number;
  textPreview: string;
  voice: string;
  secondaryVoice: string;
  secondaryRatio: number;
  speed: number;
  pitchSemitones: number;
  sentencePauseMs: number;
  newlinePauseMs: number;
  paragraphPauseMs: number;
  fileName: string;
  audioUrl: string;
  cacheKey: string;
}

export interface PersistedGenerationHistoryItem {
  id: string;
  createdAt: number;
  durationMs: number;
  textLength: number;
  textPreview: string;
  voice: string;
  secondaryVoice: string;
  secondaryRatio: number;
  speed: number;
  pitchSemitones: number;
  sentencePauseMs: number;
  newlinePauseMs: number;
  paragraphPauseMs: number;
  fileName: string;
  cacheKey: string;
}

export type WorkerMessage = InitRequest | GenerateRequest | GeneratePreviewRequest | CancelRequest;

export type WorkerResponse =
  | ReadyResponse
  | ResultMessage
  | PreviewResultMessage
  | WorkerErrorMessage
  | InitProgressResponse;

export interface InitRequest {
  type: "init";
  preferredDevice: "auto" | "webgpu" | "wasm";
  model: ModelDefinition;
  mock?: {
    enabled: boolean;
    deviceMode?: "webgpu" | "wasm" | "fallback";
  };
}

export interface GenerateRequest {
  type: "generate";
  text: string;
  voice: string;
  secondaryVoice: string;
  secondaryRatio: number;
  speed: number;
  pitchSemitones: number;
  sentencePauseMs: number;
  newlinePauseMs: number;
  paragraphPauseMs: number;
  fileName: string;
}

export interface GeneratePreviewRequest {
  type: "generate-preview";
  previewId: string;
  voice: string;
  secondaryVoice?: string;
  secondaryRatio?: number;
  speed: number;
  pitchSemitones: number;
  sentencePauseMs: number;
  newlinePauseMs: number;
  paragraphPauseMs: number;
}

export interface CancelRequest {
  type: "cancel";
}

export interface InitProgressResponse {
  type: "init-progress";
  phase: "loading" | "fallback";
  device: RuntimeDevice;
}

export interface ReadyResponse {
  type: "ready";
  voices: VoiceOption[];
  language: string | null;
  device: RuntimeDevice;
}

export interface ResultMessage {
  type: "result";
  audioBuffer: ArrayBuffer;
  sampleRate: number;
  mimeType: AudioMimeType;
}

export interface PreviewResultMessage {
  type: "preview-result";
  previewId: string;
  audioBuffer: ArrayBuffer;
  sampleRate: number;
  mimeType: AudioMimeType;
}

export interface WorkerErrorMessage {
  type: "error";
  message: string;
  recoverable?: boolean;
}

export interface VoiceOption {
  id: string;
  label: string;
  language?: string;
  gender?: string;
  targetQuality?: string;
  overallGrade?: string;
  traits?: string[];
}

export interface ModelDefinition {
  id: string;
  modelId: string;
  name?: string;
  label?: string;
  voices: VoiceOption[];
  language?: string;
}

export interface VoicePreset {
  id: string;
  name: string;
  voice: string;
  secondaryVoice: string;
  secondaryRatio: number;
  speed: number;
  pitchSemitones: number;
  sentencePauseMs: number;
  sentencePauseMinMs: number;
  sentencePauseMaxMs: number;
  newlinePauseMs: number;
  newlinePauseMinMs: number;
  newlinePauseMaxMs: number;
  paragraphPauseMs: number;
  paragraphPauseMinMs: number;
  paragraphPauseMaxMs: number;
}
