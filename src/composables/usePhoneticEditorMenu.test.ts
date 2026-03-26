// @vitest-environment jsdom
import { computed, nextTick, ref } from "vue";
import { describe, expect, it, vi } from "vitest";

const computePosition = vi.fn(async () => ({ x: 12.3, y: 45.6, strategy: "absolute" }));
const middlewareFn = () => ({ name: "mw" });

vi.mock("@floating-ui/dom", () => ({
  autoPlacement: vi.fn(middlewareFn),
  computePosition,
  flip: vi.fn(middlewareFn),
  hide: vi.fn(middlewareFn),
  inline: vi.fn(middlewareFn),
  offset: vi.fn(middlewareFn),
  shift: vi.fn(middlewareFn),
  size: vi.fn(middlewareFn),
}));

class PluginKeyMock {
  key: string;
  constructor(key: string) {
    this.key = key;
  }
}

vi.mock("@tiptap/pm/state", () => ({
  PluginKey: PluginKeyMock,
}));

const suggestionMock = vi.fn((config: any) => config);
vi.mock("@tiptap/suggestion", () => ({
  default: suggestionMock,
}));

type SuggestionPluginLike = {
  char: string;
  items: (args: { query: string }) => any[];
  render: () => {
    onStart: (args: any) => void;
    onUpdate: (args: any) => void;
    onKeyDown: (args: any) => boolean;
    onExit: () => void;
  };
  command: (args: any) => void;
};

function makeTr() {
  const tr: { setMeta: (key: unknown, value: unknown) => typeof tr } = {
    setMeta: () => tr,
  };
  tr.setMeta = vi.fn(() => tr);
  return tr;
}

class VueRendererMock {
  element: HTMLElement;
  props: any;
  destroyed = false;
  component: any;

  constructor(component: any, opts: any) {
    this.component = component;
    this.props = opts.props;
    this.element = document.createElement("div");
    this.renderNow();
  }

  updateProps(nextProps: any) {
    this.props = { ...this.props, ...nextProps };
    this.renderNow();
  }

  renderNow() {
    const rendered = this.component.setup?.(this.props);
    if (typeof rendered === "function") {
      rendered();
    }
  }

  destroy() {
    this.destroyed = true;
  }
}

vi.mock("@tiptap/vue-3", () => ({
  VueRenderer: VueRendererMock,
}));

