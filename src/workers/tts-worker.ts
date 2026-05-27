/// <reference lib="webworker" />

import type { Tensor } from "@huggingface/transformers";
import { KokoroTTS } from "kokoro-js";
import { phonemize } from "phonemizer";

import { mergeAudioChunks, pitchShiftAudio } from "../utils/audio";
import { splitTextForSynthesis } from "../utils/long-text";
import { NO_BLEND_VOICE, blendRatioParts } from "../utils/mix";
import { DEFAULT_MODEL } from "../config/model-config";
import { applyStressLevel, parseSpeechMarkup } from "../utils/pronunciation";
import { sortVoicesByGrade } from "../utils/voices";
import type {
  GenerateRequest,
  GeneratePreviewRequest,
  GeneratePronunciationPreviewRequest,
  InitRequest,
  ModelDefinition,
  RuntimeDevice,
  WorkerMessage,
  WorkerResponse,
} from "../types";

declare const self: DedicatedWorkerGlobalScope;

type KokoroInstance = Awaited<ReturnType<typeof KokoroTTS.from_pretrained>>;

const VOICE_CACHE = new Map<string, Float32Array>();
const PUNCTUATION = ';:,.!?¡¿—…"«»“”(){}[]';
const STYLE_VECTOR_SIZE = 256;
const MAX_STYLE_INDEX = 509;
const MIN_SPEED = 0.5;
const MAX_SPEED = 2;
const PUNCTUATION_PATTERN = new RegExp(
  `(\\s*[${PUNCTUATION.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}]+\\s*)+`,
  "g",
);
const WARMUP_TEXT = "Hello from LocalVoice Studio.";
const PREVIEW_TEXT =
  "This is a short [voice](-1) sample from [LocalVoice Studio](/lˈoʊkəlvɔɪs stjˈuːdioʊ/).\nIt sounds [clear](+1), steady, and [natural](-1).\n\nIt can pause with intention, too.";

let activeDevice: RuntimeDevice | null = null;
let currentTts: KokoroInstance | null = null;
let currentRunToken = 0;
let currentModel: ModelDefinition = DEFAULT_MODEL;
let mockConfig: InitRequest["mock"] | undefined;
let synthesisQueue: Promise<void> = Promise.resolve();

self.addEventListener("message", async (event: MessageEvent<WorkerMessage>) => {
  const message = event.data;

  if (message.type === "init") {
    await handleInit(message);
    return;
  }

  if (message.type === "generate") {
    await handleGenerate(message);
    return;
  }

  if (message.type === "generate-preview") {
    await handleGeneratePreview(message);
    return;
  }

  if (message.type === "generate-pronunciation-preview") {
    await handleGeneratePronunciationPreview(message);
    return;
  }

  if (message.type === "cancel") {
    currentRunToken += 1;
  }
});

async function handleInit(message: InitRequest): Promise<void> {
  mockConfig = message.mock;
  currentModel = message.model;

  if (message.mock?.enabled) {
    await initializeMock(message.mock.deviceMode ?? "webgpu");
    return;
  }

  const device: RuntimeDevice =
    message.preferredDevice === "auto" ? "wasm" : message.preferredDevice;

  try {
    post({ type: "init-progress", phase: "loading", device });
    currentTts = await createTts(device);
    if (device === "webgpu") {
      await validateTts(currentTts);
    }

    activeDevice = device;
    post({
      type: "ready",
      device,
      voices: listVoices(currentTts),
      language: currentModel.language ?? null,
    });
  } catch (error) {
    post({
      type: "error",
      message: getErrorMessage(error, "Failed to initialize the Kokoro browser model."),
      recoverable: true,
    });
  }
}

async function handleGenerate(message: GenerateRequest): Promise<void> {
  if (mockConfig?.enabled) {
    await generateMock(message);
    return;
  }

  if (!currentTts || !activeDevice) {
    post({
      type: "error",
      message: "Model is still loading. Please wait and try again.",
      recoverable: true,
    });
    return;
  }

  const tts = currentTts;
  const runToken = ++currentRunToken;

  try {
    const generated = await runSynthesisTask(async () => generateAudio(tts, message, runToken));
    if (runToken !== currentRunToken) {
      return;
    }

    const transferable = toTransferableBuffer(generated.audio);
    post(
      {
        type: "result",
        audioBuffer: transferable,
        sampleRate: generated.sampling_rate,
        mimeType: "audio/wav",
      },
      [transferable],
    );
  } catch (error) {
    if (runToken !== currentRunToken) {
      return;
    }

    post({
      type: "error",
      message: getErrorMessage(error, "Speech generation failed."),
      recoverable: true,
    });
  }
}

