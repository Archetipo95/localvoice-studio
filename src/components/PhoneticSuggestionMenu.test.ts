// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import { computed, nextTick } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";

const registerPlugin = vi.fn();
const unregisterPlugin = vi.fn();
const destroy = vi.fn();
const plugin = { key: "phoneticSuggestionMenu" };
const usePhoneticEditorMenuMock = vi.fn((options: unknown) => ({ plugin, destroy, options }));

type MenuCallOptions = {
  onSelect: (editor: unknown, range: { from: number; to: number }, item: any) => void;
  renderItem: (item: any, ui: any) => unknown[];
  ui: {
    value: {
      content: () => string;
      viewport: () => string;
      group: () => string;
      label: () => string;
      separator: () => string;
      item: (props?: { active?: boolean }) => string;
      itemLeadingIcon: () => string;
      itemWrapper: () => string;
      itemLabel: () => string;
      itemDescription: () => string;
    };
  };
};

vi.mock("../composables/usePhoneticEditorMenu", () => ({
  usePhoneticEditorMenu: usePhoneticEditorMenuMock,
}));

describe("PhoneticSuggestionMenu", () => {
  beforeEach(() => {
    registerPlugin.mockClear();
    unregisterPlugin.mockClear();
    destroy.mockClear();
    usePhoneticEditorMenuMock.mockClear();
  });

  it("registers and unregisters suggestion plugin and handles select callback", async () => {
    const editor = {
      isDestroyed: false,
      registerPlugin,
      unregisterPlugin,
      chain: vi.fn(() => ({
        focus: vi.fn().mockReturnThis(),
        deleteRange: vi.fn().mockReturnThis(),
        run: vi.fn(),
      })),
    } as any;

    const execute = vi.fn(() => ({ run: vi.fn() }));

    const PhoneticSuggestionMenu = (await import("./PhoneticSuggestionMenu.vue")).default;

    const wrapper = mount(PhoneticSuggestionMenu, {
      props: {
        editor,
        items: [[{ label: "Schwa", kind: "schwa", description: "vowel" }]],
      },
      global: {
        provide: {
          editorHandlers: computed(() => ({ schwa: { execute } })),
        },
      },
    });

    await nextTick();

    expect(usePhoneticEditorMenuMock).toHaveBeenCalledTimes(1);
    expect(registerPlugin).toHaveBeenCalledWith(plugin);

    const firstCall = usePhoneticEditorMenuMock.mock.calls[0] as [MenuCallOptions] | undefined;
    expect(firstCall).toBeTruthy();
    const callOptions = firstCall![0];
    const chainObj = {
      focus: vi.fn().mockReturnThis(),
      deleteRange: vi.fn().mockReturnThis(),
      run: vi.fn(),
    };
    const editorForSelect = { chain: vi.fn(() => chainObj) };

    callOptions.onSelect(editorForSelect, { from: 1, to: 2 }, { label: "x", kind: "schwa" });
    expect(editorForSelect.chain).toHaveBeenCalled();
    expect(execute).toHaveBeenCalled();

    callOptions.onSelect(editorForSelect, { from: 1, to: 2 }, { type: "label", label: "skip" });
    expect(execute).toHaveBeenCalledTimes(1);

    const labelRender = callOptions.renderItem({ type: "label", label: "Vowels" }, callOptions.ui);
    expect(Array.isArray(labelRender)).toBe(true);

    const itemRender = callOptions.renderItem(
      { label: "Schwa", description: "vowel", icon: "dot" },
      callOptions.ui,
    );
    expect(Array.isArray(itemRender)).toBe(true);

    const noDescriptionRender = callOptions.renderItem({ label: "Stress" }, callOptions.ui);
    expect(Array.isArray(noDescriptionRender)).toBe(true);

    expect(callOptions.ui.value.content()).toContain("z-50");
    expect(callOptions.ui.value.viewport()).toContain("max-h-80");
    expect(callOptions.ui.value.group()).toContain("py-0.5");
    expect(callOptions.ui.value.label()).toContain("uppercase");
    expect(callOptions.ui.value.separator()).toContain("h-px");
    expect(callOptions.ui.value.item({ active: true })).toContain("bg-elevated");
    expect(callOptions.ui.value.itemLeadingIcon()).toContain("size-4");
    expect(callOptions.ui.value.itemWrapper()).toContain("flex");
    expect(callOptions.ui.value.itemLabel()).toContain("font-medium");
    expect(callOptions.ui.value.itemDescription()).toContain("text-[11px]");

    await wrapper.unmount();
    expect(destroy).toHaveBeenCalled();
    expect(unregisterPlugin).toHaveBeenCalledWith("phoneticSuggestionMenu");
  });

  it("skips registration when editor is destroyed", async () => {
    const editor = {
      isDestroyed: true,
      registerPlugin,
      unregisterPlugin,
    } as any;

    const PhoneticSuggestionMenu = (await import("./PhoneticSuggestionMenu.vue")).default;
    const wrapper = mount(PhoneticSuggestionMenu, {
      props: {
        editor,
        items: [[{ label: "Schwa", kind: "schwa" }]],
      },
      global: {
        provide: {
          editorHandlers: computed(() => ({ schwa: { execute: vi.fn() } })),
        },
      },
    });

    await nextTick();
    expect(usePhoneticEditorMenuMock).toHaveBeenCalledTimes(0);

    await wrapper.unmount();
    expect(unregisterPlugin).not.toHaveBeenCalled();
  });
});
