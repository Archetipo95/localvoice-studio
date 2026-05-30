<script setup lang="ts">
import AppTopHeader from "./components/AppTopHeader.vue";
import { RouterView } from "vue-router";

const appVersion = __APP_VERSION__;
</script>

<template>
  <UApp>
    <AppTopHeader />

    <UMain>
      <UContainer class="py-6">
        <RouterView />
      </UContainer>
    </UMain>

    <UFooter :ui="{ container: 'w-full max-w-none px-4 sm:px-6 lg:px-8' }">
      <template #left>
        <div class="flex items-center gap-4 text-sm">
          <p class="text-muted">LocalVoice Studio</p>
          <p class="text-muted">v{{ appVersion }}</p>
        </div>
      </template>

      <template #right>
        <a
          class="text-sm text-muted text-center hover:text-highlighted transition-colors"
          href="https://martinmasevski.dev"
          target="_blank"
          rel="noreferrer"
        >
          Made with 💚 by Martin Masevski
        </a>
      </template>
    </UFooter>
  </UApp>
</template>
