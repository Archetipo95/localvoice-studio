import { describe, expect, it } from "vitest";

import {
  audioBufferToWavBlob,
  decodeWavAudioBuffer,
  mergeAudioChunks,
  pitchShiftAudio,
} from "./audio";

describe("audioBufferToWavBlob", () => {
  it("wraps float32 pcm in a wav blob", async () => {
    const samples = new Float32Array([0, 0.5, -0.5, 0.25]);
    const blob = audioBufferToWavBlob(samples.buffer, 24000);
    const bytes = new Uint8Array(await blob.arrayBuffer());

    expect(blob.type).toBe("audio/wav");
    expect(bytes[0]).toBe("R".charCodeAt(0));
    expect(bytes[1]).toBe("I".charCodeAt(0));
    expect(bytes[2]).toBe("F".charCodeAt(0));
    expect(bytes[3]).toBe("F".charCodeAt(0));
  });

  it("merges chunks with a silence pause between them", () => {
    const merged = mergeAudioChunks(
      [new Float32Array([0.1, 0.2]), new Float32Array([0.3])],
      10,
      200,
    );

    expect(Array.from(merged)).toEqual([
      expect.closeTo(0.1, 6),
      expect.closeTo(0.2, 6),
      0,
      0,
      expect.closeTo(0.3, 6),
    ]);
  });

  it("returns a contiguous copy when there is no pause", () => {
    const merged = mergeAudioChunks(
      [new Float32Array([0.1, 0.2]), new Float32Array([0.3, 0.4])],
      24000,
      0,
    );

    expect(Array.from(merged)).toEqual([
      expect.closeTo(0.1, 6),
      expect.closeTo(0.2, 6),
      expect.closeTo(0.3, 6),
      expect.closeTo(0.4, 6),
    ]);
  });

  it("supports different pause lengths between chunks", () => {
    const merged = mergeAudioChunks(
      [new Float32Array([1]), new Float32Array([2]), new Float32Array([3])],
      10,
      [100, 300],
    );

    expect(Array.from(merged)).toEqual([1, 0, 2, 0, 0, 0, 3]);
  });

  it("decodes persisted wav audio back into samples", async () => {
    const samples = new Float32Array([0, 0.5, -0.5, 0.25]);
    const blob = audioBufferToWavBlob(samples.buffer, 24000);
    const decoded = decodeWavAudioBuffer(await blob.arrayBuffer());

    expect(decoded).not.toBeNull();
    expect(decoded?.sampleRate).toBe(24000);
    expect(Array.from(decoded?.samples ?? [])).toEqual([
      expect.closeTo(0, 3),
      expect.closeTo(0.5, 3),
      expect.closeTo(-0.5, 3),
      expect.closeTo(0.25, 3),
    ]);
  });

  it("clamps samples and supports custom mime types", async () => {
    const samples = new Float32Array([-2, 2]);
    const blob = audioBufferToWavBlob(samples.buffer, 16000, "audio/x-wav");
    const decoded = decodeWavAudioBuffer(await blob.arrayBuffer());

    expect(blob.type).toBe("audio/x-wav");
    expect(Array.from(decoded?.samples ?? [])).toEqual([
      expect.closeTo(-1, 4),
      expect.closeTo(1, 4),
    ]);
  });

  it("returns null for invalid or unsupported wav buffers", async () => {
    expect(decodeWavAudioBuffer(new ArrayBuffer(12))).toBeNull();

    const samples = new Float32Array([0.25, -0.25]);
    const valid = await audioBufferToWavBlob(samples.buffer, 24000).arrayBuffer();

    const wrongHeader = valid.slice(0);
    new Uint8Array(wrongHeader)[0] = "N".charCodeAt(0);
    expect(decodeWavAudioBuffer(wrongHeader)).toBeNull();

    const nonPcm = valid.slice(0);
    new DataView(nonPcm).setUint16(20, 3, true);
    expect(decodeWavAudioBuffer(nonPcm)).toBeNull();

    const stereo = valid.slice(0);
    new DataView(stereo).setUint16(22, 0, true);
    expect(decodeWavAudioBuffer(stereo)).toBeNull();

    const wrongBits = valid.slice(0);
    new DataView(wrongBits).setUint16(34, 8, true);
    expect(decodeWavAudioBuffer(wrongBits)).toBeNull();
  });

  it("skips odd-sized non-data chunks while decoding", async () => {
    const source = new Uint8Array(
      await audioBufferToWavBlob(new Float32Array([0.5]).buffer, 8000).arrayBuffer(),
    );
    const injected = new Uint8Array(source.length + 10);

    injected.set(source.slice(0, 36), 0);
    injected.set(
      Uint8Array.from([
        "J".charCodeAt(0),
        "U".charCodeAt(0),
        "N".charCodeAt(0),
        "K".charCodeAt(0),
        1,
        0,
        0,
        0,
        7,
        0,
      ]),
      36,
    );
    injected.set(source.slice(36), 46);
    new DataView(injected.buffer).setUint32(4, injected.length - 8, true);

    const decoded = decodeWavAudioBuffer(injected.buffer);
    expect(decoded?.sampleRate).toBe(8000);
    expect(Array.from(decoded?.samples ?? [])).toEqual([expect.closeTo(0.5, 3)]);
  });

  it("returns null when no data chunk is present", async () => {
    const valid = new Uint8Array(
      await audioBufferToWavBlob(new Float32Array([0.5]).buffer, 8000).arrayBuffer(),
    );
    valid.set(["J".charCodeAt(0), "U".charCodeAt(0), "N".charCodeAt(0), "K".charCodeAt(0)], 36);

    expect(decodeWavAudioBuffer(valid.buffer)).toBeNull();
  });

  it("returns an empty array when there are no chunks to merge", () => {
    expect(mergeAudioChunks([], 24000)).toEqual(new Float32Array(0));
  });

  it("returns a copy when a single chunk has no positive pause", () => {
    const original = new Float32Array([0.25, 0.5]);
    const merged = mergeAudioChunks([original], 24000, -10);

    expect(merged).toEqual(original);
    expect(merged).not.toBe(original);
  });

  it("handles a sparse single-chunk input defensively", () => {
    const merged = mergeAudioChunks([undefined as unknown as Float32Array], 24000, 0);
    expect(merged).toEqual(new Float32Array(0));
  });

  it("clamps negative pause values while merging", () => {
    const merged = mergeAudioChunks([new Float32Array([1]), new Float32Array([2])], 10, [-100]);

    expect(Array.from(merged)).toEqual([1, 2]);
  });

  it("defaults missing per-chunk pause entries to zero", () => {
    const merged = mergeAudioChunks(
      [new Float32Array([1]), new Float32Array([2]), new Float32Array([3])],
      10,
      [100],
    );

    expect(Array.from(merged)).toEqual([1, 0, 2, 3]);
  });

  it("returns a copy when pitch shifting is effectively disabled", () => {
    const original = new Float32Array([0.25, -0.5, 0.75]);
    const shifted = pitchShiftAudio(original, 0);

    expect(shifted).toEqual(original);
    expect(shifted).not.toBe(original);
  });

  it("raises the apparent pitch while keeping the original length", () => {
    const sampleRate = 8000;
    const samples = createSineWave(220, sampleRate, 0.4);

    const shifted = pitchShiftAudio(samples, 12);

    expect(shifted.length).toBe(samples.length);
    expect(estimateFrequency(shifted, sampleRate)).toBeGreaterThan(
      estimateFrequency(samples, sampleRate) * 1.7,
    );
  });

  it("returns empty output when pitch-shifting empty samples", () => {
    expect(pitchShiftAudio(new Float32Array(0), 5)).toEqual(new Float32Array(0));
  });

  it("handles tiny buffers and extreme semitone values without changing output length", () => {
    const single = new Float32Array([0.75]);
    const up = pitchShiftAudio(single, 24);
    const down = pitchShiftAudio(single, -24);

    expect(up.length).toBe(1);
    expect(down.length).toBe(1);
    expect(up[0]).toBeCloseTo(0.75, 6);
    expect(down[0]).toBeCloseTo(0.75, 6);
  });

  it("preserves length for both upward and downward pitch shifts on longer input", () => {
    const samples = createSineWave(220, 8000, 0.3);
    const up = pitchShiftAudio(samples, 7);
    const down = pitchShiftAudio(samples, -7);

    expect(up.length).toBe(samples.length);
    expect(down.length).toBe(samples.length);
  });
});

function createSineWave(frequency: number, sampleRate: number, seconds: number): Float32Array {
  const sampleCount = Math.floor(sampleRate * seconds);
  const samples = new Float32Array(sampleCount);
  for (let index = 0; index < sampleCount; index += 1) {
    samples[index] = Math.sin((2 * Math.PI * frequency * index) / sampleRate);
  }
  return samples;
}

function estimateFrequency(samples: Float32Array, sampleRate: number): number {
  let positiveCrossings = 0;
  for (let index = 1; index < samples.length; index += 1) {
    if ((samples[index - 1] ?? 0) <= 0 && (samples[index] ?? 0) > 0) {
      positiveCrossings += 1;
    }
  }

  return (positiveCrossings * sampleRate) / samples.length;
}
