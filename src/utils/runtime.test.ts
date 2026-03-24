import { afterEach, describe, expect, it } from "vitest";

import { buildInitDeviceOrder, hasWebGPU, preferredDeviceFromEnvironment } from "./runtime";

afterEach(() => {
  Reflect.deleteProperty(globalThis, "navigator");
});

describe("runtime selection", () => {
  it("prefers webgpu when available", () => {
    expect(preferredDeviceFromEnvironment("auto", true)).toBe("webgpu");
    expect(buildInitDeviceOrder("auto", true)).toEqual(["webgpu", "wasm"]);
  });

  it("falls back to wasm when webgpu is unavailable", () => {
    expect(preferredDeviceFromEnvironment("auto", false)).toBe("wasm");
    expect(buildInitDeviceOrder("auto", false)).toEqual(["wasm"]);
  });

  it("keeps an explicit wasm request", () => {
    expect(preferredDeviceFromEnvironment("wasm", true)).toBe("wasm");
    expect(buildInitDeviceOrder("wasm", true)).toEqual(["wasm"]);
  });

  it("respects explicit webgpu requests and falls back when unavailable", () => {
    expect(preferredDeviceFromEnvironment("webgpu", false)).toBe("webgpu");
    expect(buildInitDeviceOrder("webgpu", true)).toEqual(["webgpu", "wasm"]);
    expect(buildInitDeviceOrder("webgpu", false)).toEqual(["wasm"]);
  });

  it("detects whether the runtime exposes webgpu", () => {
    expect(hasWebGPU()).toBe(false);

    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: { gpu: {} },
    });

    expect(hasWebGPU()).toBe(true);
  });
});
