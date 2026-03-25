<template>
  <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pb-4 pt-1">
    <div class="flex flex-col gap-1.5 p-3 rounded-lg bg-default ring ring-default">
      <div
        class="flex items-center gap-1.5 text-xs font-semibold text-warning uppercase tracking-wide"
      >
        <UIcon name="i-heroicons-musical-note" class="size-3.5 shrink-0" />
        Pronunciation
      </div>
      <p class="text-xs text-muted">Force a custom phonetic reading using IPA notation.</p>
      <div class="mt-1 rounded bg-elevated px-2.5 py-1.5 font-mono text-xs text-highlighted">
        [word]<span class="text-muted">(</span>/phonemes/<span class="text-muted">)</span>
      </div>
      <p class="text-xs text-muted font-mono break-all">[Kokoro](/kˈOʊkəɹOʊ/)</p>
      <p class="text-xs text-muted">
        Type <span class="font-mono text-highlighted">:</span> inside a pronunciation slot to open
        the IPA symbol menu.
      </p>
    </div>

    <div class="flex flex-col gap-1.5 p-3 rounded-lg bg-default ring ring-default">
      <div
        class="flex items-center gap-1.5 text-xs font-semibold text-warning uppercase tracking-wide"
      >
        <UIcon name="i-heroicons-pause-circle" class="size-3.5 shrink-0" />
        Pause
      </div>
      <p class="text-xs text-muted">Insert a timed silence — value in milliseconds.</p>
      <div class="mt-1 rounded bg-elevated px-2.5 py-1.5 font-mono text-xs text-highlighted">
        [label]<span class="text-muted">(</span>break:<span class="text-warning">500</span
        ><span class="text-muted">)</span>
      </div>
      <p class="text-xs text-muted font-mono break-all">[pause here](break:500)</p>
    </div>

    <div class="flex flex-col gap-1.5 p-3 rounded-lg bg-default ring ring-default">
      <div
        class="flex items-center gap-1.5 text-xs font-semibold text-warning uppercase tracking-wide"
      >
        <UIcon name="i-heroicons-chevron-double-up" class="size-3.5 shrink-0" />
        <UIcon name="i-heroicons-chevron-double-down" class="size-3.5 shrink-0" />
        Emphasis
      </div>
      <p class="text-xs text-muted">Reduce or increase how strongly a word is stressed.</p>
      <div
        class="mt-1 rounded bg-elevated px-2.5 py-1.5 font-mono text-xs text-highlighted wrap-break-word"
      >
        [word]<span class="text-muted">(</span><span class="text-warning">-1</span
        ><span class="text-muted">)</span> · [word]<span class="text-muted">(</span
        ><span class="text-warning">+1</span><span class="text-muted">)</span>
      </div>
      <p class="text-xs text-muted font-mono break-all">[softer](-1) · [stronger](+1)</p>
    </div>

    <div class="flex flex-col gap-1.5 p-3 rounded-lg bg-default ring ring-default">
      <div
        class="flex items-center gap-1.5 text-xs font-semibold text-warning uppercase tracking-wide"
      >
        <UIcon name="i-heroicons-bars-3" class="size-3.5 shrink-0" />
        Rhythm &amp; Tuning
      </div>
      <p class="text-xs text-muted">Shape natural pacing with punctuation or stress markers.</p>
      <div
        class="mt-1 rounded bg-elevated px-2.5 py-1.5 font-mono text-xs text-highlighted wrap-break-word"
      >
        ; : , . ! ? ˈ ˌ
      </div>
      <p class="text-xs text-muted">Place inline to hint at pauses and intonation.</p>
    </div>
  </div>
</template>
