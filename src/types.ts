export type RuntimeDevice = "webgpu" | "wasm";

export type WorkerMessage = InitRequest | GenerateRequest | GeneratePreviewRequest | CancelRequest;

export type WorkerResponse =
  | InitProgressMessage
  | ReadyMessage
  | ResultMessage
  | PreviewResultMessage
  | WorkerErrorMessage;

export interface VoiceOption {
  id: string;
  label: string;
  gender?: string;
  language?: string;
  targetQuality?: string;
  overallGrade?: string;
  traits?: string;
}

export interface ModelDefinition {
  id: string;
  label: string;
  modelId: string;
  language?: string;
  voices: VoiceOption[];
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

export interface InitRequest {
  type: "init";
  preferredDevice: RuntimeDevice | "auto";
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
  language?: string;
  speed: number;
  pitchSemitones: number;
  sentencePauseMs: number;
  newlinePauseMs: number;
  paragraphPauseMs: number;
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

export interface InitProgressMessage {
  type: "init-progress";
  phase: "loading" | "ready" | "fallback";
  device: RuntimeDevice;
}

export interface ReadyMessage {
  type: "ready";
  device: RuntimeDevice;
  voices: VoiceOption[];
  language?: string;
}

export interface ResultMessage {
  type: "result";
  audioBuffer: ArrayBuffer;
  sampleRate: number;
  mimeType: "audio/wav";
}

export interface PreviewResultMessage {
  type: "preview-result";
  previewId: string;
  audioBuffer: ArrayBuffer;
  sampleRate: number;
  mimeType: "audio/wav";
}

export interface WorkerErrorMessage {
  type: "error";
  message: string;
  recoverable: boolean;
}

export type AppStatus = "idle" | "loading" | "ready" | "generating" | "error";
export type ActivityPhase =
  | "idle"
  | "model-loading"
  | "model-fallback"
  | "generating"
  | "preview-loading"
  | "error";

export interface AppState {
  status: AppStatus;
  activityPhase: ActivityPhase;
  model: ModelDefinition;
  device: RuntimeDevice | null;
  voices: VoiceOption[];
  selectedVoice: string;
  secondaryVoice: string;
  secondaryRatio: number;
  language: string | null;
  text: string;
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
  error: string | null;
  audioUrl: string | null;
  canCancel: boolean;
}
