// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

describe("GenerateButton", () => {
  it("renders generate state and emits generate", async () => {
    const GenerateButton = (await import("./GenerateButton.vue")).default;
    const wrapper = mount(GenerateButton, {
      props: {
        canCancel: false,
        loading: false,
        disabled: false,
        elapsedLabel: null,
      },
      global: {
        stubs: {
          UButton: {
            props: ["loading", "disabled"],
            emits: ["click"],
            template:
              "<button :data-loading='String(loading)' :disabled='disabled' @click=\"$emit('click')\"><slot /><slot name='leading' /></button>",
          },
          UIcon: {
            props: ["name"],
            template: "<i :data-name='name'></i>",
          },
        },
      },
    });

    expect(wrapper.text()).toContain("Generate Audio");
    expect(wrapper.text()).not.toContain("Cancel");
    expect(wrapper.find("svg").exists()).toBe(true);

    await wrapper.find("button").trigger("click");
    expect(wrapper.emitted("generate")).toHaveLength(1);
    expect(wrapper.emitted("cancel")).toBeUndefined();
  });

  it("renders cancel state and elapsed label while loading", async () => {
    const GenerateButton = (await import("./GenerateButton.vue")).default;
    const wrapper = mount(GenerateButton, {
      props: {
        canCancel: true,
        loading: true,
        disabled: true,
        elapsedLabel: "12.3s elapsed",
      },
      global: {
        stubs: {
          UButton: {
            props: ["loading", "disabled"],
            emits: ["click"],
            template:
              "<button :data-loading='String(loading)' :disabled='disabled' @click=\"$emit('click')\"><slot /><slot name='leading' /></button>",
          },
        },
      },
    });

    const buttons = wrapper.findAll("button");
    expect(buttons).toHaveLength(2);
    expect(wrapper.text()).toContain("Generating...");
    expect(wrapper.text()).toContain("12.3s elapsed");

    await buttons[0]!.trigger("click");
    expect(wrapper.emitted("cancel")).toHaveLength(1);
  });
});
