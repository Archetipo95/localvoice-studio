# Changelog

All notable changes to this project will be documented in this file.

The format is inspired by [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and version numbers follow [Semantic Versioning](https://semver.org/).

Historical entries before `v1.1.2` were curated from git history to capture the
most important product and workflow changes that landed before the changelog was
fully automated.

## [1.2.0](https://github.com/Archetipo95/localvoice-studio/compare/v1.1.3...v1.2.0) (2026-04-15)

### 🚀 Features

* **changelog:** improve release rendering and section grouping ([3bbb9e6](https://github.com/Archetipo95/localvoice-studio/commit/3bbb9e6cc321ef8bd838721b6f7f1c3998ad89fe))
* **ui:** refine header links and footer navigation ([8496d00](https://github.com/Archetipo95/localvoice-studio/commit/8496d00ea5a61945690cf92d518597d04a91adbd))

### 🩹 Bug Fixes

* **tests:** update changelog API endpoint and response structure ([4e678b2](https://github.com/Archetipo95/localvoice-studio/commit/4e678b26cc9cd3dca0a25b309d7bee91a6b588e5))

### 📖 Documentation

* **changelog:** add emoji headings to historical release groups ([0d6f15d](https://github.com/Archetipo95/localvoice-studio/commit/0d6f15df55494e7291a7cf4962a94b813d655246))

## [1.1.3](https://github.com/Archetipo95/localvoice-studio/compare/v1.1.2...v1.1.3) (2026-04-15)

### 🩹 Bug Fixes

* **changelog:** use GitHub releases API instead of ungh cache ([99999fa](https://github.com/Archetipo95/localvoice-studio/commit/99999faeef5c6a4686ff08abde231c896dd7493e))

## [1.1.2](https://github.com/Archetipo95/localvoice-studio/compare/v1.1.1...v1.1.2) (2026-04-15)

### 🩹 Bug Fixes

* update tag format to use semantic versioning ([d22ec39](https://github.com/Archetipo95/localvoice-studio/commit/d22ec3906aabed02a2375fdea2d8577734a2697a))

## 1.1.1 (2026-04-15)

### 🩹 Bug Fixes

* add missing conventional commits preset for semantic-release ([ebb20be](https://github.com/Archetipo95/localvoice-studio/commit/ebb20be5d6c9ba9ca0db8c06c565696f263ce510))

### 🏡 Chores

* migrate release automation to semantic-release ([7ffd050](https://github.com/Archetipo95/localvoice-studio/commit/7ffd050636459a22b7f1700d0a18c087c7a04aa2))
* update semantic-release and related packages ([c867c7f](https://github.com/Archetipo95/localvoice-studio/commit/c867c7fc6c9acd8db0c6d6b4a865f2332d43ad7c))
* ignore generated changelog formatting ([f601081](https://github.com/Archetipo95/localvoice-studio/commit/f601081ab260b18f1784ac0b203e65d41e5cd465))
* use vite-plus config typing ([3f5a0bb](https://github.com/Archetipo95/localvoice-studio/commit/3f5a0bb10d7facb6c56b54bc69d385ddbd0a8edc))
* upgrade Node.js to v24 and Playwright to v1.59.1 across CI workflows ([58109fd](https://github.com/Archetipo95/localvoice-studio/commit/58109fd56ed559bb3fc3dc3e57976f9d8b18c8f2))
* update CI actions and dependencies ([dd2dd80](https://github.com/Archetipo95/localvoice-studio/commit/dd2dd80b91d7b68a4a93513d6619258bb5a3a481))

### 📦 CI

* make full npm audit non-blocking in security workflow ([222df1d](https://github.com/Archetipo95/localvoice-studio/commit/222df1d5bc431f263c75f754d3ef81dc0f7fc5da))
* enforce strict audit with scoped upstream exceptions ([1f1730b](https://github.com/Archetipo95/localvoice-studio/commit/1f1730bf7beb589e797c444804e0738592f6de26))

## 1.1.0 (2026-04-15)

### 🚀 Features

* add a dedicated changelog page to surface release history inside the app ([657f324](https://github.com/Archetipo95/localvoice-studio/commit/657f324a8b5d5a6702f6b835ec4fc0951dddb9de))
* deliver a comprehensive app refactor with Pinia-based store management, broader component modularization, and a much larger automated test suite across unit, e2e, and accessibility flows ([5508c1c](https://github.com/Archetipo95/localvoice-studio/commit/5508c1cdb98118bb56a538467bbb74adc9884f00))
* add SEO and PWA support, including manifest, icons, service worker, sitemap, and social preview assets ([013f9fd](https://github.com/Archetipo95/localvoice-studio/commit/013f9fd6368100f87e372ca54bab51e6fb7e4f6d))
* introduce pronunciation preview with toolbar controls, error handling, preview caching, and audio playback integration ([1a36e88](https://github.com/Archetipo95/localvoice-studio/commit/1a36e883f5ae88a070670abbc10d951c17b294f5), [c4ad828](https://github.com/Archetipo95/localvoice-studio/commit/c4ad828b66f6bb4cac4949ac6a6a1d4d3d02d715), [c672931](https://github.com/Archetipo95/localvoice-studio/commit/c672931caa8c9636ec7eb6b987262c050caed76f))
* overhaul the script editor UX with richer editing flows, annotation support, and more resilient toolbar behavior ([b745182](https://github.com/Archetipo95/localvoice-studio/commit/b74518256d8b7f5eac18db30df0c451cf6595499), [f76dc59](https://github.com/Archetipo95/localvoice-studio/commit/f76dc593331ed9ebc37c45edf1de36f6c0050312))
* improve long-text handling with better sentence splitting and editor scrolling behavior for large scripts ([bcda356](https://github.com/Archetipo95/localvoice-studio/commit/bcda356f7f19b67d0379ad3eabb8c5eb306e6075), [b56080d](https://github.com/Archetipo95/localvoice-studio/commit/b56080df968a8e70afc5fc36045a44a19badca14))
* extend generation history metadata to track output file sizes ([7f6ecc1](https://github.com/Archetipo95/localvoice-studio/commit/7f6ecc13e820c7d96f4444345e7d91c3ce06abc2))

### 🩹 Bug Fixes

* patch dependencies used by the security workflow ([647d1d5](https://github.com/Archetipo95/localvoice-studio/commit/647d1d5396f985fd44dca2d26594bbd15a32305f))

### 🏡 Chores

* standardize server and preview ports on `3000` for local development consistency ([e05b33e](https://github.com/Archetipo95/localvoice-studio/commit/e05b33ea48d4297e5c42b161b393675c1591effd))
* add automated releases and changelog generation scaffolding ([c0cfbbe](https://github.com/Archetipo95/localvoice-studio/commit/c0cfbbe3f8ae8f1e8900311cd6d263586f9d4864))

## 1.0.0 (2026-03-24)

### 🚀 Features

* initial public release ([38071d1](https://github.com/Archetipo95/localvoice-studio/commit/38071d1b3341b5be669af57f4dacea2ed7aef612))
