// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

describe("MarkupGuide", () => {
  it("renders pronunciation, pause, emphasis, and tuning guidance", async () => {
    const MarkupGuide = (await import("./MarkupGuide.vue")).default;
    const wrapper = mount(MarkupGuide, {
      global: {
        stubs: {
          UIcon: {
            props: ["name"],
            template: "<i :data-name='name'></i>",
          },
        },
      },
    });

    expect(wrapper.text()).toContain("Pronunciation");
    expect(wrapper.text()).toContain("Pause");
    expect(wrapper.text()).toContain("Emphasis");
    expect(wrapper.text()).toContain("Rhythm & Tuning");
    expect(wrapper.text()).toContain("[pause here](break:500)");
    expect(wrapper.findAll("svg").length).toBeGreaterThan(0);
  });
});
