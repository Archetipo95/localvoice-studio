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
      <div class="flex items-center gap-4">
        <ULink to="/" class="flex flex-col">
          <span class="text-sm font-semibold text-highlighted">LocalVoice Studio</span>
          <span class="text-xs text-muted">Powered by Kokoro</span>
        </ULink>
      </div>
    </template>

    <template #right>
      <div class="flex items-center gap-2">
        <UButton
          color="neutral"
          variant="ghost"
          size="sm"
          leading-icon="i-heroicons-megaphone"
          label="Changelog"
          to="/changelog"
        />

        <UButton
          color="neutral"
          variant="ghost"
          size="sm"
          to="https://github.com/Archetipo95/localvoice-studio"
          target="_blank"
        >
          <svg aria-hidden="true" class="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
            <path
              d="M12 1.5C6.201 1.5 1.5 6.201 1.5 12c0 4.64 3.01 8.577 7.186 9.966.525.098.714-.228.714-.506 0-.25-.009-.913-.014-1.792-2.923.635-3.54-1.409-3.54-1.409-.478-1.214-1.167-1.538-1.167-1.538-.954-.652.072-.639.072-.639 1.055.074 1.61 1.084 1.61 1.084.938 1.607 2.46 1.143 3.06.874.095-.679.367-1.143.667-1.406-2.334-.266-4.788-1.167-4.788-5.193 0-1.147.41-2.086 1.083-2.821-.109-.266-.469-1.336.103-2.786 0 0 .883-.282 2.895 1.078A10.082 10.082 0 0 1 12 6.615c.893.004 1.793.121 2.634.355 2.011-1.36 2.892-1.078 2.892-1.078.574 1.45.214 2.52.105 2.786.675.735 1.081 1.674 1.081 2.821 0 4.036-2.458 4.924-4.798 5.185.377.324.713.965.713 1.945 0 1.404-.013 2.536-.013 2.881 0 .28.188.609.719.505A10.503 10.503 0 0 0 22.5 12c0-5.799-4.701-10.5-10.5-10.5Z"
            />
          </svg>
          <span>Open Source</span>
        </UButton>

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
      </div>
    </template>
  </UHeader>
</template>