async function handleGeneratePreview(message: GeneratePreviewRequest): Promise<void> {
  if (mockConfig?.enabled) {
    await generateMockPreview(message);
    return;
  }

  if (!currentTts || !activeDevice) {
    post({
      type: "error",
      message: "Model is still loading. Please wait and try again.",
      recoverable: true,
    });
    return;
  }

  const tts = currentTts;
  try {
    const generated = await runSynthesisTask(async () =>
      generateAudio(
        tts,
        {
          type: "generate",
          text: PREVIEW_TEXT,
          voice: message.voice,
          secondaryVoice: message.secondaryVoice ?? NO_BLEND_VOICE,
          secondaryRatio: message.secondaryRatio ?? 0,
          speed: message.speed,
          pitchSemitones: message.pitchSemitones,
          sentencePauseMs: message.sentencePauseMs,
          newlinePauseMs: message.newlinePauseMs,
          paragraphPauseMs: message.paragraphPauseMs,
          fileName: "voice-preview.wav",
        },
        currentRunToken,
      ),
    );

    const transferable = toTransferableBuffer(generated.audio);
    post(
      {
        type: "preview-result",
        previewId: message.previewId,
        audioBuffer: transferable,
        sampleRate: generated.sampling_rate,
        mimeType: "audio/wav",
      },
      [transferable],
    );
  } catch (error) {
    post({
      type: "error",
      message: getErrorMessage(error, "Voice sample generation failed."),
      recoverable: true,
    });
  }
}

async function handleGeneratePronunciationPreview(
  message: GeneratePronunciationPreviewRequest,
): Promise<void> {
  if (mockConfig?.enabled) {
    await generateMockPronunciationPreview(message);
    return;
  }

  if (!currentTts || !activeDevice) {
    post({
      type: "pronunciation-preview-error",
      previewId: message.previewId,
      message: "Model is still loading. Please wait and try again.",
    });
    return;
  }

  const tts = currentTts;

  try {
    const generated = await runSynthesisTask(async () =>
      generateAudio(
        tts,
        {
          type: "generate",
          text: message.text,
          voice: message.voice,
          secondaryVoice: message.secondaryVoice ?? NO_BLEND_VOICE,
          secondaryRatio: message.secondaryRatio ?? 0,
          speed: message.speed,
          pitchSemitones: message.pitchSemitones,
          sentencePauseMs: message.sentencePauseMs,
          newlinePauseMs: message.newlinePauseMs,
          paragraphPauseMs: message.paragraphPauseMs,
          fileName: "pronunciation-preview.wav",
        },
        currentRunToken,
      ),
    );

    const transferable = toTransferableBuffer(generated.audio);
    post(
      {
        type: "pronunciation-preview-result",
        previewId: message.previewId,
        audioBuffer: transferable,
        sampleRate: generated.sampling_rate,
        mimeType: "audio/wav",
      },
      [transferable],
    );
  } catch (error) {
    post({
      type: "pronunciation-preview-error",
      previewId: message.previewId,
      message: getErrorMessage(error, "Pronunciation preview failed."),
    });
  }
}

async function generateAudio(
  tts: KokoroInstance,
  message: GenerateRequest,
  runToken: number,
): Promise<{ audio: Float32Array; sampling_rate: number }> {
  const chunks = splitTextForSynthesis(message.text, {
    sentencePauseMs: message.sentencePauseMs,
    newlinePauseMs: message.newlinePauseMs,
    paragraphPauseMs: message.paragraphPauseMs,
  });
  if (chunks.length <= 1) {
    return generateChunkAudio(tts, chunks[0]?.text ?? message.text, message);
  }

  const audioChunks: Float32Array[] = [];
  const pauses: number[] = [];
  let sampleRate = 24000;

  for (const chunk of chunks) {
    if (runToken !== currentRunToken) {
      throw new Error("Generation canceled.");
    }

    const generated = await generateChunkAudio(tts, chunk.text, message);
    audioChunks.push(generated.audio);
    pauses.push(chunk.pauseAfterMs);
    sampleRate = generated.sampling_rate;
  }

  return {
    audio: mergeAudioChunks(audioChunks, sampleRate, pauses),
    sampling_rate: sampleRate,
  };
}

