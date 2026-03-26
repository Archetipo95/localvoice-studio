// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

type RuntimeSelectorVm = {
  handleRuntimeChange: (device: "webgpu" | "wasm") => void;
};

describe("RuntimeSelector", () => {
  it("renders loading state when model loading details are present", async () => {
    const RuntimeSelector = (await import("./RuntimeSelector.vue")).default;
    const wrapper = mount(RuntimeSelector, {
      props: {
        modelLoading: {
          title: "Loading model",
          detail: "Downloading and preparing the Kokoro model in the browser.",
        },
        runtimePreference: "webgpu",
        status: "loading",
        gpuAvailable: true,
      },
    });

    expect(wrapper.text()).toContain("Loading model");
    expect(wrapper.text()).toContain("Downloading and preparing the Kokoro model in the browser.");
    expect(wrapper.find("#runtime-select").exists()).toBe(true);
    expect(wrapper.find("#runtime-select").attributes("disabled")).toBeDefined();
  });

  it("emits runtime changes from the selector", async () => {
    const RuntimeSelector = (await import("./RuntimeSelector.vue")).default;
    const wrapper = mount(RuntimeSelector, {
      props: {
        modelLoading: null,
        runtimePreference: "webgpu",
        status: "ready",
        gpuAvailable: true,
      },
    });
    const vm = wrapper.vm as unknown as RuntimeSelectorVm;

    vm.handleRuntimeChange("wasm");

    expect(wrapper.emitted("updateRuntime")).toEqual([["wasm"]]);
  });
});
