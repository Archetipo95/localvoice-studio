<script setup lang="ts">
import { computed, ref } from "vue";
import { removeHistoryOutput, renameHistoryOutput } from "../composables/useTtsWorker";
import { generationHistory } from "../composables/useGenerationHistory";

const historyRenameDrafts = ref<Record<string, string>>({});
const historySearch = ref("");
const historyVoiceFilter = ref("all");

const historyVoices = computed(() => {
  const voices = new Set(generationHistory.value.map((item) => item.voice));
  return [...voices].sort((a, b) => a.localeCompare(b));
});

const filteredGenerationHistory = computed(() => {
  const query = historySearch.value.trim().toLowerCase();
  return generationHistory.value.filter((item) => {
    if (historyVoiceFilter.value !== "all" && item.voice !== historyVoiceFilter.value) {
      return false;
    }
    if (!query) return true;
    return [
      item.fileName,
      item.textPreview,
      item.voice,
      item.secondaryVoice,
      formatTimestamp(item.createdAt),
    ]
      .join(" ")
      .toLowerCase()
      .includes(query);
  });
});

function formatDuration(ms: number) {
  if (ms < 1000) return `${ms} ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)} s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${(seconds - minutes * 60).toFixed(1)}s`;
}

function formatStoredSize(bytes: number) {
  const megabytes = bytes / (1024 * 1024);
  if (megabytes < 0.01) {
    return "< 0.01 MB";
  }
  return `${megabytes.toFixed(2)} MB`;
}

function formatTimestamp(timestamp: number) {
  return new Date(timestamp).toLocaleString();
}

function handleRenameHistory(itemId: string, fallback: string) {
  const nextName = (historyRenameDrafts.value[itemId] || fallback).trim();
  if (!nextName) return;
  renameHistoryOutput(itemId, nextName);
}

async function handleRemoveHistory(itemId: string) {
  delete historyRenameDrafts.value[itemId];
  await removeHistoryOutput(itemId);
}
</script>

<template>
  <div v-if="generationHistory.length > 0" class="rounded-xl ring ring-default bg-default p-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h3 class="text-xs font-bold uppercase tracking-widest">Recent generated files</h3>
      <span class="text-xs text-muted">
        Showing {{ filteredGenerationHistory.length }} of {{ generationHistory.length }}
      </span>
    </div>

    <div class="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
      <UInput
        v-model="historySearch"
        size="sm"
        icon="i-heroicons-magnifying-glass"
        placeholder="Search filename, text, voice..."
      />
      <USelectMenu
        v-model="historyVoiceFilter"
        size="sm"
        value-key="value"
        :items="[
          { label: 'All voices', value: 'all' },
          ...historyVoices.map((voice) => ({ label: voice, value: voice })),
        ]"
      />
    </div>

    <div class="mt-3 grid max-h-96 gap-3 overflow-y-auto pr-1">
      <div
        v-if="filteredGenerationHistory.length === 0"
        class="rounded-lg border border-dashed border-muted/70 bg-elevated p-4 text-sm text-muted"
      >
        No recent files match the current search and filters.
      </div>

      <div
        v-for="item in filteredGenerationHistory"
        :key="item.id"
        class="rounded-lg border border-muted/70 bg-elevated p-3"
      >
        <div class="flex flex-wrap items-center justify-between gap-2">
          <p class="text-sm font-semibold text-highlighted">{{ item.fileName }}</p>
          <p class="text-xs text-muted">{{ formatTimestamp(item.createdAt) }}</p>
        </div>
        <p class="mt-1 text-xs text-muted line-clamp-2">{{ item.textPreview }}</p>
        <div class="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-muted">
          <span>{{ item.voice }}</span>
          <span>16-bit WAV</span>
          <span>Stored {{ formatStoredSize(item.sizeBytes) }}</span>
          <span>{{ formatDuration(item.durationMs) }}</span>
          <span>{{ item.textLength }} chars</span>
        </div>
        <div class="mt-3 rounded-xl p-3 ring ring-default bg-default transition-all">
          <audio
            :id="`history-audio-${item.id}`"
            class="w-full outline-none h-8 rounded-lg"
            controls
            preload="metadata"
            :src="item.audioUrl"
          >
            <a :href="item.audioUrl" :download="item.fileName"
              >Play or download {{ item.fileName }}</a
            >
          </audio>
        </div>
        <div class="mt-3 flex flex-wrap items-center gap-2">
          <UInput
            v-model="historyRenameDrafts[item.id]"
            class="min-w-56"
            size="xs"
            :placeholder="item.fileName"
          />
          <UButton
            size="xs"
            variant="soft"
            color="neutral"
            @click="handleRenameHistory(item.id, item.fileName)"
          >
            Rename
          </UButton>
          <UButton
            size="xs"
            variant="outline"
            color="neutral"
            :to="item.audioUrl"
            :download="item.fileName"
            target="_blank"
          >
            Download
          </UButton>
          <UButton
            size="xs"
            variant="outline"
            color="error"
            icon="i-heroicons-trash"
            @click="handleRemoveHistory(item.id)"
          >
            Remove
          </UButton>
        </div>
      </div>
    </div>
  </div>
</template>
