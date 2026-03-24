<script setup lang="ts">
import { onMounted, onUnmounted, watch } from "vue";
import { useAppState } from "./composables/useAppState";
import { initWorker, requestPreviews } from "./composables/useTtsWorker";
import { modelDownloadApproved, themeMode } from "./composables/useUiState";
import { applyThemeMode } from "./utils/theme";

import AppTopHeader from "./components/AppTopHeader.vue";
import StudioSetup from "./components/StudioSetup.vue";
import VoiceBlend from "./components/VoiceBlend.vue";
import ScriptLab from "./components/ScriptLab.vue";
import OutputSection from "./components/OutputSection.vue";

const { state } = useAppState();
const PREVIEW_DEBOUNCE_MS = 300;

let previewTimeout: number | undefined;
watch(
  () => [
    state.value.selectedVoice,
    state.value.secondaryVoice,
    state.value.secondaryRatio,
    state.value.speed,
    state.value.pitchSemitones,
    state.value.sentencePauseMs,
    state.value.newlinePauseMs,
    state.value.paragraphPauseMs,
  ],
  () => {
    clearTimeout(previewTimeout);
    previewTimeout = window.setTimeout(() => requestPreviews(), PREVIEW_DEBOUNCE_MS);
  },
  { immediate: true },
);

const MODEL_DOWNLOAD_APPROVAL_KEY_PREFIX = "kokoro-model-download-approved:";

function modelDownloadApprovalKey(model = state.value.model) {
  return `${MODEL_DOWNLOAD_APPROVAL_KEY_PREFIX}${model.modelId}`;
}

function hasModelDownloadApproval() {
  try {
    return window.localStorage.getItem(modelDownloadApprovalKey()) === "1";
  } catch {
    return false;
  }
}

function isMockTtsMode() {
  const url = new URL(window.location.href);
  return url.searchParams.get("mockTts") === "1";
}

onMounted(() => {
  modelDownloadApproved.value = hasModelDownloadApproval() || isMockTtsMode();
  applyThemeMode(themeMode.value);

  const systemThemeQuery = window.matchMedia("(prefers-color-scheme: dark)");
  const handleSystemThemeChange = () => {
    if (themeMode.value === "system") applyThemeMode(themeMode.value);
  };
  systemThemeQuery.addEventListener("change", handleSystemThemeChange);

  document.addEventListener(
    "play",
    (e) => {
      if (e.target instanceof HTMLAudioElement) {
        document.querySelectorAll("audio").forEach((audio) => {
          if (audio !== e.target && !audio.paused) {
            audio.pause();
            audio.currentTime = 0;
          }
        });
      }
    },
    true,
  );

  watch(
    modelDownloadApproved,
    (approved) => {
      if (approved && !isMockTtsMode()) {
        try {
          window.localStorage.setItem(modelDownloadApprovalKey(), "1");
        } catch {}
      }
    },
    { immediate: true },
  );

  if (modelDownloadApproved.value) {
    initWorker();
  }

  onUnmounted(() => {
    systemThemeQuery.removeEventListener("change", handleSystemThemeChange);
  });
});
</script>

<template>
  <UApp>
    <AppTopHeader />

    <UMain>
      <UContainer class="py-6">
        <section class="grid gap-6">
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
          class="text-muted hover:text-highlighted transition-colors"
          href="https://github.com/Archetipo95/localvoice-studio"
          target="_blank"
          rel="noreferrer"
        >
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