async function generateChunkAudio(tts: KokoroInstance, text: string, message: GenerateRequest) {
  const primaryVoice = message.voice.trim();
  if (!primaryVoice) {
    throw new Error("A primary voice is required for synthesis.");
  }

  const secondaryVoice =
    message.secondaryVoice === NO_BLEND_VOICE ? "" : message.secondaryVoice.trim();
  const phonemes = await phonemizeText(normalizeText(text), validateVoiceGroup(primaryVoice));
  const { input_ids } = tts.tokenizer(phonemes, { truncation: true });
  const inputIds = input_ids as Tensor;

  try {
    const pitchSemitones = Number.isFinite(message.pitchSemitones) ? message.pitchSemitones : 0;
    const speedValue = normalizeSynthesisSpeed(message.speed);
    if (!secondaryVoice || secondaryVoice === primaryVoice || message.secondaryRatio <= 0) {
      const generated = await generateFromIds(tts, inputIds, primaryVoice, speedValue);
      return {
        ...generated,
        audio:
          pitchSemitones === 0 ? generated.audio : pitchShiftAudio(generated.audio, pitchSemitones),
      };
    }

    try {
      const style = await buildMixedStyle(
        inputIds,
        primaryVoice,
        secondaryVoice,
        message.secondaryRatio,
      );
      const generated = await generateWithStyle(tts, inputIds, style, speedValue);
      return {
        ...generated,
        audio:
          pitchSemitones === 0 ? generated.audio : pitchShiftAudio(generated.audio, pitchSemitones),
      };
    } catch {
      // If mixed-style inference fails, preserve usability by falling back to the primary voice path.
      const generated = await generateFromIds(tts, inputIds, primaryVoice, speedValue);
      return {
        ...generated,
        audio:
          pitchSemitones === 0 ? generated.audio : pitchShiftAudio(generated.audio, pitchSemitones),
      };
    }
  } finally {
    inputIds.dispose();
  }
}

async function initializeMock(
  deviceMode: NonNullable<InitRequest["mock"]>["deviceMode"],
): Promise<void> {
  post({
    type: "init-progress",
    phase: "loading",
    device: deviceMode === "wasm" ? "wasm" : "webgpu",
  });

  if (deviceMode === "fallback") {
    post({ type: "init-progress", phase: "fallback", device: "wasm" });
    activeDevice = "wasm";
  } else {
    activeDevice = deviceMode === "wasm" ? "wasm" : "webgpu";
  }

  currentTts = null;

  post({
    type: "ready",
    device: activeDevice,
    voices: currentModel.voices.length > 0 ? currentModel.voices : DEFAULT_MODEL.voices,
    language: currentModel.language ?? DEFAULT_MODEL.language ?? null,
  });
}

async function generateMock(message: GenerateRequest): Promise<void> {
  const runToken = ++currentRunToken;
  await wait(75);
  if (runToken !== currentRunToken) {
    return;
  }

  const sampleRate = 24000;
  const durationSeconds = Math.max(0.4, Math.min(2.2, message.text.length / 42));
  const totalSamples = Math.floor(sampleRate * durationSeconds);
  const samples = new Float32Array(totalSamples);
  const mixBoost =
    message.secondaryVoice &&
    message.secondaryVoice !== NO_BLEND_VOICE &&
    message.secondaryRatio > 0
      ? 40
      : 0;

  for (let index = 0; index < samples.length; index += 1) {
    const time = index / sampleRate;
    samples[index] =
      0.22 * Math.sin(2 * Math.PI * (220 + mixBoost) * time) * Math.exp(-time / durationSeconds);
  }

  const transferable = toTransferableBuffer(samples);
  post(
    {
      type: "result",
      audioBuffer: transferable,
      sampleRate,
      mimeType: "audio/wav",
    },
    [transferable],
  );
}