describe("usePhoneticEditorMenu", () => {
  it("filters items, handles navigation, and performs cleanup", async () => {
    vi.resetModules();

    const { usePhoneticEditorMenu } = await import("./usePhoneticEditorMenu");

    const tr = makeTr();

    const dispatch = vi.fn();
    const editorDom = document.createElement("div");
    document.body.appendChild(editorDom);

    const editor = {
      view: {
        dom: editorDom,
        state: { tr },
        dispatch,
      },
    } as any;

    const items = ref([
      [
        { type: "label", label: "Vowels" },
        { label: "Schwa", char: "ə", kind: "schwa", aliases: ["schwa"], description: "vowel" },
        { type: "separator" },
        { label: "Primary stress", char: "ˈ", kind: "stress", aliases: ["stress"] },
      ],
    ]);

    const onSelect = vi.fn();
    const searchTerm = ref("");

    const ui = computed(() => ({
      content: () => "content",
      viewport: () => "viewport",
      group: () => "group",
      label: () => "label",
      separator: () => "separator",
      item: () => "item",
    }));

    const menu = usePhoneticEditorMenu({
      editor,
      char: ":",
      pluginKey: "phoneticSuggestionMenu",
      items,
      searchTerm,
      filterFields: ["label", "description", "char", "aliases"],
      limit: 10,
      options: {
        offset: 8,
        flip: {},
        shift: { padding: 8 },
        size: { apply: vi.fn() },
        autoPlacement: true,
        hide: true,
        inline: true,
      },
      suggestion: { allowedPrefixes: null },
      ui,
      onSelect,
      renderItem: (item: any) => [item.label ?? item.type],
    });

    expect(suggestionMock).toHaveBeenCalledTimes(1);
    const plugin = menu.plugin as unknown as SuggestionPluginLike;
    expect(plugin.char).toBe(":");

    const filtered = plugin.items({ query: "sch" });
    expect(filtered.length).toBeGreaterThan(0);

    const command = vi.fn();
    const render = plugin.render();

    render.onStart({
      items: filtered,
      command,
      clientRect: () => new DOMRect(20, 30, 10, 10),
    });

    await nextTick();
    expect(menu.filteredItems.value.length).toBeGreaterThan(0);

    const downHandled = render.onKeyDown({
      event: new KeyboardEvent("keydown", { key: "ArrowDown" }),
    });
    const upHandled = render.onKeyDown({ event: new KeyboardEvent("keydown", { key: "ArrowUp" }) });
    const enterHandled = render.onKeyDown({
      event: new KeyboardEvent("keydown", { key: "Enter" }),
    });
    const tabHandled = render.onKeyDown({ event: new KeyboardEvent("keydown", { key: "Tab" }) });
    expect(downHandled).toBe(true);
    expect(upHandled).toBe(true);
    expect(enterHandled).toBe(true);
    expect(tabHandled).toBe(true);
    expect(command).toHaveBeenCalled();

    const unknownHandled = render.onKeyDown({
      event: new KeyboardEvent("keydown", { key: "Backspace" }),
    });
    expect(unknownHandled).toBe(false);

    plugin.command({ editor, range: { from: 1, to: 2 }, props: { label: "Schwa" } });
    expect(onSelect).toHaveBeenCalled();

    editorDom.dispatchEvent(new Event("blur"));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(dispatch).toHaveBeenCalled();

    render.onUpdate({
      items: [],
      command,
      clientRect: () => new DOMRect(20, 30, 10, 10),
    });

    const escHandled = render.onKeyDown({ event: new KeyboardEvent("keydown", { key: "Escape" }) });
    expect(escHandled).toBe(false);

    render.onExit();
    expect(menu.searchTerm.value).toBe("");

    menu.destroy();
  });

  it("handles empty starts and exits cleanly", async () => {
    vi.resetModules();

    const { usePhoneticEditorMenu } = await import("./usePhoneticEditorMenu");

    const editorDom = document.createElement("div");
    document.body.appendChild(editorDom);

    const dispatch = vi.fn();
    const editor = {
      view: {
        dom: editorDom,
        state: { tr: makeTr() },
        dispatch,
      },
    } as any;

    const ui = computed(() => ({
      content: () => "content",
      viewport: () => "viewport",
      group: () => "group",
      label: () => "label",
      separator: () => "separator",
      item: () => "item",
    }));

    const menu = usePhoneticEditorMenu({
      editor,
      char: ":",
      pluginKey: "phoneticSuggestionMenu",
      items: ref([]),
      ui,
      onSelect: vi.fn(),
      renderItem: (item: any) => [item.label ?? "x"],
    });

    const render = (menu.plugin as unknown as SuggestionPluginLike).render();
    render.onStart({
      items: [],
      command: vi.fn(),
      clientRect: () => new DOMRect(20, 30, 10, 10),
    });

    const handled = render.onKeyDown({ event: new KeyboardEvent("keydown", { key: "Enter" }) });
    expect(handled).toBe(false);

    render.onExit();
    expect(menu.searchTerm.value).toBe("");

    menu.destroy();
  });

  it("reacts to items changes in ignoreFilter mode", async () => {
    vi.resetModules();

    const { usePhoneticEditorMenu } = await import("./usePhoneticEditorMenu");

    const editorDom = document.createElement("div");
    document.body.appendChild(editorDom);

    const editor = {
      view: {
        dom: editorDom,
        state: { tr: { setMeta: vi.fn() } },
        dispatch: vi.fn(),
      },
    } as any;

    const items = ref([[{ label: "A", kind: "a" }]]);

    const ui = computed(() => ({
      content: () => "content",
      viewport: () => "viewport",
      group: () => "group",
      label: () => "label",
      separator: () => "separator",
      item: () => "item",
    }));

    const menu = usePhoneticEditorMenu({
      editor,
      char: ":",
      pluginKey: "phoneticSuggestionMenu",
      items,
      ignoreFilter: true,
      ui,
      onSelect: vi.fn(),
      renderItem: (item: any) => [item.label ?? "x"],
    });

    const render = (menu.plugin as unknown as SuggestionPluginLike).render();
    render.onStart({
      items: [{ label: "A", kind: "a" }],
      command: vi.fn(),
      clientRect: () => new DOMRect(20, 30, 10, 10),
    });

    items.value = [
      [
        { label: "A", kind: "a" },
        { label: "B", kind: "b" },
      ],
    ];
    await nextTick();
    expect(menu.filteredItems.value.length).toBe(2);

    items.value = [] as any;
    await nextTick();
    expect(menu.filteredItems.value.length).toBe(0);

    menu.destroy();
  });

  it("supports disabled middleware options and default filtering fallbacks", async () => {
    vi.resetModules();

    const { usePhoneticEditorMenu } = await import("./usePhoneticEditorMenu");

    const editorDom = document.createElement("div");
    document.body.appendChild(editorDom);

    const editor = {
      view: {
        dom: editorDom,
        state: { tr: makeTr() },
        dispatch: vi.fn(),
      },
    } as any;

    const menu = usePhoneticEditorMenu({
      editor,
      char: ":",
      pluginKey: "phoneticSuggestionMenu",
      items: ref([
        [
          { label: "Schwa", char: "ə", description: "vowel", aliases: ["schwa"] },
          { label: "Stress", char: "ˈ", description: "stress", aliases: ["stress"] },
        ],
      ]),
      filterFields: ["label", "description", "char", "aliases"],
      options: {
        offset: false,
        flip: false,
        shift: false,
        size: false,
        autoPlacement: false,
        hide: false,
        inline: false,
      },
      ui: computed(() => ({
        content: () => "content",
        viewport: () => "viewport",
        group: () => "group",
        label: () => "label",
        separator: () => "separator",
        item: () => "item",
      })),
      onSelect: vi.fn(),
      renderItem: (item: any) => [item.label],
    });

    const plugin = menu.plugin as unknown as SuggestionPluginLike;
    expect(plugin.items({ query: "sch" }).length).toBeGreaterThan(0);
    expect(plugin.items({ query: "zzz" })).toEqual([]);

    menu.destroy();
  });

  it("handles Escape key when menu is open", async () => {
    vi.resetModules();

    const { usePhoneticEditorMenu } = await import("./usePhoneticEditorMenu");

    const editorDom = document.createElement("div");
    document.body.appendChild(editorDom);

    const editor = {
      view: {
        dom: editorDom,
        state: { tr: makeTr() },
        dispatch: vi.fn(),
      },
    } as any;

    const menu = usePhoneticEditorMenu({
      editor,
      char: ":",
      pluginKey: "phoneticSuggestionMenu",
      items: ref([[{ label: "Schwa", kind: "schwa" }]]),
      ui: computed(() => ({
        content: () => "content",
        viewport: () => "viewport",
        group: () => "group",
        label: () => "label",
        separator: () => "separator",
        item: () => "item",
      })),
      onSelect: vi.fn(),
      renderItem: (item: any) => [item.label],
    });

    const render = (menu.plugin as unknown as SuggestionPluginLike).render();
    render.onStart({
      items: [{ label: "Schwa", kind: "schwa" }],
      command: vi.fn(),
      clientRect: () => new DOMRect(20, 30, 10, 10),
    });

    const handled = render.onKeyDown({ event: new KeyboardEvent("keydown", { key: "Escape" }) });
    expect(handled).toBe(true);

    menu.destroy();
  });
});
