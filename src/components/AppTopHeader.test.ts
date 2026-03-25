// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import { useUiStore } from "../stores/ui";

describe("AppTopHeader", () => {
  it("renders title and current theme label", async () => {
    vi.resetModules();

    const AppTopHeader = (await import("./AppTopHeader.vue")).default;

    const wrapper = mount(AppTopHeader, {
      global: {
        stubs: {
          UHeader: {
            template:
              '<header role="banner"><div><slot name="left" /></div><div><slot name="right" /></div></header>',
          },
          UButton: {
            props: ["label"],
            template: '<button type="button">{{ label }}</button>',
          },
          UDropdownMenu: {
            props: ["items"],
            template: `
              <div>
                <slot />
                <button
                  v-for="item in items"
                  :key="item.label"
                  type="button"
                  role="menuitem"
                  @click="item.onSelect?.()"
                >
                  {{ item.label }}
                </button>
              </div>
            `,
          },
        },
      },
    });

    expect(wrapper.text()).toContain("LocalVoice Studio");
    expect(wrapper.text()).toContain("Powered by Kokoro");
    expect(wrapper.text()).toContain("System");

    (wrapper.vm as any).themeMenuItems[2].onSelect();
    expect(useUiStore().themeMode).toBe("dark");
  });
});
