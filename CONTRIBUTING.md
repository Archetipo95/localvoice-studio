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

This repository uses Release Please to automate versioning, changelog updates, tags, and GitHub Releases.

- Do not manually edit `package.json` versions or `CHANGELOG.md` for normal feature work.
- Merge releasable work into `main`; Release Please will open or update the release PR automatically.
- Release PRs are kept as drafts so version bumps and notes stay easy to review before publication.
- Mark breaking changes with `!` in the commit header or a `BREAKING CHANGE:` footer so the next release can bump the major version correctly.
- Keep release-facing commits focused on `feat:`, `fix:`, `perf:`, and `revert:` when you want them to appear in release notes.
- If release notes need adjustment after merge, update the merged pull request description or follow the Release Please commit override flow.

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
- `perf:` and `revert:` stay eligible for release note entries without changing the basic SemVer rules.
- `feat!:` or any commit with `BREAKING CHANGE:` bumps the major version.
- `docs:`, `test:`, `chore:`, and similar commit types do not create a release on their own.

When possible, prefer squash-merge pull requests so the final merged commit message is clean and release notes stay readable.
