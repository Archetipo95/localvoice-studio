<script setup lang="ts">
import { computed } from "vue";
import { storeToRefs } from "pinia";
import type { DropdownMenuItem } from "@nuxt/ui";
import { useUiStore } from "../stores/ui";

const uiStore = useUiStore();
const { themeMode } = storeToRefs(uiStore);

const themes = ["system", "light", "dark"] as const;

function themeIcon(mode: (typeof themes)[number]) {
  if (mode === "system") return "i-heroicons-computer-desktop";
  if (mode === "light") return "i-heroicons-sun";
  return "i-heroicons-moon";
}

function themeLabel(mode: (typeof themes)[number]) {
  return mode.charAt(0).toUpperCase() + mode.slice(1);
}

const themeMenuItems = computed<DropdownMenuItem[]>(() =>
  themes.map((mode) => ({
    label: themeLabel(mode),
    icon: themeIcon(mode),
    onSelect: () => uiStore.setThemeMode(mode),
    class: themeMode.value === mode ? "font-semibold" : undefined,
  })),
);
</script>

<template>
  <UHeader :toggle="false">
    <template #left>
      <div class="flex flex-col">
        <span class="text-sm font-semibold text-highlighted">LocalVoice Studio</span>
        <span class="text-xs text-muted">Powered by Kokoro</span>
      </div>
    </template>

    <template #right>
      <UDropdownMenu
        :items="themeMenuItems"
        :content="{ align: 'end', side: 'bottom', sideOffset: 8 }"
        :ui="{ content: 'z-[120] w-48' }"
      >
        <UButton
          color="neutral"
          variant="ghost"
          size="sm"
          :icon="themeIcon(themeMode)"
          trailing-icon="i-heroicons-chevron-down"
          :label="themeLabel(themeMode)"
        />
      </UDropdownMenu>
    </template>
  </UHeader>
</template>
