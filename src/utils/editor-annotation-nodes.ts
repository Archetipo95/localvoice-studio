import { mergeAttributes, Node } from "@tiptap/core";
import type { DOMOutputSpec } from "@tiptap/pm/model";
import {
  PAUSE_TOKEN_NODE,
  PRONUNCIATION_TOKEN_NODE,
  STRESS_TOKEN_NODE,
  type PauseTokenAttrs,
  type PronunciationTokenAttrs,
  type StressTokenAttrs,
  normalizePauseMs,
  normalizeStressLevel,
} from "./editor-document";

function renderTokenShell(
  type: string,
  HTMLAttributes: Record<string, unknown>,
  label: string,
  badge: string,
  previewable = false,
): DOMOutputSpec {
  return [
    "span",
    mergeAttributes(
      {
        "data-type": type,
        "data-annotation-token": type,
        class: `annotation-token annotation-token--${type}`,
      },
      HTMLAttributes,
    ),
    ["span", { class: "annotation-token__label" }, label],
    ["span", { class: "annotation-token__badge" }, badge],
    ...(previewable
      ? [
          [
            "button",
            {
              type: "button",
              class: "annotation-token__action",
              "data-token-action": "play",
              "aria-label": `Play pronunciation for ${label}`,
            },
            "Play",
          ],
        ]
      : []),
  ];
}

export const PronunciationToken = Node.create({
  name: PRONUNCIATION_TOKEN_NODE,
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      label: {
        default: "",
        parseHTML: (element: HTMLElement) => element.getAttribute("data-label") ?? "",
        renderHTML: (attributes: PronunciationTokenAttrs) => ({
          "data-label": attributes.label,
        }),
      },
      phonemes: {
        default: "",
        parseHTML: (element: HTMLElement) => element.getAttribute("data-phonemes") ?? "",
        renderHTML: (attributes: PronunciationTokenAttrs) => ({
          "data-phonemes": attributes.phonemes,
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: `span[data-type="${this.name}"]` }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return renderTokenShell(this.name, HTMLAttributes, node.attrs.label ?? "", "IPA", true);
  },

  renderText({ node }) {
    return node.attrs.label ?? "";
  },
});

export const PauseToken = Node.create({
  name: PAUSE_TOKEN_NODE,
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      label: {
        default: "",
        parseHTML: (element: HTMLElement) => element.getAttribute("data-label") ?? "",
        renderHTML: (attributes: PauseTokenAttrs) => ({
          "data-label": attributes.label,
        }),
      },
      pauseMs: {
        default: 500,
        parseHTML: (element: HTMLElement) =>
          normalizePauseMs(element.getAttribute("data-pause-ms") ?? "500"),
        renderHTML: (attributes: PauseTokenAttrs) => ({
          "data-pause-ms": String(normalizePauseMs(attributes.pauseMs)),
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: `span[data-type="${this.name}"]` }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return renderTokenShell(
      this.name,
      HTMLAttributes,
      node.attrs.label ?? "",
      `${normalizePauseMs(node.attrs.pauseMs)}ms`,
    );
  },

  renderText({ node }) {
    return node.attrs.label ?? "";
  },
});

export const StressToken = Node.create({
  name: STRESS_TOKEN_NODE,
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      label: {
        default: "",
        parseHTML: (element: HTMLElement) => element.getAttribute("data-label") ?? "",
        renderHTML: (attributes: StressTokenAttrs) => ({
          "data-label": attributes.label,
        }),
      },
      level: {
        default: 1,
        parseHTML: (element: HTMLElement) =>
          normalizeStressLevel(element.getAttribute("data-level") ?? "1"),
        renderHTML: (attributes: StressTokenAttrs) => ({
          "data-level": String(normalizeStressLevel(attributes.level)),
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: `span[data-type="${this.name}"]` }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const level = normalizeStressLevel(node.attrs.level);
    return renderTokenShell(
      this.name,
      HTMLAttributes,
      node.attrs.label ?? "",
      level > 0 ? `+${level}` : `${level}`,
    );
  },

  renderText({ node }) {
    return node.attrs.label ?? "";
  },
});
