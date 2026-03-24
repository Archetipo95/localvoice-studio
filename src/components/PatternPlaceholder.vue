<template>
  <div
    class="border-accented relative flex min-h-14 items-center justify-center overflow-hidden rounded-sm border border-dashed px-4 opacity-75"
  >
    <svg class="stroke-inverted/10 absolute inset-0 h-full w-full" fill="none" aria-hidden="true">
      <defs>
        <pattern
          id="pattern-5c1e4f0e-62d5-498b-8ff0-cf77bb448c8e"
          height="10"
          patternUnits="userSpaceOnUse"
          width="10"
          x="0"
          y="0"
        >
          <path d="M-3 13 15-5M-5 5l18-18M-1 21 17 3" />
        </pattern>
      </defs>
      <rect
        fill="url(#pattern-5c1e4f0e-62d5-498b-8ff0-cf77bb448c8e)"
        height="100%"
        stroke="none"
        width="100%"
      />
    </svg>

    <slot />
  </div>
</template>
