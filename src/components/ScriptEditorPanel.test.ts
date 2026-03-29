// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { describe, expect, it, vi } from "vitest";

describe("ScriptEditorPanel", () => {
  it("keeps exposed helpers safe when no editor instance is available", async () => {
    vi.resetModules();

    const ScriptEditorPanel = (await import("./ScriptEditorPanel.vue")).default;
    const wrapper = mount(ScriptEditorPanel, {
      props: {
        modelValue: "<p>first</p>",
        isMarkupMode: false,
        handlers: {},
        toolbarItems: [],
      },
      global: {
        stubs: {
          UEditor: { template: "<div id='ueditor-stub'></div>" },
          EditorToolbar: { template: "<div id='toolbar-stub'></div>" },
          PhoneticSuggestionMenu: { template: "<div class='phonetic-menu'></div>" },
        },
      },
    });

    await wrapper.setProps({ modelValue: "<p>next</p>" });
    expect((wrapper.vm as any).getEditorText()).toBe("next");
    expect(() => (wrapper.vm as any).clearEditorText()).not.toThrow();
  });

  it("renders helper copy in markup mode and plain mode warning when disabled", async () => {
    vi.resetModules();

    const ScriptEditorPanel = (await import("./ScriptEditorPanel.vue")).default;
    const wrapper = mount(ScriptEditorPanel, {
      props: {
        modelValue: "<p>initial</p>",
        isMarkupMode: true,
        handlers: {},
        toolbarItems: [],
      },
      global: {
        stubs: {
          PhoneticSuggestionMenu: { template: "<div class='phonetic-menu'></div>" },
        },
      },
    });

    await nextTick();
    expect(wrapper.text()).toContain("To use IPA symbols");

    await wrapper.setProps({ isMarkupMode: false });
    await nextTick();
    expect(wrapper.text()).toContain("Plain mode is preview-only");
  });

  it("plays the selected word from the toolbar handler and surfaces preview errors", async () => {
    vi.resetModules();
    const playPronunciationPreview = vi.fn().mockRejectedValue(new Error("Preview failed."));
    vi.doMock("../composables/useTtsWorker", () => ({
      playPronunciationPreview,
    }));

    const ScriptEditorPanel = (await import("./ScriptEditorPanel.vue")).default;
    const editor = {
      isEditable: true,
      state: {
        selection: {
          from: 1,
          to: 6,
          empty: false,
        },
        doc: {
          textBetween: vi.fn(() => "hello"),
        },
      },
    };

    const wrapper = mount(ScriptEditorPanel, {
      props: {
        modelValue: "<p>hello</p>",
        isMarkupMode: true,
        handlers: {},
        toolbarItems: [],
      },
      global: {
        stubs: {
          UEditor: { template: "<div id='ueditor-stub'></div>" },
          EditorToolbar: { template: "<div id='toolbar-stub'></div>" },
          PhoneticSuggestionMenu: { template: "<div class='phonetic-menu'></div>" },
        },
      },
    });

    await (wrapper.vm as any).previewSelectedText(editor);
    await nextTick();

    expect(playPronunciationPreview).toHaveBeenCalledWith("hello");
    expect(wrapper.text()).toContain("Preview failed.");
  });
});
