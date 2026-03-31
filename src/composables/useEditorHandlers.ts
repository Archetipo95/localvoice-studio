import type { EditorCustomHandlers, EditorHandler, EditorToolbarItem } from "@nuxt/ui";
import type { Editor } from "@tiptap/vue-3";
import { getAllPhoneticChars, toPhoneticCharKind } from "../utils/phonetic-chars";
import {
  PAUSE_TOKEN_NODE,
  PRONUNCIATION_TOKEN_NODE,
  STRESS_TOKEN_NODE,
  isAnnotationNodeName,
} from "../utils/editor-document";

// ── Selection helpers ──────────────────────────────────────────────────────

function selectionText(editor: Editor): string {
  const { from, to } = editor.state.selection;
  return editor.state.doc.textBetween(from, to);
}

export function hasSelectedText(editor: Editor): boolean {
  return !editor.state.selection.empty && selectionText(editor).trim().length > 0;
}

function selectionContainsAnnotation(editor: Editor): boolean {
  const { from, to, empty } = editor.state.selection;
  if (empty) return false;

  let contains = false;
  editor.state.doc.nodesBetween(from, to, (node) => {
    if (isAnnotationNodeName(node.type.name)) {
      contains = true;
      return false;
    }

    return true;
  });

  return contains;
}

function canApplyMarkup(editor: Editor): boolean {
  return hasSelectedText(editor) && editor.isEditable && !selectionContainsAnnotation(editor);
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

function createAnnotationInsertHandler(
  buildContent: (selected: string) => { type: string; attrs: Record<string, unknown> },
) {
  return {
    canExecute: canApplyMarkup,
    execute: (editor: Editor) => {
      const { from, to } = editor.state.selection;
      const selected = selectionText(editor);
      return editor.chain().focus().insertContentAt({ from, to }, buildContent(selected));
    },
    isActive: canApplyMarkup,
    isDisabled: (editor: Editor) => !canApplyMarkup(editor),
  };
}

function canInsertPause(editor: Editor): boolean {
  if (!editor.isEditable) {
    return false;
  }

  if (editor.state.selection.empty) {
    return true;
  }

  return !selectionContainsAnnotation(editor);
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
      return editor
        .chain()
        .focus()
        .insertContentAt(
          { from, to },
          {
            type: PRONUNCIATION_TOKEN_NODE,
            attrs: { label: selected, phonemes: selected },
          },
        );
    },
    isActive: canApplyMarkup,
    isDisabled: (editor: Editor) => !canApplyMarkup(editor),
  },
  break: {
    canExecute: canInsertPause,
    execute: (editor: Editor) => {
      const { from, to, empty } = editor.state.selection;
      const label = empty ? "pause" : selectionText(editor);
      return editor
        .chain()
        .focus()
        .insertContentAt(
          { from, to },
          {
            type: PAUSE_TOKEN_NODE,
            attrs: { label, pauseMs: 500 },
          },
        );
    },
    isActive: canInsertPause,
    isDisabled: (editor: Editor) => !canInsertPause(editor),
  },
  stressUp: createAnnotationInsertHandler((label) => ({
    type: STRESS_TOKEN_NODE,
    attrs: { label, level: 1 },
  })),
  stressDown: createAnnotationInsertHandler((label) => ({
    type: STRESS_TOKEN_NODE,
    attrs: { label, level: -1 },
  })),
  ...generatePhoneticHandlers(),
} satisfies EditorCustomHandlers;

export type ScriptEditorToolbarHandlers = typeof customHandlers & {
  playSelection: EditorHandler;
};

// ── Toolbar items ──────────────────────────────────────────────────────────

export const toolbarItems: EditorToolbarItem<ScriptEditorToolbarHandlers>[][] = [
  [
    {
      kind: "undo",
      icon: "i-heroicons-arrow-uturn-left",
      tooltip: { text: "Undo" },
      "aria-label": "Undo",
    },
    {
      kind: "redo",
      icon: "i-heroicons-arrow-uturn-right",
      tooltip: { text: "Redo" },
      "aria-label": "Redo",
    },
  ],
  [
    {
      kind: "playSelection",
      icon: "i-heroicons-speaker-wave",
      tooltip: { text: "Play selected word" },
      "aria-label": "Play selected word",
    },
    {
      kind: "pronunciation",
      icon: "i-heroicons-chat-bubble-oval-left",
      tooltip: { text: "Add pronunciation" },
      "aria-label": "Add pronunciation",
    },
  ],
  [
    {
      kind: "break",
      icon: "i-heroicons-pause-circle",
      tooltip: { text: "Insert break" },
      "aria-label": "Insert break",
    },
  ],
  [
    {
      kind: "stressUp",
      icon: "i-heroicons-chevron-double-up",
      tooltip: { text: "Stress +1" },
      "aria-label": "Stress +1",
    },
    {
      kind: "stressDown",
      icon: "i-heroicons-chevron-double-down",
      tooltip: { text: "Stress -1" },
      "aria-label": "Stress -1",
    },
  ],
];
