<script setup lang="ts">
import AppTopHeader from "./components/AppTopHeader.vue";
import { RouterView } from "vue-router";
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
          <ULink class="text-muted hover:text-highlighted transition-colors" to="/changelog">
            Changelog
          </ULink>
        </div>
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
        <div class="flex items-center gap-4">
          <ULink class="text-sm text-muted hover:text-highlighted transition-colors" to="/">
            Studio
          </ULink>

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
        </div>
      </template>
    </UFooter>
  </UApp>
</template>
