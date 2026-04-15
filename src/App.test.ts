// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import { APP_STUBS } from "./test/stubs";

describe("App", () => {
  it("renders the shared shell footer content", async () => {
    const App = (await import("./App.vue")).default;
    const wrapper = mount(App, {
      global: {
        stubs: APP_STUBS,
      },
    });

    expect(wrapper.text()).toContain("LocalVoice Studio");
    expect(wrapper.text()).toContain("Made with");
  });
});