async function generateMockPreview(message: GeneratePreviewRequest): Promise<void> {
  await wait(75);

  const sampleRate = 24000;
  const durationSeconds = 1.25;
  const totalSamples = Math.floor(sampleRate * durationSeconds);
  const samples = new Float32Array(totalSamples);
  const secondaryVoice =
    message.secondaryVoice && message.secondaryVoice !== NO_BLEND_VOICE
      ? message.secondaryVoice
      : "";
  const voiceSeed = Array.from(
    `${message.voice}|${secondaryVoice}|${message.secondaryRatio ?? 0}`,
  ).reduce((sum, character) => sum + character.charCodeAt(0), 0);
  const baseFrequency = (180 + (voiceSeed % 90)) * 2 ** ((message.pitchSemitones ?? 0) / 12);
  const blendBoost = secondaryVoice ? 20 + Math.round((message.secondaryRatio ?? 0) * 0.4) : 0;

  for (let index = 0; index < samples.length; index += 1) {
    const time = index / sampleRate;
    samples[index] =
      0.2 *
      Math.sin(2 * Math.PI * (baseFrequency + blendBoost) * time) *
      (0.7 + 0.3 * Math.sin(2 * Math.PI * 3 * time)) *
      Math.exp(-time / 1.8);
  }

  const transferable = toTransferableBuffer(samples);
  post(
    {
      type: "preview-result",
      previewId: message.previewId,
      audioBuffer: transferable,
      sampleRate,
      mimeType: "audio/wav",
    },
    [transferable],
  );
}

async function generateMockPronunciationPreview(
  message: GeneratePronunciationPreviewRequest,
): Promise<void> {
  await wait(75);

  const sampleRate = 24000;
  const durationSeconds = 0.9;
  const totalSamples = Math.floor(sampleRate * durationSeconds);
  const samples = new Float32Array(totalSamples);
  const secondaryVoice =
    message.secondaryVoice && message.secondaryVoice !== NO_BLEND_VOICE
      ? message.secondaryVoice
      : "";
  const seed = Array.from(
    `${message.text}|${message.voice}|${secondaryVoice}|${message.secondaryRatio ?? 0}`,
  ).reduce((sum, character) => sum + character.charCodeAt(0), 0);
  const baseFrequency = (260 + (seed % 120)) * 2 ** ((message.pitchSemitones ?? 0) / 12);

  for (let index = 0; index < samples.length; index += 1) {
    const time = index / sampleRate;
    samples[index] =
      0.18 *
      Math.sin(2 * Math.PI * baseFrequency * time) *
      Math.exp(-time / 1.2) *
      (0.82 + 0.18 * Math.sin(2 * Math.PI * 7 * time));
  }

  const transferable = toTransferableBuffer(samples);
  post(
    {
      type: "pronunciation-preview-result",
      previewId: message.previewId,
      audioBuffer: transferable,
      sampleRate,
      mimeType: "audio/wav",
    },
    [transferable],
  );
}

async function createTts(device: RuntimeDevice): Promise<KokoroInstance> {
  return KokoroTTS.from_pretrained(currentModel.modelId, {
    device,
    dtype: device === "webgpu" ? "fp32" : "q8",
    progress_callback: () => undefined,
  });
}

async function validateTts(tts: KokoroInstance): Promise<void> {
  const warmupVoice = Object.keys(tts.voices)[0];
  if (!warmupVoice) {
    throw new Error("The selected model does not expose any voices.");
  }

  await tts.generate(WARMUP_TEXT, {
    voice: warmupVoice as never,
    speed: 1,
  });
}

function normalizeTraits(traits: unknown): string[] | undefined {
  if (!traits) return undefined;
  if (Array.isArray(traits)) return traits;
  if (typeof traits === "string") return [traits];
  return undefined;
}

function listVoices(tts: KokoroInstance) {
  return sortVoicesByGrade(
    Object.entries(tts.voices).map(([id, metadata]) => ({
      id,
      label: metadata.name || id,
      gender: metadata.gender,
      language: metadata.language,
      targetQuality: metadata.targetQuality,
      overallGrade: metadata.overallGrade,
      traits: "traits" in metadata ? normalizeTraits(metadata.traits) : undefined,
    })),
  );
}

async function buildMixedStyle(
  inputIds: Tensor,
  primaryVoice: string,
  secondaryVoice: string,
  secondaryRatio: number,
): Promise<Tensor> {
  const { primaryParts, secondaryParts } = blendRatioParts(secondaryRatio);
  const primaryStyle = await getStyleVector(primaryVoice, inputIds);
  if (secondaryParts === 0) {
    return createCompatibleTensor(inputIds, "float32", primaryStyle, [1, STYLE_VECTOR_SIZE]);
  }

  const secondaryStyle = await getStyleVector(secondaryVoice, inputIds);
  const mixed = new Float32Array(STYLE_VECTOR_SIZE);
  for (let index = 0; index < mixed.length; index += 1) {
    mixed[index] =
      ((primaryStyle[index] ?? 0) * primaryParts + (secondaryStyle[index] ?? 0) * secondaryParts) /
      20;
  }
  return createCompatibleTensor(inputIds, "float32", mixed, [1, STYLE_VECTOR_SIZE]);
}

