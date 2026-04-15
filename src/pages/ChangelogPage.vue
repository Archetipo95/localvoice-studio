<script setup lang="ts">
import { computed, onMounted } from "vue";

import ReleaseMarkdown from "../components/ReleaseMarkdown.vue";
import { GITHUB_RELEASES_PAGE_URL, useGithubReleases } from "../composables/useGithubReleases";

const { versions, pending, error, refresh } = useGithubReleases();

const skeletonVersions = Array.from({ length: 3 }, (_, index) => index);
const hasVersions = computed(() => versions.value.length > 0);

onMounted(() => {
  document.title = "Changelog - LocalVoice Studio";
});
</script>

<template>
  <section class="space-y-8">
    <section class="space-y-3">
      <UBadge color="neutral" variant="soft" label="Release history" />
      <h1 class="text-3xl sm:text-4xl font-semibold text-highlighted">Changelog</h1>
      <p class="max-w-2xl text-sm sm:text-base leading-7 text-toned">
        Version notes for LocalVoice Studio, generated from published GitHub releases with a
        cleaner, Nuxt-inspired reading experience.
      </p>
    </section>

    <div v-if="pending" class="space-y-8" aria-live="polite" aria-busy="true">
      <div
        v-for="version in skeletonVersions"
        :key="version"
        class="grid gap-4 sm:grid-cols-[11rem_1fr]"
      >
        <div class="space-y-3">
          <USkeleton class="h-4 w-24" />
          <USkeleton class="h-4 w-14" />
        </div>
        <div class="space-y-3 rounded-2xl border border-default/60 bg-default/20 p-5">
          <USkeleton class="h-8 w-56" />
          <USkeleton class="h-4 w-full" />
          <USkeleton class="h-4 w-[92%]" />
          <USkeleton class="h-4 w-[85%]" />
        </div>
      </div>
    </div>

    <UAlert
      v-else-if="error"
      color="error"
      variant="soft"
      icon="i-heroicons-exclamation-triangle"
      title="Unable to load changelog entries right now"
      :description="error.message"
      :actions="[
        {
          label: 'Try again',
          color: 'neutral',
          variant: 'soft',
          onClick: refresh,
        },
        {
          label: 'Open GitHub Releases',
          color: 'neutral',
          variant: 'ghost',
          to: GITHUB_RELEASES_PAGE_URL,
          target: '_blank',
        },
      ]"
    />

    <UEmpty
      v-else-if="!hasVersions"
      icon="i-heroicons-clock"
      title="No releases published yet"
      description="The release feed is ready. The first published GitHub release will appear here automatically."
      :actions="[
        {
          label: 'View Releases on GitHub',
          color: 'neutral',
          variant: 'soft',
          to: GITHUB_RELEASES_PAGE_URL,
          target: '_blank',
        },
      ]"
    />

    <UChangelogVersions
      v-else
      as="main"
      :versions="versions"
      :indicator-motion="false"
      :ui="{
        root: 'py-2 sm:py-4',
        indicator: 'inset-y-0',
      }"
    >
      <template #title="{ version }">
        <div class="flex flex-wrap items-center gap-3">
          <span>{{ version.title }}</span>
          <UBadge
            color="neutral"
            variant="subtle"
            :label="version.tag"
            class="font-mono text-[11px] uppercase tracking-[0.18em]"
          />
        </div>
      </template>

      <template #body="{ version }">
        <div class="space-y-4">
          <ReleaseMarkdown
            v-if="version.markdown"
            :value="version.markdown"
            class="border-t border-default/60 pt-4"
          />

          <div class="flex justify-start">
            <UButton
              color="neutral"
              variant="ghost"
              icon="i-heroicons-arrow-top-right-on-square"
              label="View on GitHub"
              :to="version.url"
              target="_blank"
            />
          </div>
        </div>
      </template>
    </UChangelogVersions>
  </section>
</template>
