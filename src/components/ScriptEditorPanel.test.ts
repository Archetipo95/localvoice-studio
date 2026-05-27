// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import { defineComponent, h, nextTick } from "vue";
import { describe, expect, it, vi } from "vitest";
import {
  PAUSE_TOKEN_NODE,
  PRONUNCIATION_TOKEN_NODE,
  STRESS_TOKEN_NODE,
} from "../utils/editor-document";

const EditorToolbarStub = defineComponent({
  name: "EditorToolbar",
  emits: ["open-help"],
  setup(_, { emit }) {
    return () =>
      h("div", { id: "toolbar-stub" }, [h("button", { onClick: () => emit("open-help") }, "Help")]);
  },
});

describe("ScriptEditorPanel", () => {
  it("emits help actions and closes token editing when text is selected", async () => {
    const ScriptEditorPanel = (await import("./ScriptEditorPanel.vue")).default;
    const wrapper = mount(ScriptEditorPanel, {
      props: {
        modelValue: "Hello world",
      },
      global: {
        stubs: {
          EditorToolbar: EditorToolbarStub,
        },
      },
    });
    await nextTick();

    await wrapper.find("#toolbar-stub button").trigger("click");
    expect(wrapper.emitted("open-help")).toEqual([[]]);

    const vm = wrapper.vm as unknown as {
      handleSelectionUpdate: (payload: { editor: { state: { selection: any; doc: any } } }) => void;
      editorProps: {
        handleClickOn: (...args: any[]) => boolean;
      };
    };

    const token = document.createElement("span");
    token.setAttribute("data-annotation-token", PAUSE_TOKEN_NODE);
    vm.editorProps.handleClickOn(
      null,
      0,
      {
        type: { name: PAUSE_TOKEN_NODE },
        attrs: { label: "pause here", pauseMs: 500 },
      },
      7,
      { target: token },
      true,
    );
    await nextTick();
    expect(wrapper.text()).toContain("Pause Length");

    vm.handleSelectionUpdate({
      editor: {
        state: {
          selection: { from: 1, to: 12, empty: false },
          doc: { textBetween: vi.fn(() => "stewardship") },
        },
      },
    });
    await nextTick();

    expect(wrapper.text()).not.toContain("Pause Length");
  });

  it("serializes updated editor documents back to raw speech markup", async () => {
    const ScriptEditorPanel = (await import("./ScriptEditorPanel.vue")).default;
    const wrapper = mount(ScriptEditorPanel, {
      props: {
        modelValue: "",
      },
      global: {
        stubs: {
          EditorToolbar: EditorToolbarStub,
        },
      },
    });
    await nextTick();

    const vm = wrapper.vm as unknown as {
      onEditorUpdate: (doc: unknown) => void;
    };

    vm.onEditorUpdate({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Say " },
            {
              type: PRONUNCIATION_TOKEN_NODE,
              attrs: { label: "Kokoro", phonemes: "kˈoʊkəɹoʊ" },
            },
            { type: "text", text: "." },
          ],
        },
      ],
    });
    await nextTick();

    const emissions = wrapper.emitted("update:model-value");
    expect(emissions?.at(-1)).toEqual(["Say [Kokoro](/kˈoʊkəɹoʊ/)."]);
  });

  it("keeps annotation markup unchanged in selected previews", async () => {
    vi.resetModules();
    const playPronunciationPreview = vi.fn().mockResolvedValue(undefined);
    vi.doMock("../composables/useTtsWorker", () => ({
      playPronunciationPreview,
    }));

    const ScriptEditorPanel = (await import("./ScriptEditorPanel.vue")).default;
    const wrapper = mount(ScriptEditorPanel, {
      props: {
        modelValue: "",
      },
      global: {
        stubs: {
          EditorToolbar: EditorToolbarStub,
        },
      },
    });
    await nextTick();

    const vm = wrapper.vm as unknown as {
      previewSelectedText: (editor: {
        state: {
          selection: {
            from: number;
            to: number;
            content: () => {
              content: {
                toJSON: () => unknown[];
              };
            };
          };
          doc: {
            textBetween: (from: number, to: number) => string;
          };
        };
      }) => Promise<void>;
    };

    await vm.previewSelectedText({
      state: {
        selection: {
          from: 1,
          to: 10,
          content: () => ({
            content: {
              toJSON: () => [
                {
                  type: "paragraph",
                  content: [
                    { type: "text", text: "Say " },
                    {
                      type: PRONUNCIATION_TOKEN_NODE,
                      attrs: { label: "Kokoro", phonemes: "kˈoʊkəɹoʊ" },
                    },
                    {
                      type: PAUSE_TOKEN_NODE,
                      attrs: { label: "pause here", pauseMs: 500 },
                    },
                  ],
                },
              ],
            },
          }),
        },
        doc: {
          textBetween: () => "Say Kokoro pause here",
        },
      },
    });

    expect(playPronunciationPreview).toHaveBeenCalledWith(
      "Say [Kokoro](/kˈoʊkəɹoʊ/)[pause here](break:500)",
    );
  });

  it("opens token editors from annotation clicks and surfaces preview errors", async () => {
    vi.resetModules();
    const playPronunciationPreview = vi.fn().mockRejectedValue(new Error("Preview failed."));
    vi.doMock("../composables/useTtsWorker", () => ({
      playPronunciationPreview,
    }));

    const ScriptEditorPanel = (await import("./ScriptEditorPanel.vue")).default;
    const wrapper = mount(ScriptEditorPanel, {
      props: {
        modelValue: "Hello",
      },
      global: {
        stubs: {
          EditorToolbar: EditorToolbarStub,
        },
      },
    });
    await nextTick();

    const vm = wrapper.vm as unknown as {
      editorProps: {
        handleClickOn: (...args: any[]) => boolean;
      };
    };

    const token = document.createElement("span");
    token.setAttribute("data-annotation-token", PRONUNCIATION_TOKEN_NODE);
    const play = document.createElement("button");
    play.setAttribute("data-token-action", "play");
    token.appendChild(play);
    document.body.appendChild(token);

    vm.editorProps.handleClickOn(
      null,
      0,
      {
        type: { name: PRONUNCIATION_TOKEN_NODE },
        attrs: { label: "Kokoro", phonemes: "kˈoʊkəɹoʊ" },
      },
      5,
      { target: play },
      true,
    );
    await Promise.resolve();
    await nextTick();

    expect(playPronunciationPreview).toHaveBeenCalledWith("[Kokoro](/kˈoʊkəɹoʊ/)");
    expect(wrapper.text()).toContain("Preview failed.");

    vm.editorProps.handleClickOn(
      null,
      0,
      {
        type: { name: PAUSE_TOKEN_NODE },
        attrs: { label: "pause here", pauseMs: 500 },
      },
      7,
      { target: token },
      true,
    );
    await nextTick();
    expect(wrapper.text()).toContain("Pause Length");

    vm.editorProps.handleClickOn(
      null,
      0,
      {
        type: { name: STRESS_TOKEN_NODE },
        attrs: { label: "better", level: 1 },
      },
      9,
      { target: token },
      true,
    );
    await nextTick();
    expect(wrapper.text()).toContain("Stress Level");
  });

  it("closes the token editor on escape and outside clicks", async () => {
    const ScriptEditorPanel = (await import("./ScriptEditorPanel.vue")).default;
    const wrapper = mount(ScriptEditorPanel, {
      props: {
        modelValue: "Hello",
      },
      attachTo: document.body,
      global: {
        stubs: {
          EditorToolbar: EditorToolbarStub,
        },
      },
    });
    await nextTick();

    const vm = wrapper.vm as unknown as {
      editorProps: {
        handleClickOn: (...args: any[]) => boolean;
      };
    };
    const token = document.createElement("span");
    token.setAttribute("data-annotation-token", PAUSE_TOKEN_NODE);
    document.body.appendChild(token);

    vm.editorProps.handleClickOn(
      null,
      0,
      {
        type: { name: PAUSE_TOKEN_NODE },
        attrs: { label: "pause here", pauseMs: 500 },
      },
      7,
      { target: token },
      true,
    );
    await nextTick();
    expect(wrapper.text()).toContain("Pause Length");

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await nextTick();
    expect(wrapper.text()).not.toContain("Pause Length");

    vm.editorProps.handleClickOn(
      null,
      0,
      {
        type: { name: PAUSE_TOKEN_NODE },
        attrs: { label: "pause here", pauseMs: 500 },
      },
      7,
      { target: token },
      true,
    );
    await nextTick();
    expect(wrapper.text()).toContain("Pause Length");

    document.body.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    await nextTick();
    expect(wrapper.text()).not.toContain("Pause Length");

    token.remove();
    wrapper.unmount();
  });
});
