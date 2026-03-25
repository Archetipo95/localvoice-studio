// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { describe, expect, it } from "vitest";

describe("EditorToolbar", () => {
  it("passes editor props through and emits mode changes", async () => {
    const EditorToolbar = (await import("./EditorToolbar.vue")).default;
    const items = [[{ label: "Bold" }]];
    const wrapper = mount(EditorToolbar, {
      props: {
        editor: {} as any,
        items,
        isMarkupMode: true,
      },
    });

    expect(wrapper.text()).toContain("Plain");
    expect(wrapper.text()).toContain("Markup");
    expect(wrapper.text()).toContain("Bold");

    await wrapper.find("[role='switch']").trigger("click");
    await nextTick();
    expect(wrapper.emitted("toggle-mode")).toEqual([[false]]);
  });
});
