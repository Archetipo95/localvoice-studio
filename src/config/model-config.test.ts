import { describe, expect, it, vi } from "vitest";

describe("model config helpers", () => {
  it("creates built-in and custom model definitions", async () => {
    const { DEFAULT_MODEL, createModelDefinition } = await import("./model-config");

    expect(createModelDefinition(DEFAULT_MODEL.modelId)).toBe(DEFAULT_MODEL);
    expect(createModelDefinition(DEFAULT_MODEL.id)).toBe(DEFAULT_MODEL);
    expect(createModelDefinition("  custom/demo-model  ")).toEqual({
      id: "custom-custom-demo-model",
      label: "demo-model",
      modelId: "custom/demo-model",
      voices: [],
    });
  });

  it("falls back to the default model for blank definitions", async () => {
    const { DEFAULT_MODEL, createModelDefinition } = await import("./model-config");

    expect(createModelDefinition("   ")).toBe(DEFAULT_MODEL);
  });

  it("uses a safe fallback id when a custom repo slug is empty", async () => {
    const { createModelDefinition } = await import("./model-config");

    expect(createModelDefinition("!!!")).toEqual({
      id: "custom-model",
      label: "!!!",
      modelId: "!!!",
      voices: [],
    });
  });

  it("uses the full model id as the label when the repo ends with a slash", async () => {
    const { createModelDefinition } = await import("./model-config");

    expect(createModelDefinition("custom/demo-model/")).toMatchObject({
      label: "custom/demo-model/",
      modelId: "custom/demo-model/",
    });
  });

  it("resolves the initial model from modelRepo, model, env, or default", async () => {
    const previousRepo = process.env.VITE_KOKORO_MODEL_REPO;
    process.env.VITE_KOKORO_MODEL_REPO = "env/demo-model";
    vi.resetModules();
    const { DEFAULT_MODEL, resolveInitialModel } = await import("./model-config");

    expect(
      resolveInitialModel(new URL("https://example.com/?modelRepo=custom/from-repo")),
    ).toMatchObject({
      modelId: "custom/from-repo",
      label: "from-repo",
    });

    expect(
      resolveInitialModel(new URL("https://example.com/?model=custom/from-model")),
    ).toMatchObject({
      modelId: "custom/from-model",
      label: "from-model",
    });

    expect(resolveInitialModel(new URL("https://example.com/"))).toMatchObject({
      modelId: "env/demo-model",
      label: "demo-model",
    });

    if (previousRepo === undefined) {
      delete process.env.VITE_KOKORO_MODEL_REPO;
    } else {
      process.env.VITE_KOKORO_MODEL_REPO = previousRepo;
    }
    vi.resetModules();
    const withoutEnv = await import("./model-config");
    expect(withoutEnv.resolveInitialModel(new URL("https://example.com/"))).toBe(
      withoutEnv.DEFAULT_MODEL,
    );
    expect(withoutEnv.DEFAULT_MODEL).toStrictEqual(DEFAULT_MODEL);
  });

  it("syncs custom and default models into the URL", async () => {
    const { DEFAULT_MODEL, createModelDefinition, syncModelUrl } = await import("./model-config");

    const customUrl = new URL("https://example.com/?model=deprecated");
    expect(syncModelUrl(customUrl, createModelDefinition("custom/demo-model"))).toBe(
      "https://example.com/?modelRepo=custom%2Fdemo-model",
    );

    const defaultUrl = new URL(
      "https://example.com/?modelRepo=custom%2Fdemo-model&model=deprecated",
    );
    expect(syncModelUrl(defaultUrl, DEFAULT_MODEL)).toBe("https://example.com/");
  });

  it("still resolves defaults when process is unavailable", async () => {
    const originalProcess = globalThis.process;

    Object.defineProperty(globalThis, "process", {
      configurable: true,
      value: undefined,
    });

    vi.resetModules();
    const { DEFAULT_MODEL, resolveInitialModel } = await import("./model-config");
    expect(resolveInitialModel(new URL("https://example.com/"))).toBe(DEFAULT_MODEL);

    Object.defineProperty(globalThis, "process", {
      configurable: true,
      value: originalProcess,
    });
  });
});