async function generateFromIds(
  tts: KokoroInstance,
  inputIds: Tensor,
  voice: string,
  speedValue: number,
): Promise<{ audio: Float32Array; sampling_rate: number }> {
  const generated = await tts.generate_from_ids(inputIds, {
    voice: voice as never,
    speed: normalizeSynthesisSpeed(speedValue),
  });

  return {
    audio: new Float32Array(generated.audio),
    sampling_rate: generated.sampling_rate,
  };
}

async function generateWithStyle(
  tts: KokoroInstance,
  inputIds: Tensor,
  style: Tensor,
  speedValue: number,
): Promise<{ audio: Float32Array; sampling_rate: number }> {
  const speed = createCompatibleTensor(
    style,
    "float32",
    [normalizeSynthesisSpeed(speedValue)],
    [1],
  );

  try {
    validateModelInputs(inputIds, style, speed);
    const { waveform } = await tts.model({ input_ids: inputIds, style, speed });

    try {
      return {
        audio: new Float32Array(waveform.data),
        sampling_rate: 24000,
      };
    } finally {
      waveform.dispose();
    }
  } finally {
    style.dispose();
    speed.dispose();
  }
}

async function getStyleVector(voice: string, inputIds: Tensor): Promise<Float32Array> {
  const buffer = await loadVoiceBuffer(voice);
  const tokenCount = inputIds.dims.at(-1);
  const normalizedTokenCount = normalizeTensorDimension(tokenCount, 2) ?? 2;
  const styleIndex = Math.min(Math.max(normalizedTokenCount - 2, 0), MAX_STYLE_INDEX);
  const offset = STYLE_VECTOR_SIZE * styleIndex;
  const styleVector = buffer.slice(offset, offset + STYLE_VECTOR_SIZE);

  if (styleVector.length !== STYLE_VECTOR_SIZE) {
    throw new Error(
      `Voice style data is incomplete for "${voice}" (expected ${STYLE_VECTOR_SIZE} values, got ${styleVector.length}).`,
    );
  }

  return styleVector;
}

