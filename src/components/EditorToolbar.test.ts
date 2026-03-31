// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { describe, expect, it } from "vitest";

describe("EditorToolbar", () => {
  it("passes editor props through and emits the help action", async () => {
    const EditorToolbar = (await import("./EditorToolbar.vue")).default;
    const items = [[{ label: "Bold" }]];
    const wrapper = mount(EditorToolbar, {
      props: {
        editor: {} as any,
        items,
      },
    });

    expect(wrapper.text()).toContain("Help");
    expect(wrapper.text()).toContain("Bold");

    await wrapper.find('[aria-label="Open markup help"]').trigger("click");
    await nextTick();
    expect(wrapper.emitted("open-help")).toEqual([[]]);
  });
});
