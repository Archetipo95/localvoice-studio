import { describe, expect, it, vi } from "vitest";
import { customHandlers, hasSelectedText, textToHtml, toolbarItems } from "./useEditorHandlers";

function itemKind(item: (typeof toolbarItems)[number][number]) {
  return (item as { kind: string }).kind;
}

function createEditor(options?: {
  text?: string;
  windowText?: string;
  from?: number;
  to?: number;
  empty?: boolean;
  editable?: boolean;
  canUndo?: boolean;
  canRedo?: boolean;
}) {
  const insertContentAt = vi.fn(() => chain);
  const setTextSelection = vi.fn(() => chain);
  const undo = vi.fn(() => chain);
  const redo = vi.fn(() => chain);
  const focus = vi.fn(() => chain);
  const chain = { focus, insertContentAt, setTextSelection, undo, redo };

  const text = options?.text ?? "Hello";
  const windowText = options?.windowText ?? text;
  const from = options?.from ?? 1;
  const to = options?.to ?? text.length + 1;

  const editor = {
    isEditable: options?.editable ?? true,
    state: {
      selection: {
        from,
        to,
        empty: options?.empty ?? false,
      },
      doc: {
        content: { size: windowText.length + 1 },
        textBetween: vi.fn((start: number, end: number) => {
          if (start === from && end === to) return text;
          return windowText;
        }),
      },
    },
    chain: vi.fn(() => chain),
    can: vi.fn(() => ({
      undo: vi.fn(() => options?.canUndo ?? true),
      redo: vi.fn(() => options?.canRedo ?? true),
    })),
  };

  return { editor: editor as any, chain, insertContentAt, setTextSelection, undo, redo, focus };
}

describe("textToHtml", () => {
  it("returns truly empty html for empty editor text", () => {
    expect(textToHtml("")).toBe("");
  });

  it("preserves paragraph breaks for non-empty lines", () => {
    expect(textToHtml("Hello\n\nworld")).toBe("<p>Hello</p><p><br></p><p>world</p>");
  });

  it("escapes html-sensitive characters", () => {
    expect(textToHtml("A < B & C > D")).toBe("<p>A &lt; B &amp; C &gt; D</p>");
  });
});

