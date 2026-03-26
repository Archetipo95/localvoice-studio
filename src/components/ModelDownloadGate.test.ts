// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

describe("ModelDownloadGate", () => {
  it("renders the download gate and emits downloads", async () => {
    const ModelDownloadGate = (await import("./ModelDownloadGate.vue")).default;
    const wrapper = mount(ModelDownloadGate, {
      props: {
        disabled: false,
      },
      global: {
        stubs: {
          UButton: {
            props: ["disabled"],
            emits: ["click"],
            template:
              "<button id='download-model-button' :disabled='disabled' @click=\"$emit('click')\"><slot /></button>",
          },
        },
      },
    });

    expect(wrapper.text()).toContain("Download required");
    expect(wrapper.text()).toContain("Download Model");
    expect(wrapper.find("svg").exists()).toBe(true);

    await wrapper.find("#download-model-button").trigger("click");
    expect(wrapper.emitted("download")).toHaveLength(1);
  });

  it("passes the disabled state to the button", async () => {
    const ModelDownloadGate = (await import("./ModelDownloadGate.vue")).default;
    const wrapper = mount(ModelDownloadGate, {
      props: {
        disabled: true,
      },
      global: {
        stubs: {
          UButton: {
            props: ["disabled"],
            template: "<button id='download-model-button' :disabled='disabled'><slot /></button>",
          },
        },
      },
    });

    expect(wrapper.find("#download-model-button").attributes("disabled")).toBeDefined();
  });
});
