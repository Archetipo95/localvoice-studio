<script setup lang="ts">
import { storeToRefs } from "pinia";
import { useVoiceStore } from "../stores/voice";

const voiceStore = useVoiceStore();
const { secondaryRatio } = storeToRefs(voiceStore);

function updateSecondaryRatio(e: Event) {
  voiceStore.secondaryRatio = Number((e.target as HTMLInputElement).value);
}
</script>

<template>
  <div class="flex flex-col gap-3 pt-4 border-t border-default">
    <h3 class="text-xs font-bold uppercase tracking-widest">Mix Intensity</h3>
    <p class="text-xs text-muted">
      This percentage is how much of the secondary voice is present in the main voice output.
    </p>
    <label class="flex flex-col gap-1.5">
      <div class="flex justify-between text-xs font-semibold">
        <span>Secondary Voice in Main</span>
        <span id="secondary-ratio-output">{{ secondaryRatio }}%</span>
      </div>
      <input
        id="secondary-ratio-input"
        aria-label="Secondary Voice Percentage in Main"
        type="range"
        class="w-full accent-primary cursor-pointer"
        min="0"
        max="100"
        step="5"
        :value="secondaryRatio"
        @input="updateSecondaryRatio"
      />
    </label>
  </div>
</template>
