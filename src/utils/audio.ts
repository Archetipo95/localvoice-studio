export function audioBufferToWavBlob(
  audioBuffer: ArrayBuffer,
  sampleRate: number,
  mimeType = "audio/wav",
): Blob {
  const pcm = new Float32Array(audioBuffer);
  const encoded = encodeWav(pcm, sampleRate);
  return new Blob([encoded], { type: mimeType });
}

export function decodeWavAudioBuffer(
  audioBuffer: ArrayBuffer,
): { samples: Float32Array; sampleRate: number } | null {
  if (audioBuffer.byteLength < 44) {
    return null;
  }

  const view = new DataView(audioBuffer);
  if (
    readAscii(view, 0, 4) !== "RIFF" ||
    readAscii(view, 8, 4) !== "WAVE" ||
    readAscii(view, 12, 4) !== "fmt "
  ) {
    return null;
  }

  const formatCode = view.getUint16(20, true);
  const channelCount = view.getUint16(22, true);
  const sampleRate = view.getUint32(24, true);
  const bitsPerSample = view.getUint16(34, true);
  if (formatCode !== 1 || channelCount <= 0 || bitsPerSample !== 16) {
    return null;
  }

  let offset = 36;
  while (offset + 8 <= view.byteLength) {
    const chunkId = readAscii(view, offset, 4);
    const chunkSize = view.getUint32(offset + 4, true);
    offset += 8;

    if (chunkId === "data") {
      const frameCount = Math.floor(chunkSize / (channelCount * 2));
      const samples = new Float32Array(frameCount);

      for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
        const sampleOffset = offset + frameIndex * channelCount * 2;
        const sample = view.getInt16(sampleOffset, true);
        samples[frameIndex] = sample / (sample < 0 ? 0x8000 : 0x7fff);
      }

      return { samples, sampleRate };
    }

    offset += chunkSize;
    if (chunkSize % 2 === 1) {
      offset += 1;
    }
  }

  return null;
}

export function mergeAudioChunks(
  chunks: readonly Float32Array[],
  sampleRate: number,
  pauseMs: number | readonly number[] = 150,
): Float32Array {
  if (chunks.length === 0) {
    return new Float32Array(0);
  }

  const pauses =
    typeof pauseMs === "number"
      ? Array.from({ length: Math.max(0, chunks.length - 1) }, () => pauseMs)
      : Array.from({ length: Math.max(0, chunks.length - 1) }, (_, index) => pauseMs[index] ?? 0);

  if (chunks.length === 1) {
    const first = chunks[0];
    return first ? new Float32Array(first) : new Float32Array(0);
  }

  const pauseSamples = pauses.map((pause) => Math.max(0, Math.round((sampleRate * pause) / 1000)));
  const totalSamples =
    chunks.reduce((sum, chunk) => sum + chunk.length, 0) +
    pauseSamples.reduce((sum, pause) => sum + pause, 0);
  const merged = new Float32Array(totalSamples);

  let offset = 0;
  chunks.forEach((chunk, index) => {
    merged.set(chunk, offset);
    offset += chunk.length;

    if (index < chunks.length - 1) {
      offset += pauseSamples[index] ?? 0;
    }
  });

  return merged;
}

export function pitchShiftAudio(samples: Float32Array, semitones: number): Float32Array {
  if (samples.length === 0) {
    return new Float32Array(0);
  }

  if (!Number.isFinite(semitones) || Math.abs(semitones) < 0.01) {
    return new Float32Array(samples);
  }

  const ratio = 2 ** (semitones / 12);
  const pitchScaled = resampleLinear(samples, Math.max(1, Math.round(samples.length / ratio)));
  const stretched = timeStretchOverlapAdd(pitchScaled, ratio);

  if (stretched.length === samples.length) {
    return stretched;
  }

  if (stretched.length > samples.length) {
    return stretched.slice(0, samples.length);
  }

  const padded = new Float32Array(samples.length);
  padded.set(stretched);
  return padded;
}

function encodeWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const bytesPerSample = 2;
  const dataLength = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(buffer);

  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + dataLength, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true);
  view.setUint16(32, bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, "data");
  view.setUint32(40, dataLength, true);

  let offset = 44;
  for (const sample of samples) {
    const clamped = Math.max(-1, Math.min(1, sample));
    const value = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
    view.setInt16(offset, value, true);
    offset += bytesPerSample;
  }

  return buffer;
}

function writeAscii(view: DataView, offset: number, value: string): void {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
}

function readAscii(view: DataView, offset: number, length: number): string {
  let value = "";
  for (let index = 0; index < length; index += 1) {
    value += String.fromCharCode(view.getUint8(offset + index));
  }
  return value;
}

function resampleLinear(samples: Float32Array, outputLength: number): Float32Array {
  if (outputLength <= 0 || samples.length === 0) {
    return new Float32Array(0);
  }

  if (samples.length === 1 || outputLength === 1) {
    return new Float32Array(outputLength).fill(samples[0] ?? 0);
  }

  const result = new Float32Array(outputLength);
  const scale = (samples.length - 1) / (outputLength - 1);

  for (let index = 0; index < outputLength; index += 1) {
    const sourceIndex = index * scale;
    const leftIndex = Math.floor(sourceIndex);
    const rightIndex = Math.min(leftIndex + 1, samples.length - 1);
    const mix = sourceIndex - leftIndex;
    result[index] = (samples[leftIndex] ?? 0) * (1 - mix) + (samples[rightIndex] ?? 0) * mix;
  }

  return result;
}

function timeStretchOverlapAdd(samples: Float32Array, stretchFactor: number): Float32Array {
  if (samples.length < 128 || !Number.isFinite(stretchFactor) || stretchFactor <= 0) {
    return new Float32Array(samples);
  }

  const frameSize = Math.min(2048, Math.max(256, 2 ** Math.floor(Math.log2(samples.length / 2))));
  const analysisHop = Math.max(32, Math.floor(frameSize / 4));
  const synthesisHop = Math.max(1, Math.round(analysisHop * stretchFactor));
  const outputLength = Math.max(frameSize, Math.round(samples.length * stretchFactor) + frameSize);
  const output = new Float32Array(outputLength);
  const weights = new Float32Array(outputLength);
  const window = hannWindow(frameSize);

  let inputOffset = 0;
  let outputOffset = 0;
  while (inputOffset < samples.length) {
    for (let index = 0; index < frameSize; index += 1) {
      const outIndex = outputOffset + index;
      if (outIndex >= output.length) {
        break;
      }
      const sample = samples[inputOffset + index] ?? 0;
      const weight = window[index] ?? 1;
      output[outIndex] = (output[outIndex] ?? 0) + sample * weight;
      weights[outIndex] = (weights[outIndex] ?? 0) + weight;
    }

    inputOffset += analysisHop;
    outputOffset += synthesisHop;
  }

  for (let index = 0; index < output.length; index += 1) {
    const weight = weights[index] ?? 0;
    if (weight > 1e-6) {
      output[index] = (output[index] ?? 0) / weight;
    }
  }

  return output.slice(0, Math.max(1, Math.round(samples.length * stretchFactor)));
}

function hannWindow(length: number): Float32Array {
  const window = new Float32Array(length);
  if (length === 1) {
    window[0] = 1;
    return window;
  }

  for (let index = 0; index < length; index += 1) {
    window[index] = 0.5 - 0.5 * Math.cos((2 * Math.PI * index) / (length - 1));
  }

  return window;
}
