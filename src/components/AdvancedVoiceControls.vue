<script setup lang="ts">
import { storeToRefs } from "pinia";
import { useVoiceStore } from "../stores/voice";

const voiceStore = useVoiceStore();
const { speed, pitchSemitones, pauses } = storeToRefs(voiceStore);

const formatPitchSemitones = (st: number) => {
  if (Math.abs(st) < 0.01) return "0 st";
  return `${st > 0 ? "+" : ""}${st.toFixed(1)} st`;
};

function updateSpeed(e: Event) {
  voiceStore.speed = Number((e.target as HTMLInputElement).value);
}

function updatePitch(e: Event) {
  voiceStore.setPitch(Number((e.target as HTMLInputElement).value));
}
</script>

<template>
  <div
    id="tune-drawer"
    class="mt-2 flex flex-col gap-6 p-4 rounded-xl ring ring-default bg-default"
  >
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <!-- Delivery column -->
      <div class="flex flex-col gap-4">
        <h3 class="text-xs font-bold uppercase tracking-widest">Delivery</h3>

        <label class="flex flex-col gap-1.5">
          <div class="flex justify-between text-xs font-semibold">
            <span>Speed</span>
            <span>{{ speed.toFixed(2) }}x</span>
          </div>
          <input
            id="speed-input"
            aria-label="Speed"
            type="range"
            class="w-full accent-primary cursor-pointer"
            min="0.5"
            max="2"
            step="0.1"
            :value="speed"
            @input="updateSpeed"
          />
        </label>

        <label class="flex flex-col gap-1.5 mt-2">
          <div class="flex justify-between text-xs font-semibold">
            <span>Pitch</span>
            <span id="pitch-output">{{ formatPitchSemitones(pitchSemitones) }}</span>
          </div>
          <input
            id="pitch-input"
            aria-label="Pitch"
            type="range"
            class="w-full accent-primary cursor-pointer"
            min="-6"
            max="6"
            step="1"
            :value="pitchSemitones"
            @input="updatePitch"
          />
        </label>
      </div>

      <!-- Pauses column -->
      <div
        class="flex flex-col gap-4 border-t border-default pt-4 md:border-t-0 md:pt-0 md:border-l md:border-default md:pl-6"
      >
        <h3 class="text-xs font-bold uppercase tracking-widest">Pauses (ms)</h3>
        <div class="flex flex-col gap-3">
          <label class="flex cursor-pointer items-center justify-between text-sm">
            <span class="text-xs font-semibold">Sentence</span>
            <UInput
              type="number"
              class="w-20"
              min="0"
              step="50"
              :model-value="pauses.sentence.value"
              @update:model-value="pauses.sentence.value = Math.max(Number($event), 0)"
            />
          </label>
          <label class="flex cursor-pointer items-center justify-between text-sm">
            <span class="text-xs font-semibold">Newline</span>
            <UInput
              type="number"
              class="w-20"
              min="0"
              step="50"
              :model-value="pauses.newline.value"
              @update:model-value="pauses.newline.value = Math.max(Number($event), 0)"
            />
          </label>
          <label class="flex cursor-pointer items-center justify-between text-sm">
            <span class="text-xs font-semibold">Paragraph</span>
            <UInput
              type="number"
              class="w-20"
              min="0"
              step="50"
              :model-value="pauses.paragraph.value"
              @update:model-value="pauses.paragraph.value = Math.max(Number($event), 0)"
            />
          </label>
        </div>
      </div>
    </div>
  </div>
</template>
