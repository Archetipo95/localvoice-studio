import type { EditorCustomHandlers, EditorToolbarItem } from "@nuxt/ui";
import type { Editor } from "@tiptap/vue-3";
import { getAllPhoneticChars, toPhoneticCharKind } from "../utils/phonetic-chars";

// ── Text helpers ───────────────────────────────────────────────────────────

/**
 * Convert flat speech-markup text to minimal HTML for UEditor.
 * Splits on newlines, HTML-escapes only the characters that matter in HTML
 * (<, >, &). Square brackets and parentheses are safe and will render as-is.
 */
export function textToHtml(text: string): string {
  if (text === "") {
    return "";
  }

  const lines = text.split("\n");
  return lines
    .map((line) => {
      const escaped = line.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      return `<p>${escaped === "" ? "<br>" : escaped}</p>`;
    })
    .join("");
}

// ── Selection helpers ──────────────────────────────────────────────────────

function selectionText(editor: Editor): string {
  const { from, to } = editor.state.selection;
  return editor.state.doc.textBetween(from, to);
}

const MARKUP_SCAN_LOOKBEHIND = 120;
const MARKUP_SCAN_LOOKAHEAD = 40;

function isSelectionInsideMarkup(editor: Editor, pattern: RegExp): boolean {
  const { from, to, empty } = editor.state.selection;
  if (empty) return false;

  const scanStart = Math.max(1, from - MARKUP_SCAN_LOOKBEHIND);
  const docSize = editor.state.doc.content?.size ?? to;
  const scanEnd = Math.min(docSize, to + MARKUP_SCAN_LOOKAHEAD);
  const windowText = editor.state.doc.textBetween(scanStart, scanEnd, "\n", "\n");

  const selectionStartInWindow = from - scanStart;
  const selectionEndInWindow = to - scanStart;

  let match: RegExpExecArray | null;
  const freshPattern = new RegExp(pattern.source, pattern.flags);
  while ((match = freshPattern.exec(windowText)) !== null) {
    const matchStart = match.index;
    const matchEnd = matchStart + match[0].length;
    if (selectionStartInWindow >= matchStart && selectionEndInWindow <= matchEnd) {
      return true;
    }
  }

  return false;
}

function canApplyMarkup(editor: Editor): boolean {
  return (
    !editor.state.selection.empty &&
    editor.isEditable &&
    !isSelectionInsideMarkup(editor, /\[[^\]]+\]\((?:\/[^)]*\/|break:\d+|[+-]\d+)\)/g)
  );
}

// ── Phonetic character handlers ────────────────────────────────────────────

function createPhoneticCharHandler(char: string) {
  return {
    canExecute: (editor: Editor) => editor.isEditable,
    execute: (editor: Editor) => {
      const { from, to } = editor.state.selection;
      return editor.chain().focus().insertContentAt({ from, to }, { type: "text", text: char });
    },
    isActive: () => false,
    isDisabled: (editor: Editor) => !editor.isEditable,
  };
}

function generatePhoneticHandlers(): EditorCustomHandlers {
  const handlers: EditorCustomHandlers = {};
  for (const item of getAllPhoneticChars()) {
    handlers[toPhoneticCharKind(item.char)] = createPhoneticCharHandler(item.char);
  }
  return handlers;
}

// ── Markup-wrap handler factory ───────────────────────────────────────────

/**
 * Creates a markup-wrap handler that wraps the selected text in `[text](suffix)`.
 * The cursor selection after insertion covers the editable part of the suffix
 * defined by `selectRange`: [start, end) are byte offsets from the opening
 * parenthesis, making them resilient to changes in `selected` length.
 */