async function loadVoiceBuffer(voice: string): Promise<Float32Array> {
  const cacheKey = `${currentModel.modelId}:${voice}`;
  const cached = VOICE_CACHE.get(cacheKey);
  if (cached) {
    return cached;
  }

  const url = `https://huggingface.co/${currentModel.modelId}/resolve/main/voices/${voice}.bin`;
  let cache: Cache | null = null;

  try {
    cache = await caches.open("kokoro-voices");
    const response = await cache.match(url);
    if (response) {
      const data = new Float32Array(await response.arrayBuffer());
      VOICE_CACHE.set(cacheKey, data);
      return data;
    }
  } catch {
    cache = null;
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load voice data for ${voice}.`);
  }

  const arrayBuffer = await response.arrayBuffer();
  if (cache) {
    try {
      await cache.put(url, new Response(arrayBuffer, { headers: response.headers }));
    } catch {
      // Ignore cache write failures.
    }
  }

  const data = new Float32Array(arrayBuffer);
  VOICE_CACHE.set(cacheKey, data);
  return data;
}

function validateVoiceGroup(voice: string): "a" | "b" {
  if (!voice.startsWith("a") && !voice.startsWith("b")) {
    throw new Error(`Unsupported voice "${voice}".`);
  }
  return voice[0] as "a" | "b";
}

function normalizeSynthesisSpeed(speed: number): number {
  if (!Number.isFinite(speed)) {
    return 1;
  }
  return Math.min(MAX_SPEED, Math.max(MIN_SPEED, speed));
}

function validateModelInputs(inputIds: Tensor, style: Tensor, speed: Tensor): void {
  const inputLength = normalizeTensorDimension(inputIds.dims.at(-1));
  if (inputLength === null || inputLength <= 0) {
    throw new Error("Model input_ids are invalid or empty.");
  }

  const styleDim0 = normalizeTensorDimension(style.dims[0]);
  const styleDim1 = normalizeTensorDimension(style.dims[1]);
  if (style.dims.length !== 2 || styleDim0 !== 1 || styleDim1 !== STYLE_VECTOR_SIZE) {
    throw new Error(
      `Model style input has invalid shape [${style.dims.join(", ")}], expected [1, ${STYLE_VECTOR_SIZE}].`,
    );
  }

  const speedDim0 = normalizeTensorDimension(speed.dims[0]);
  if (speed.dims.length !== 1 || speedDim0 !== 1) {
    throw new Error(
      `Model speed input has invalid shape [${speed.dims.join(", ")}], expected [1].`,
    );
  }
}

function normalizeTensorDimension(value: unknown, fallback: number | null = null): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : fallback;
  }

  if (typeof value === "bigint") {
    return value >= 0n ? Number(value) : fallback;
  }

  return fallback;
}

function createCompatibleTensor(
  reference: Tensor,
  type: string,
  data: Float32Array | number[],
  dims: number[],
): Tensor {
  const constructorRef = (reference as { constructor: unknown }).constructor;
  if (typeof constructorRef !== "function") {
    throw new Error("Unable to create tensor: missing runtime tensor constructor.");
  }

  return new (constructorRef as new (
    dtype: string,
    values: Float32Array | number[],
    shape: number[],
  ) => Tensor)(type, data, dims);
}

function normalizeText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

async function phonemizeText(text: string, voiceGroup: "a" | "b"): Promise<string> {
  const language = voiceGroup === "a" ? "en-us" : "en-gb";
  const segments = parseSpeechMarkup(text);
  const joined = (
    await Promise.all(
      segments.map(async (segment) => {
        if (segment.type === "text") {
          return phonemizePlainText(segment.value, language);
        }

        if (segment.type === "phoneme") {
          return segment.value;
        }

        if (segment.type === "break") {
          return phonemizePlainText(segment.value, language);
        }

        const phonemized = await phonemizePlainText(segment.value, language);
        return applyStressLevel(phonemized, segment.level);
      }),
    )
  ).join("");

  let output = joined
    .replace(/kəkˈoːɹoʊ/g, "kˈoʊkəɹoʊ")
    .replace(/kəkˈɔːɹəʊ/g, "kˈəʊkəɹəʊ")
    .replace(/ʲ/g, "j")
    .replace(/r/g, "ɹ")
    .replace(/x/g, "k")
    .replace(/ɬ/g, "l")
    .replace(/(?<=[a-zɹː])(?=hˈʌndɹɪd)/g, " ")
    .replace(/ z(?=[;:,.!?¡¿—…"«»“” ]|$)/g, "z");

  if (voiceGroup === "a") {
    output = output.replace(/(?<=nˈaɪn)ti(?!ː)/g, "di");
  }

  return output.trim();
}

async function phonemizePlainText(text: string, language: "en-us" | "en-gb"): Promise<string> {
  const normalized = normalizeForKokoro(text);
  const parts = splitWithPattern(normalized, PUNCTUATION_PATTERN);
  return (
    await Promise.all(
      parts.map(async ({ match, text: part }) =>
        match || !part.trim() ? part : (await phonemize(part, language)).join(" "),
      ),
    )
  ).join("");
}

function normalizeForKokoro(text: string): string {
  return text
    .replace(/[‘’]/g, "'")
    .replace(/«/g, "“")
    .replace(/»/g, "”")
    .replace(/[“”]/g, '"')
    .replace(/\(/g, "«")
    .replace(/\)/g, "»")
    .replace(/、/g, ", ")
    .replace(/。/g, ". ")
    .replace(/！/g, "! ")
    .replace(/，/g, ", ")
    .replace(/：/g, ": ")
    .replace(/；/g, "; ")
    .replace(/？/g, "? ")
    .replace(/[^\S \n]/g, " ")
    .replace(/  +/g, " ")
    .replace(/(?<=\n) +(?=\n)/g, "")
    .replace(/\bD[Rr]\.(?= [A-Z])/g, "Doctor")
    .replace(/\b(?:Mr\.|MR\.(?= [A-Z]))/g, "Mister")
    .replace(/\b(?:Ms\.|MS\.(?= [A-Z]))/g, "Miss")
    .replace(/\b(?:Mrs\.|MRS\.(?= [A-Z]))/g, "Mrs")
    .replace(/\betc\.(?! [A-Z])/gi, "etc")
    .replace(/\b(y)eah?\b/gi, "$1e'a")
    .replace(/\d*\.\d+|\b\d{4}s?\b|(?<!:)\b(?:[1-9]|1[0-2]):[0-5]\d\b(?!:)/g, normalizeNumber)
    .replace(/(?<=\d),(?=\d)/g, "")
    .replace(
      /[$£]\d+(?:\.\d+)?(?: hundred| thousand| (?:[bm]|tr)illion)*\b|[$£]\d+\.\d\d?\b/gi,
      normalizeCurrency,
    )
    .replace(/\d*\.\d+/g, normalizeDecimal)
    .replace(/(?<=\d)-(?=\d)/g, " to ")
    .replace(/(?<=\d)S/g, " S")
    .replace(/(?<=[BCDFGHJ-NP-TV-Z])'?s\b/g, "'S")
    .replace(/(?<=X')S\b/g, "s")
    .replace(/(?:[A-Za-z]\.){2,} [a-z]/g, (value) => value.replace(/\./g, "-"))
    .replace(/(?<=[A-Z])\.(?=[A-Z])/gi, "-")
    .trim();
}

function normalizeNumber(value: string): string {
  if (value.includes(".")) {
    return value;
  }
  if (value.includes(":")) {
    const [hours = 0, minutes = 0] = value.split(":").map(Number);
    if (minutes === 0) return `${hours} o'clock`;
    if (minutes < 10) return `${hours} oh ${minutes}`;
    return `${hours} ${minutes}`;
  }

  const year = parseInt(value.slice(0, 4), 10);
  if (year < 1100 || year % 1000 < 10) {
    return value;
  }
  const prefix = value.slice(0, 2);
  const suffixValue = parseInt(value.slice(2, 4), 10);
  const suffix = value.endsWith("s") ? "s" : "";
  if (year % 1000 >= 100 && year % 1000 <= 999) {
    if (suffixValue === 0) return `${prefix} hundred${suffix}`;
    if (suffixValue < 10) return `${prefix} oh ${suffixValue}${suffix}`;
  }
  return `${prefix} ${suffixValue}${suffix}`;
}

