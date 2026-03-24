# Contributing

Thanks for helping improve LocalVoice Studio.

## Development Setup

1. Install Node.js 20 or newer.
2. Install dependencies:

```bash
npm install
```

3. Start the dev server:

```bash
npm run dev
```

## Quality Gates

Run these checks before opening a pull request:

```bash
npm run check
npm run test:unit
npm run test:e2e
npm run test:a11y
npm run build
```

Auto-fix formatting and lint issues where Vite+ supports it:

```bash
npm run check:fix
```

## Pull Request Guidelines

1. Keep PRs focused and small.
2. Include tests for behavior changes.
3. Update docs when behavior, commands, or workflows change.
4. Ensure all CI checks pass before requesting review.

## Commit Guidance

Use clear commit messages that describe intent and impact.

Example format:

```text
feat: add fallback indicator when WebGPU is unavailable
fix: prevent duplicate worker initialization on model reload
```
