import type { ModelDefinition } from "../types";

const DEFAULT_MODEL_ID = "onnx-community/Kokoro-82M-v1.0-ONNX";
const MODEL_REPO_QUERY_PARAM = "modelRepo";
const MODEL_QUERY_PARAM = "model";

const DEFAULT_VOICES = [
  { id: "af_heart", label: "af_heart · Heart" },
  { id: "af_alloy", label: "af_alloy · Alloy" },
  { id: "af_aoede", label: "af_aoede · Aoede" },
  { id: "af_bella", label: "af_bella · Bella" },
  { id: "af_jessica", label: "af_jessica · Jessica" },
  { id: "af_kore", label: "af_kore · Kore" },
  { id: "af_nicole", label: "af_nicole · Nicole" },
  { id: "af_nova", label: "af_nova · Nova" },
  { id: "af_river", label: "af_river · River" },
  { id: "af_sarah", label: "af_sarah · Sarah" },
  { id: "af_sky", label: "af_sky · Sky" },
  { id: "am_adam", label: "am_adam · Adam" },
  { id: "am_echo", label: "am_echo · Echo" },
  { id: "am_eric", label: "am_eric · Eric" },
  { id: "am_fenrir", label: "am_fenrir · Fenrir" },
  { id: "am_liam", label: "am_liam · Liam" },
  { id: "am_michael", label: "am_michael · Michael" },
  { id: "am_onyx", label: "am_onyx · Onyx" },
  { id: "am_puck", label: "am_puck · Puck" },
  { id: "am_santa", label: "am_santa · Santa" },
  { id: "bf_alice", label: "bf_alice · Alice" },
  { id: "bf_emma", label: "bf_emma · Emma" },
  { id: "bf_isabella", label: "bf_isabella · Isabella" },
  { id: "bf_lily", label: "bf_lily · Lily" },
  { id: "bm_daniel", label: "bm_daniel · Daniel" },
  { id: "bm_fable", label: "bm_fable · Fable" },
  { id: "bm_george", label: "bm_george · George" },
  { id: "bm_lewis", label: "bm_lewis · Lewis" },
];

export const DEFAULT_MODEL: ModelDefinition = {
  id: "kokoro-82m",
  label: "Kokoro 82M",
  modelId: DEFAULT_MODEL_ID,
  language: "English",
  voices: DEFAULT_VOICES,
};

export const BUILT_IN_MODELS: ModelDefinition[] = [DEFAULT_MODEL];

function normalizeModelRepo(value: string | null | undefined): string {
  return (value ?? "").trim();
}

function slugifyModelId(modelId: string): string {
  return modelId
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function labelFromModelId(modelId: string): string {
  const parts = modelId.split("/");
  return parts[parts.length - 1] || modelId;
}

function configuredModelRepo(): string {
  const env = (
    import.meta as ImportMeta & {
      env?: {
        VITE_KOKORO_MODEL_REPO?: string;
      };
    }
  ).env;

  const processEnv =
    typeof process !== "undefined"
      ? (process.env as { VITE_KOKORO_MODEL_REPO?: string | undefined })
      : undefined;

  return normalizeModelRepo(env?.VITE_KOKORO_MODEL_REPO ?? processEnv?.VITE_KOKORO_MODEL_REPO);
}

export function createModelDefinition(modelId: string): ModelDefinition {
  const normalized = normalizeModelRepo(modelId) || DEFAULT_MODEL.modelId;
  const builtInMatch = BUILT_IN_MODELS.find(
    (model) => model.modelId === normalized || model.id === normalized,
  );

  if (builtInMatch) {
    return builtInMatch;
  }

  return {
    id: `custom-${slugifyModelId(normalized) || "model"}`,
    label: labelFromModelId(normalized),
    modelId: normalized,
    voices: [],
  };
}

export function resolveInitialModel(url: URL): ModelDefinition {
  const explicitRepo = normalizeModelRepo(url.searchParams.get(MODEL_REPO_QUERY_PARAM));
  if (explicitRepo) {
    return createModelDefinition(explicitRepo);
  }

  const explicitModel = normalizeModelRepo(url.searchParams.get(MODEL_QUERY_PARAM));
  if (explicitModel) {
    return createModelDefinition(explicitModel);
  }

  const configuredRepo = configuredModelRepo();
  if (configuredRepo) {
    return createModelDefinition(configuredRepo);
  }

  return DEFAULT_MODEL;
}

export function syncModelUrl(url: URL, model: ModelDefinition): string {
  if (model.modelId === DEFAULT_MODEL.modelId) {
    url.searchParams.delete(MODEL_REPO_QUERY_PARAM);
    url.searchParams.delete(MODEL_QUERY_PARAM);
  } else {
    url.searchParams.set(MODEL_REPO_QUERY_PARAM, model.modelId);
    url.searchParams.delete(MODEL_QUERY_PARAM);
  }

  return url.toString();
}
