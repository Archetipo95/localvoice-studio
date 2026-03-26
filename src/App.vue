<script setup lang="ts">
import { onMounted, onUnmounted, watch } from "vue";
import type { ModelDefinition } from "./types";
import { useGenerationStore } from "./stores/generation";
import { useVoiceStore } from "./stores/voice";
import { useUiStore } from "./stores/ui";
import {
  initWorker,
  requestPreviews,
  setupWorkerWatchers,
  worker,
} from "./composables/useTtsWorker";
import { resolveInitialModel, syncModelUrl } from "./config/model-config";
import { useAudioPlayback } from "./composables/useAudioPlayback";
import { applyThemeMode } from "./utils/theme";
import { hydrateGenerationHistoryFromCache } from "./composables/useGenerationHistory";

import AppTopHeader from "./components/AppTopHeader.vue";
import StudioSetup from "./components/StudioSetup.vue";
import VoiceBlend from "./components/VoiceBlend.vue";
import ScriptLab from "./components/ScriptLab.vue";
import OutputSection from "./components/OutputSection.vue";

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
  <UApp>
    <AppTopHeader />

    <UMain>
      <UContainer class="py-6">
        <section class="grid gap-6">
          <section aria-labelledby="intro-title" class="space-y-3">
            <h1 id="intro-title" class="text-2xl sm:text-3xl font-semibold text-highlighted">
              Private browser text to speech with Kokoro
            </h1>
            <p class="max-w-3xl text-sm sm:text-base leading-7 text-toned">
              LocalVoice Studio generates natural voice audio directly in your browser with no
              server, no tracking, and offline use after the first model download. Built by
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
      </UContainer>
    </UMain>

    <UFooter :ui="{ container: 'w-full max-w-none px-4 sm:px-6 lg:px-8' }">
      <template #left>
        <p class="text-sm text-muted">LocalVoice Studio</p>
      </template>

      <a
        class="text-sm text-muted text-center hover:text-highlighted transition-colors"
        href="https://martinmasevski.dev"
        target="_blank"
        rel="noreferrer"
      >
        Made with 💚 by Martin Masevski
      </a>

      <template #right>
        <a
          aria-label="View the LocalVoice Studio repository on GitHub"
          class="text-muted hover:text-highlighted transition-colors flex items-center gap-1"
          href="https://github.com/Archetipo95/localvoice-studio"
          target="_blank"
          rel="noreferrer"
        >
          Open Source
          <svg aria-hidden="true" class="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
            <path
              d="M12 1.5C6.201 1.5 1.5 6.201 1.5 12c0 4.64 3.01 8.577 7.186 9.966.525.098.714-.228.714-.506 0-.25-.009-.913-.014-1.792-2.923.635-3.54-1.409-3.54-1.409-.478-1.214-1.167-1.538-1.167-1.538-.954-.652.072-.639.072-.639 1.055.074 1.61 1.084 1.61 1.084.938 1.607 2.46 1.143 3.06.874.095-.679.367-1.143.667-1.406-2.334-.266-4.788-1.167-4.788-5.193 0-1.147.41-2.086 1.083-2.821-.109-.266-.469-1.336.103-2.786 0 0 .883-.282 2.895 1.078A10.082 10.082 0 0 1 12 6.615c.893.004 1.793.121 2.634.355 2.011-1.36 2.892-1.078 2.892-1.078.574 1.45.214 2.52.105 2.786.675.735 1.081 1.674 1.081 2.821 0 4.036-2.458 4.924-4.798 5.185.377.324.713.965.713 1.945 0 1.404-.013 2.536-.013 2.881 0 .28.188.609.719.505A10.503 10.503 0 0 0 22.5 12c0-5.799-4.701-10.5-10.5-10.5Z"
            />
          </svg>
        </a>
      </template>
    </UFooter>
  </UApp>
</template>