describe("customHandlers", () => {
  it("detects whether the editor has non-empty selected text", () => {
    const selected = createEditor({ text: "Word" });
    expect(hasSelectedText(selected.editor)).toBe(true);

    const whitespace = createEditor({ text: "   " });
    expect(hasSelectedText(whitespace.editor)).toBe(false);

    const empty = createEditor({ empty: true });
    expect(hasSelectedText(empty.editor)).toBe(false);
  });

  it("supports undo and redo only when the editor can perform them", () => {
    const { editor, undo, redo } = createEditor({ canUndo: true, canRedo: false });

    expect(customHandlers.undo.canExecute(editor)).toBe(true);
    expect(customHandlers.undo.isActive(editor)).toBe(true);
    expect(customHandlers.undo.isDisabled(editor)).toBe(false);
    customHandlers.undo.execute(editor);
    expect(undo).toHaveBeenCalledTimes(1);

    expect(customHandlers.redo.canExecute(editor)).toBe(false);
    expect(customHandlers.redo.isActive(editor)).toBe(false);
    expect(customHandlers.redo.isDisabled(editor)).toBe(true);
    customHandlers.redo.execute(editor);
    expect(redo).toHaveBeenCalledTimes(1);
  });

  it("wraps selections in pronunciation, break, and stress markup", () => {
    const pronunciation = createEditor({ text: "Word", from: 2, to: 6 });
    customHandlers.pronunciation.execute(pronunciation.editor);
    expect(pronunciation.insertContentAt).toHaveBeenCalledWith(
      { from: 2, to: 6 },
      { type: "text", text: "[Word](/:/)" },
    );
    expect(pronunciation.setTextSelection).toHaveBeenCalledWith({ from: 10, to: 11 });

    const pause = createEditor({ text: "Pause", from: 3, to: 8 });
    customHandlers.break.execute(pause.editor);
    expect(pause.insertContentAt).toHaveBeenCalledWith(
      { from: 3, to: 8 },
      { type: "text", text: "[Pause](break:500)" },
    );
    expect(pause.setTextSelection).toHaveBeenCalledWith({ from: 17, to: 20 });

    const stressUp = createEditor({ text: "Loud", from: 1, to: 5 });
    customHandlers.stressUp.execute(stressUp.editor);
    expect(stressUp.insertContentAt).toHaveBeenCalledWith(
      { from: 1, to: 5 },
      { type: "text", text: "[Loud](+1)" },
    );
    expect(stressUp.setTextSelection).toHaveBeenCalledWith({ from: 9, to: 10 });

    const stressDown = createEditor({ text: "Soft", from: 1, to: 5 });
    customHandlers.stressDown.execute(stressDown.editor);
    expect(stressDown.insertContentAt).toHaveBeenCalledWith(
      { from: 1, to: 5 },
      { type: "text", text: "[Soft](-1)" },
    );
    expect(stressDown.setTextSelection).toHaveBeenCalledWith({ from: 9, to: 10 });
  });

  it("selects the pronunciation placeholder character after inserting markup", () => {
    const pronunciation = createEditor({ text: "Word", from: 2, to: 6 });

    customHandlers.pronunciation.execute(pronunciation.editor);

    const insertCalls = pronunciation.insertContentAt.mock.calls as unknown as Array<
      [unknown, { text: string }]
    >;
    const selectionCalls = pronunciation.setTextSelection.mock.calls as unknown as Array<
      [{ from: number; to: number }]
    >;
    const insertCall = insertCalls[0];
    const selectionCall = selectionCalls[0];

    expect(insertCall).toBeDefined();
    expect(selectionCall).toBeDefined();
    if (!insertCall || !selectionCall) {
      throw new Error(
        "Expected pronunciation handler to insert markup and select the placeholder.",
      );
    }

    const insertedMarkup = insertCall[1].text;
    const selection = selectionCall[0];

    expect(insertedMarkup).toBe("[Word](/:/)");
    expect(selection).toEqual({ from: 10, to: 11 });

    const selectionStartInInsertedMarkup =
      selection.from - pronunciation.editor.state.selection.from;
    const selectionEndInInsertedMarkup = selection.to - pronunciation.editor.state.selection.from;
    expect(insertedMarkup.slice(selectionStartInInsertedMarkup, selectionEndInInsertedMarkup)).toBe(
      ":",
    );
  });

  it("blocks markup when the editor is read-only, empty, or already inside markup", () => {
    const readOnly = createEditor({ editable: false });
    expect(customHandlers.pronunciation.canExecute(readOnly.editor)).toBe(false);
    expect(customHandlers.pronunciation.isDisabled(readOnly.editor)).toBe(true);

    const empty = createEditor({ empty: true });
    expect(customHandlers.break.canExecute(empty.editor)).toBe(false);

    const insideMarkup = createEditor({
      text: "word",
      windowText: "[word](break:500)",
      from: 2,
      to: 6,
    });
    expect(customHandlers.stressUp.canExecute(insideMarkup.editor)).toBe(false);
    expect(customHandlers.stressDown.isDisabled(insideMarkup.editor)).toBe(true);
  });

  it("inserts phonetic characters through generated handlers", () => {
    const schwaHandler = (customHandlers as any).phoneticChar_259;
    const { editor, insertContentAt } = createEditor({ text: "", from: 5, to: 5 });

    expect(schwaHandler.canExecute(editor)).toBe(true);
    expect(schwaHandler.isActive()).toBe(false);
    expect(schwaHandler.isDisabled(editor)).toBe(false);

    schwaHandler.execute(editor);
    expect(insertContentAt).toHaveBeenCalledWith({ from: 5, to: 5 }, { type: "text", text: "ə" });
  });

  it("exports the expected toolbar groups", () => {
    expect(toolbarItems).toHaveLength(4);
    expect(toolbarItems[0]?.map(itemKind)).toEqual(["undo", "redo"]);
    expect(toolbarItems[1]?.map(itemKind)).toEqual(["playSelection", "pronunciation"]);
    expect(toolbarItems[2]?.[0] ? itemKind(toolbarItems[2][0]) : undefined).toBe("break");
    expect(toolbarItems[3]?.map(itemKind)).toEqual(["stressUp", "stressDown"]);
  });
});