function normalizeCurrency(value: string): string {
  const unit = value[0] === "$" ? "dollar" : "pound";
  const raw = value.slice(1);
  if (Number.isNaN(Number(raw))) {
    return `${raw} ${unit}s`;
  }
  if (!value.includes(".")) {
    return `${raw} ${unit}${raw === "1" ? "" : "s"}`;
  }

  const [whole, decimal = "0"] = raw.split(".");
  const pennies = parseInt(decimal.padEnd(2, "0"), 10);
  const pennyWord =
    value[0] === "$" ? (pennies === 1 ? "cent" : "cents") : pennies === 1 ? "penny" : "pence";
  return `${whole} ${unit}${whole === "1" ? "" : "s"} and ${pennies} ${pennyWord}`;
}

function normalizeDecimal(value: string): string {
  const [whole, decimal = "0"] = value.split(".");
  return `${whole} point ${decimal.split("").join(" ")}`;
}

function splitWithPattern(text: string, pattern: RegExp): Array<{ match: boolean; text: string }> {
  const items: Array<{ match: boolean; text: string }> = [];
  let currentIndex = 0;
  for (const match of text.matchAll(pattern)) {
    const matchedText = match[0];
    const index = match.index ?? 0;
    if (currentIndex < index) {
      items.push({ match: false, text: text.slice(currentIndex, index) });
    }
    if (matchedText.length > 0) {
      items.push({ match: true, text: matchedText });
    }
    currentIndex = index + matchedText.length;
  }
  if (currentIndex < text.length) {
    items.push({ match: false, text: text.slice(currentIndex) });
  }
  return items;
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "string" && error.trim()) {
    return error;
  }

  return fallback;
}

function toTransferableBuffer(audio: Float32Array<ArrayBufferLike>): ArrayBuffer {
  const exact = new Float32Array(audio.length);
  exact.set(audio);
  return exact.buffer;
}

async function runSynthesisTask<T>(task: () => Promise<T>): Promise<T> {
  const previousTask = synthesisQueue;
  let releaseQueue: () => void = () => undefined;
  synthesisQueue = new Promise((resolve) => {
    releaseQueue = resolve;
  });

  await previousTask;

  try {
    return await task();
  } finally {
    releaseQueue();
  }
}

function post(message: WorkerResponse, transfer?: Transferable[]): void {
  self.postMessage(message, transfer ?? []);
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
