<script setup lang="ts">
import { onMounted, onUnmounted, watch } from "vue";
import type { ModelDefinition } from "../types";
import { useGenerationStore } from "../stores/generation";
import { useVoiceStore } from "../stores/voice";
import { useUiStore } from "../stores/ui";
import {
  initWorker,
  requestPreviews,
  setupWorkerWatchers,
  worker,
} from "../composables/useTtsWorker";
import { resolveInitialModel, syncModelUrl } from "../config/model-config";
import { useAudioPlayback } from "../composables/useAudioPlayback";
import { applyThemeMode } from "../utils/theme";
import { hydrateGenerationHistoryFromCache } from "../composables/useGenerationHistory";

import StudioSetup from "../components/StudioSetup.vue";
import VoiceBlend from "../components/VoiceBlend.vue";
import ScriptLab from "../components/ScriptLab.vue";
import OutputSection from "../components/OutputSection.vue";

const genStore = useGenerationStore();
const voiceStore = useVoiceStore();
const uiStore = useUiStore();

setupWorkerWatchers();
useAudioPlayback();

const PREVIEW_DEBOUNCE_MS = 300;
let previewTimeout: number | undefined;
watch(
  () => [
    genStore.status,
    voiceStore.selectedVoice,
    voiceStore.secondaryVoice,
    voiceStore.secondaryRatio,
    voiceStore.speed,
    voiceStore.pitchSemitones,
    voiceStore.pauses.sentence.value,
    voiceStore.pauses.newline.value,
    voiceStore.pauses.paragraph.value,
  ],
  () => {
    clearTimeout(previewTimeout);
    previewTimeout = window.setTimeout(() => requestPreviews(), PREVIEW_DEBOUNCE_MS);
  },
  { immediate: true },
);

const MODEL_DOWNLOAD_APPROVAL_KEY_PREFIX = "kokoro-model-download-approved:";

function modelDownloadApprovalKey(model: ModelDefinition = genStore.model) {
  return `${MODEL_DOWNLOAD_APPROVAL_KEY_PREFIX}${model.modelId}`;
}

function hasModelDownloadApproval(model: ModelDefinition = genStore.model) {
  try {
    return window.localStorage.getItem(modelDownloadApprovalKey(model)) === "1";
  } catch {
    return false;
  }
}

function isMockTtsMode() {
  const url = new URL(window.location.href);
  return url.searchParams.get("mockTts") === "1";
}

const systemThemeQuery = window.matchMedia("(prefers-color-scheme: dark)");
const handleSystemThemeChange = () => {
  if (uiStore.themeMode === "system") applyThemeMode(uiStore.themeMode);
};

function syncSelectedModelUrl(model: ModelDefinition) {
  try {
    const currentUrl = new URL(window.location.href);
    const nextUrl = syncModelUrl(currentUrl, model);
    if (nextUrl !== window.location.href) {
      window.history.replaceState(window.history.state, "", nextUrl);
    }
  } catch {
    // Ignore URL sync failures.
  }
}

function applyModelSelection(model: ModelDefinition) {
  const downloadApproved = hasModelDownloadApproval(model) || isMockTtsMode();

  genStore.changeModel(model, downloadApproved);
  voiceStore.setFromModel(model);
  uiStore.setModelDownloadApproved(downloadApproved);
  syncSelectedModelUrl(model);

  return downloadApproved;
}

watch(
  () => uiStore.modelDownloadApproved,
  (approved) => {
    if (approved && !isMockTtsMode()) {
      try {
        window.localStorage.setItem(modelDownloadApprovalKey(), "1");
      } catch {}
    }
  },
);

watch(
  () => genStore.model.modelId,
  (next, previous) => {
    if (!previous || next === previous) {
      return;
    }

    const downloadApproved = hasModelDownloadApproval(genStore.model) || isMockTtsMode();
    voiceStore.setFromModel(genStore.model);
    uiStore.setModelDownloadApproved(downloadApproved);
    syncSelectedModelUrl(genStore.model);

    if (downloadApproved) {
      initWorker();
      return;
    }

    worker.value?.terminate();
    worker.value = null;
  },
);

onMounted(() => {
  document.title = "LocalVoice Studio - Private Browser Text to Speech with Kokoro";

  void hydrateGenerationHistoryFromCache();
  const initialModel = resolveInitialModel(new URL(window.location.href));
  const downloadApproved = applyModelSelection(initialModel);
  applyThemeMode(uiStore.themeMode);

  systemThemeQuery.addEventListener("change", handleSystemThemeChange);

  if (downloadApproved) {
    initWorker();
  }
});

onUnmounted(() => {
  clearTimeout(previewTimeout);
  systemThemeQuery.removeEventListener("change", handleSystemThemeChange);
  worker.value?.terminate();
});
</script>

<template>
  <section class="grid gap-6">
    <section aria-labelledby="intro-title" class="space-y-3">
      <h1 id="intro-title" class="text-2xl sm:text-3xl font-semibold text-highlighted">
        Private browser text to speech with Kokoro
      </h1>
      <p class="max-w-3xl text-sm sm:text-base leading-7 text-toned">
        LocalVoice Studio generates natural voice audio directly in your browser with no server, no
        tracking, and offline use after the first model download. Built by
        <a
          class="font-medium text-highlighted hover:text-primary transition-colors"
          href="https://martinmasevski.dev"
          target="_blank"
          rel="noreferrer"
        >
          Martin Masevski
        </a>
        and published as open source on
        <a
          class="font-medium text-highlighted hover:text-primary transition-colors"
          href="https://github.com/Archetipo95/localvoice-studio"
          target="_blank"
          rel="noreferrer"
        >
          GitHub
        </a>
        .
      </p>
    </section>

    <StudioSetup />

    <div class="grid gap-6">
      <VoiceBlend />
      <ScriptLab />
      <OutputSection />
    </div>
  </section>
</template>
