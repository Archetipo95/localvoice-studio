<script setup lang="ts">
import { computed, onMounted } from "vue";

import ReleaseMarkdown from "../components/ReleaseMarkdown.vue";
import { GITHUB_CHANGELOG_URL, useChangelog } from "../composables/useChangelog";

const { versions, pending, error, refresh } = useChangelog();

const skeletonVersions = Array.from({ length: 3 }, (_, index) => index);
const hasVersions = computed(() => versions.value.length > 0);

function extractVersionToken(text: string): string | null {
  const match = text.match(/v?(\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?)/i);
  return match?.[1]?.toLowerCase() || null;
}

function formatVersionTitle(title: string): string {
  const trimmedTitle = title.trim();

  if (/^v\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/i.test(trimmedTitle)) {
    return trimmedTitle;
  }

  if (/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/i.test(trimmedTitle)) {
    return `v${trimmedTitle}`;
  }

  return title;
}

function shouldShowTag(version: { title: string; tag: string }): boolean {
  const titleVersion = extractVersionToken(version.title);
  const tagVersion = extractVersionToken(version.tag);

  if (titleVersion && tagVersion) {
    return titleVersion !== tagVersion;
  }

  return version.title.trim().toLowerCase() !== version.tag.trim().toLowerCase();
}

onMounted(() => {
  document.title = "Changelog - LocalVoice Studio";
});
</script>

<template>
  <section class="space-y-8">
    <section class="space-y-3">
      <h1 class="text-3xl sm:text-4xl font-semibold text-highlighted">Changelog</h1>
      <p class="max-w-2xl text-sm sm:text-base leading-7 text-toned">
        Version notes for LocalVoice Studio, sourced directly from the repository changelog with a
        cleaner, timeline-style reading experience.
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
      title="Unable to load the changelog right now"
      :description="error.message"
      :actions="[
        {
          label: 'Try again',
          color: 'neutral',
          variant: 'soft',
          onClick: refresh,
        },
        {
          label: 'Open CHANGELOG.md',
          color: 'neutral',
          variant: 'ghost',
          to: GITHUB_CHANGELOG_URL,
          target: '_blank',
        },
      ]"
    />

    <UEmpty
      v-else-if="!hasVersions"
      icon="i-heroicons-clock"
      title="No changelog entries available yet"
      description="Add entries to CHANGELOG.md and they will appear here automatically."
      :actions="[
        {
          label: 'Open CHANGELOG.md',
          color: 'neutral',
          variant: 'soft',
          to: GITHUB_CHANGELOG_URL,
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
        <div class="flex flex-wrap items-center gap-3 leading-none">
          <span class="text-lg font-semibold tracking-tight text-highlighted sm:text-xl">
            {{ formatVersionTitle(version.title) }}
          </span>
          <UBadge
            v-if="shouldShowTag(version)"
            color="neutral"
            variant="subtle"
            :label="version.tag"
            class="font-mono text-[11px] uppercase tracking-[0.18em]"
          />
        </div>
      </template>

      <template #body="{ version }">
        <div
          class="mt-2 space-y-5 rounded-2xl border border-default/70 bg-default/35 p-5 shadow-sm ring-1 ring-default/40 sm:mt-3 sm:p-6"
        >
          <ReleaseMarkdown
            v-if="version.markdown"
            :value="version.markdown"
            class="release-markdown-card"
          />

          <div v-if="version.url" class="flex justify-start">
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
