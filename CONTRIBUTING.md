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

## Releases

This repository uses semantic-release to automate versioning, changelog updates, tags, and GitHub Releases.

- Do not manually edit `package.json` versions or `CHANGELOG.md` for normal feature work.
- Merge releasable work into `main`; semantic-release runs on push and creates releases automatically.
- Mark breaking changes with `!` in the commit header or a `BREAKING CHANGE:` footer so the next release can bump the major version correctly.
- Use Conventional Commits so release notes and version bumps stay predictable.

## Commit Guidance

Use clear commit messages that describe intent and impact. This project follows the Conventional Commits format for automated releases.

Example format:

```text
feat: add fallback indicator when WebGPU is unavailable
fix: prevent duplicate worker initialization on model reload
docs: clarify offline model caching behavior
chore: update contributor setup instructions
feat!: remove deprecated voice preset storage format
refactor: simplify worker startup error handling
```

Release impact:

- `feat:` bumps the minor version.
- `fix:` bumps the patch version.
- `perf:`, `revert:`, and `deps:` bump the patch version.
- `chore:`, `ci:`, `docs:`, `refactor:`, and `test:` bump the patch version.
- `feat!:` or any commit with `BREAKING CHANGE:` bumps the major version.

When possible, prefer squash-merge pull requests so the final merged commit message is clean and release notes stay readable.
