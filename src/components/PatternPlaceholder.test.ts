// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

describe("PatternPlaceholder", () => {
  it("renders its slot content inside the patterned container", async () => {
    const PatternPlaceholder = (await import("./PatternPlaceholder.vue")).default;
    const wrapper = mount(PatternPlaceholder, {
      slots: {
        default: "<p id='placeholder-copy'>Nothing here yet</p>",
      },
    });

    expect(wrapper.find("#placeholder-copy").text()).toBe("Nothing here yet");
    expect(wrapper.find("pattern").attributes("id")).toContain("pattern-5c1e4f0e");
    expect(wrapper.find("rect").attributes("fill")).toContain("url(#pattern-5c1e4f0e");
  });
});
