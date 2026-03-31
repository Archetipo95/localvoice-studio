import { describe, expect, it, vi } from "vitest";
import { customHandlers, hasSelectedText, toolbarItems } from "./useEditorHandlers";
import {
  PAUSE_TOKEN_NODE,
  PRONUNCIATION_TOKEN_NODE,
  STRESS_TOKEN_NODE,
} from "../utils/editor-document";

function itemKind(item: (typeof toolbarItems)[number][number]) {
  return (item as { kind: string }).kind;
}

function createEditor(options?: {
  text?: string;
  from?: number;
  to?: number;
  empty?: boolean;
  editable?: boolean;
  canUndo?: boolean;
  canRedo?: boolean;
  selectionHasAnnotation?: boolean;
}) {
  const insertContentAt = vi.fn(() => chain);
  const undo = vi.fn(() => chain);
  const redo = vi.fn(() => chain);
  const focus = vi.fn(() => chain);
  const chain = { focus, insertContentAt, undo, redo };

  const text = options?.text ?? "Hello";
  const from = options?.from ?? 1;
  const to = options?.to ?? text.length + 1;

  const nodesBetween = vi.fn(
    (start: number, end: number, callback: (node: { type: { name: string } }) => boolean) => {
      if (!options?.selectionHasAnnotation || start !== from || end !== to) {
        return;
      }

      callback({ type: { name: PRONUNCIATION_TOKEN_NODE } });
    },
  );

  const editor = {
    isEditable: options?.editable ?? true,
    state: {
      selection: {
        from,
        to,
        empty: options?.empty ?? false,
      },
      doc: {
        textBetween: vi.fn((start: number, end: number) =>
          start === from && end === to ? text : "",
        ),
        nodesBetween,
      },
    },
    chain: vi.fn(() => chain),
    can: vi.fn(() => ({
      undo: vi.fn(() => options?.canUndo ?? true),
      redo: vi.fn(() => options?.canRedo ?? true),
    })),
  };

  return { editor: editor as any, insertContentAt, undo, redo };
}

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

  it("wraps selections in structured pronunciation, break, and stress tokens", () => {
    const pronunciation = createEditor({ text: "Word", from: 2, to: 6 });
    customHandlers.pronunciation.execute(pronunciation.editor);
    expect(pronunciation.insertContentAt).toHaveBeenCalledWith(
      { from: 2, to: 6 },
      {
        type: PRONUNCIATION_TOKEN_NODE,
        attrs: { label: "Word", phonemes: "Word" },
      },
    );

    const pause = createEditor({ text: "Pause", from: 3, to: 8 });
    customHandlers.break.execute(pause.editor);
    expect(pause.insertContentAt).toHaveBeenCalledWith(
      { from: 3, to: 8 },
      {
        type: PAUSE_TOKEN_NODE,
        attrs: { label: "Pause", pauseMs: 500 },
      },
    );

    const stressUp = createEditor({ text: "Loud", from: 1, to: 5 });
    customHandlers.stressUp.execute(stressUp.editor);
    expect(stressUp.insertContentAt).toHaveBeenCalledWith(
      { from: 1, to: 5 },
      {
        type: STRESS_TOKEN_NODE,
        attrs: { label: "Loud", level: 1 },
      },
    );

    const stressDown = createEditor({ text: "Soft", from: 1, to: 5 });
    customHandlers.stressDown.execute(stressDown.editor);
    expect(stressDown.insertContentAt).toHaveBeenCalledWith(
      { from: 1, to: 5 },
      {
        type: STRESS_TOKEN_NODE,
        attrs: { label: "Soft", level: -1 },
      },
    );
  });

  it("allows inserting a break token at the cursor without a selection", () => {
    const pause = createEditor({ text: "", from: 4, to: 4, empty: true });

    expect(customHandlers.break.canExecute(pause.editor)).toBe(true);
    expect(customHandlers.break.isDisabled(pause.editor)).toBe(false);

    customHandlers.break.execute(pause.editor);
    expect(pause.insertContentAt).toHaveBeenCalledWith(
      { from: 4, to: 4 },
      {
        type: PAUSE_TOKEN_NODE,
        attrs: { label: "pause", pauseMs: 500 },
      },
    );
  });

  it("blocks annotation insertion when the editor is read-only, empty, or selection already includes tokens", () => {
    const readOnly = createEditor({ editable: false });
    expect(customHandlers.pronunciation.canExecute(readOnly.editor)).toBe(false);
    expect(customHandlers.pronunciation.isDisabled(readOnly.editor)).toBe(true);

    const empty = createEditor({ empty: true });
    expect(customHandlers.pronunciation.canExecute(empty.editor)).toBe(false);

    const containsAnnotation = createEditor({
      text: "word",
      from: 2,
      to: 6,
      selectionHasAnnotation: true,
    });
    expect(customHandlers.stressUp.canExecute(containsAnnotation.editor)).toBe(false);
    expect(customHandlers.stressDown.isDisabled(containsAnnotation.editor)).toBe(true);
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
