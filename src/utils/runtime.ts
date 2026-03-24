import type { RuntimeDevice } from "../types";

export function hasWebGPU(): boolean {
  return typeof navigator !== "undefined" && "gpu" in navigator;
}

export function preferredDeviceFromEnvironment(
  explicit: RuntimeDevice | "auto" | null,
  gpuAvailable: boolean,
): RuntimeDevice | "auto" {
  if (explicit === "webgpu" || explicit === "wasm") {
    return explicit;
  }

  return gpuAvailable ? "webgpu" : "wasm";
}

export function buildInitDeviceOrder(
  preferred: RuntimeDevice | "auto",
  gpuAvailable: boolean,
): RuntimeDevice[] {
  if (preferred === "wasm") {
    return ["wasm"];
  }

  if (preferred === "webgpu") {
    return gpuAvailable ? ["webgpu", "wasm"] : ["wasm"];
  }

  return gpuAvailable ? ["webgpu", "wasm"] : ["wasm"];
}