function createMarkupWrapHandler(
  buildMarkup: (selected: string) => string,
  /** Offset in chars from the opening '(' to the selection start. */
  selectOffsetFromParen: number,
  /** Length in chars of the auto-selected region. */
  selectLength: number,
) {
  return {
    canExecute: canApplyMarkup,
    execute: (editor: Editor) => {
      const { from, to } = editor.state.selection;
      const selected = selectionText(editor);
      const markup = buildMarkup(selected);
      // [ + selected + ] + ( = selected.length + 2 chars before '('
      const parenOffset = from + selected.length + 2;
      const selFrom = parenOffset + selectOffsetFromParen;
      const selTo = selFrom + selectLength;
      return editor
        .chain()
        .focus()
        .insertContentAt({ from, to }, { type: "text", text: markup })
        .setTextSelection({ from: selFrom, to: selTo });
    },
    isActive: canApplyMarkup,
    isDisabled: (editor: Editor) => !canApplyMarkup(editor),
  };
}

// ── Custom handlers ────────────────────────────────────────────────────────

export const customHandlers = {
  undo: {
    canExecute: (editor: Editor) => editor.isEditable && editor.can().undo(),
    execute: (editor: Editor) => editor.chain().focus().undo(),
    isActive: (editor: Editor) => editor.isEditable && editor.can().undo(),
    isDisabled: (editor: Editor) => !editor.isEditable || !editor.can().undo(),
  },
  redo: {
    canExecute: (editor: Editor) => editor.isEditable && editor.can().redo(),
    execute: (editor: Editor) => editor.chain().focus().redo(),
    isActive: (editor: Editor) => editor.isEditable && editor.can().redo(),
    isDisabled: (editor: Editor) => !editor.isEditable || !editor.can().redo(),
  },
  pronunciation: {
    canExecute: canApplyMarkup,
    execute: (editor: Editor) => {
      const { from, to } = editor.state.selection;
      const selected = selectionText(editor);
      const markup = `[${selected}](/:/)`;
      // Select the placeholder inside '/:/' so typing immediately replaces it.
      const parenOffset = from + selected.length + 2;
      const selectionFrom = parenOffset + 2;
      const selectionTo = selectionFrom + 1;
      return editor
        .chain()
        .focus()
        .insertContentAt({ from, to }, { type: "text", text: markup })
        .setTextSelection({ from: selectionFrom, to: selectionTo });
    },
    isActive: canApplyMarkup,
    isDisabled: (editor: Editor) => !canApplyMarkup(editor),
  },
  // Offsets: '(break:' = 7 chars from '(', select '500' = 3 chars
  break: createMarkupWrapHandler(
    (s) => `[${s}](break:500)`,
    /* selectOffsetFromParen */ 7,
    /* selectLength */ 3,
  ),
  // Offsets: '(+' = 2 chars before the digit; digit is 1 char
  stressUp: createMarkupWrapHandler(
    (s) => `[${s}](+1)`,
    /* selectOffsetFromParen */ 2,
    /* selectLength */ 1,
  ),
  // Offsets: '(-' = 2 chars before the digit; digit is 1 char
  stressDown: createMarkupWrapHandler(
    (s) => `[${s}](-1)`,
    /* selectOffsetFromParen */ 2,
    /* selectLength */ 1,
  ),
  ...generatePhoneticHandlers(),
} satisfies EditorCustomHandlers;

// ── Toolbar items ──────────────────────────────────────────────────────────

export const toolbarItems: EditorToolbarItem<typeof customHandlers>[][] = [
  [
    { kind: "undo", icon: "i-heroicons-arrow-uturn-left", tooltip: { text: "Undo" } },
    { kind: "redo", icon: "i-heroicons-arrow-uturn-right", tooltip: { text: "Redo" } },
  ],
  [
    {
      kind: "pronunciation",
      icon: "i-heroicons-chat-bubble-oval-left",
      tooltip: { text: "Add pronunciation" },
    },
  ],
  [{ kind: "break", icon: "i-heroicons-pause-circle", tooltip: { text: "Insert break" } }],
  [
    { kind: "stressUp", icon: "i-heroicons-chevron-double-up", tooltip: { text: "Stress +1" } },
    { kind: "stressDown", icon: "i-heroicons-chevron-double-down", tooltip: { text: "Stress -1" } },
  ],
];
