# LocalVoice Studio

A privacy-first, browser-based text-to-speech synthesis studio. Generate speech locally in your browser with no server, no data collection, and no external API calls.

Built with [Kokoro](https://github.com/remsky/Kokoro), TypeScript, Vite, and ONNX Runtime Web.

## Why Local-First?

This app runs **entirely in your browser**. No server, no cloud connection, and no backend processing:

- ✅ **Private**: Your text never leaves your device
- ✅ **Fast**: No network latency or round-trips
- ✅ **Independent**: Works offline after the model is downloaded
- ✅ **No tracking**: No analytics, cookies, or telemetry

## What It Is

Speech generation happens fully in the browser with no backend required:

- The UI runs as a static web app
- A Web Worker loads the TTS model and generates audio off the main thread
- WebGPU is preferred when the browser exposes `navigator.gpu` (faster GPU acceleration)
- The app falls back to WASM/CPU when WebGPU is unavailable or initialization fails

The app targets the Kokoro model directly in the browser through `kokoro-js`.

## Stack

- **[Vue 3](https://vuejs.org/)** - Reactive UI framework
- **[Vite](https://vitejs.dev/)** - Fast build tool and dev server
- **[TypeScript](https://www.typescriptlang.org/)** - Type-safe JavaScript
- **[Kokoro](https://github.com/remsky/Kokoro)** - State-of-the-art open-source TTS
- **[Nuxt UI](https://ui.nuxt.com/)** - Beautiful, accessible components
- **[ONNX Runtime Web](https://github.com/microsoft/onnxruntime)** - In-browser model inference
- **[Playwright](https://playwright.dev/)** - Browser automation testing
- **[Vitest](https://vitest.dev/)** - Unit testing

## Setup

Clone LocalVoice Studio, then enter the project directory and install dependencies.

```bash
cd <project-directory>
npm install
```

Optional: install Vite+ globally for direct `vp` usage.

```bash
curl -fsSL https://vite.plus | bash
```

## Run Locally

```bash
npm run dev
```

Then open the printed local Vite URL (typically `http://127.0.0.1:3000`).

**Note:** The first time you use the app, it will download the Kokoro model (~300MB) to your browser's cache. This is a one-time download that stays on your device for offline use.

## Build

```bash
npm run build
```

Preview the production build locally:

```bash
npm run preview
```

## Features

- 🎤 **Natural TTS** - Human-sounding speech synthesis with Kokoro
- 🗣️ **Multi-voice** - Choose from model-backed voice options
- ⚡ **Speed Control** - Adjust playback speed to your preference
- 📥 **Download** - Export generated speech as WAV files
- 🎚️ **Web Worker** - Off-thread processing keeps the UI responsive
- 🔄 **GPU/CPU** - Automatic runtime selection (WebGPU preferred, WASM fallback)
- 💾 **Offline** - Works offline after the first model download
- 🔐 **Private** - All processing happens in-browser, no external calls

## Privacy & Security

This project is designed with privacy as a core principle:

- **No Server**: There is no backend service. Everything runs locally on your machine.
- **No Data Transmission**: Your text input and generated audio never leave your device.
- **No Tracking**: No analytics, cookies, session logging, or telemetry.
- **Open Source**: The entire codebase is transparent and auditable.
- **Offline Capable**: After downloading the model once, the app works completely offline.
- **Browser Cache Only**: Models are stored only in your browser's local cache; clear your cookies to remove them.

**Hosting Note:** When you deploy this static site, the hosting provider can only serve the static files (HTML, CSS, JS). They cannot see your text inputs, audio outputs, or any real-time activity.

- WebGPU support varies by browser and platform.
- The app prefers WebGPU but retries on WASM/CPU if WebGPU setup fails.
- On first use, the app asks before downloading the browser model because the initial download is large.
- The default model repo is `onnx-community/Kokoro-82M-v1.0-ONNX`.

## Testing

Run unit tests:

```bash
npm run test:unit
```

Run E2E tests:

```bash
npm run test:e2e
```

Run accessibility tests:

```bash
npm run test:a11y
```

Run the full suite:

```bash
npm test
```

## Code Quality

Run static quality checks:

```bash
npm run check
```

Auto-fix formatting/linting/type issues where possible:

```bash
npm run check:fix
```

### Test Mode

The Playwright suite uses a built-in mock worker mode so tests stay fast and deterministic.

Useful query parameters:

- `?mockTts=1` uses a fake worker-backed TTS path
- `?mockTts=1&mockDevice=fallback` simulates a WebGPU failure followed by WASM fallback
- `?mockTts=1&mockDevice=wasm` simulates direct CPU/WASM startup

## Deployment

This app is static-hosting friendly. Any host that can serve the built `dist/` folder works, including:

- Vercel
- Netlify
- Cloudflare Pages
- GitHub Pages

## Project Governance

- Contribution guidelines: [CONTRIBUTING.md](./CONTRIBUTING.md)
- Security policy: [SECURITY.md](./SECURITY.md)
- License: [LICENSE](./LICENSE)
- Third-party attribution: [ATTRIBUTION.md](./ATTRIBUTION.md)

## Browser Model Caveat

The main risk is browser backend compatibility, especially WebGPU support. The app will restart on WASM/CPU when the browser cannot execute Kokoro reliably on WebGPU.

## Open Source Attribution

This project is built on top of exceptional open source software:

### Core TTS Engine

- **[Kokoro](https://github.com/remsky/Kokoro)** - Open-source, human-like speech synthesizer
  - Fast, naturally-sounding TTS with multi-voice support

### ML & Inference Runtime

- **[Transformers.js](https://huggingface.co/docs/transformers.js/)** (by Hugging Face) - Run transformers directly in the browser with ONNX Runtime Web
  - Enables in-browser inference without a backend server
- **[ONNX Runtime Web](https://github.com/microsoft/onnxruntime)** (by Microsoft) - Cross-platform inference engine
  - Powers fast model execution on GPU and CPU

### UI & Frontend

- **[Nuxt UI](https://ui.nuxt.com/)** - Beautiful, accessible Vue component library built on Headless UI and Tailwind CSS
  - Provides polished, production-ready UI components
- **[Vue 3](https://vuejs.org/)** - Progressive JavaScript framework
  - Reactive, component-based architecture
- **[Tailwind CSS](https://tailwindcss.com/)** - Utility-first CSS framework

### Development & Testing

- **[Vite](https://vitejs.dev/)** - Next-generation frontend build tool
  - Lightning-fast HMR and optimized production builds
- **[Playwright](https://playwright.dev/)** - Browser automation and testing
  - E2E and accessibility testing
- **[Vitest](https://vitest.dev/)** - Unit testing framework
  - Fast, Vite-native test runner
- **[Phonemizer](https://www.npmjs.com/package/phonemizer)** - Phonetic transcription library
  - For accurate pronunciation processing

### Special Thanks

- The Kokoro team for creating an exceptionally good open-source TTS model
- The Hugging Face community for democratizing ML model access
- The Vue and Vite communities for amazing developer experience
