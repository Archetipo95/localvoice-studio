import type { JSONContent } from "@tiptap/core";
import { parseSpeechMarkup, type SpeechMarkupSegment } from "./pronunciation";

export const PRONUNCIATION_TOKEN_NODE = "pronunciationToken";
export const PAUSE_TOKEN_NODE = "pauseToken";
export const STRESS_TOKEN_NODE = "stressToken";

export const ANNOTATION_TOKEN_NODE_NAMES = [
  PRONUNCIATION_TOKEN_NODE,
  PAUSE_TOKEN_NODE,
  STRESS_TOKEN_NODE,
] as const;

export type AnnotationTokenNodeName = (typeof ANNOTATION_TOKEN_NODE_NAMES)[number];

export interface PronunciationTokenAttrs {
  label: string;
  phonemes: string;
}

export interface PauseTokenAttrs {
  label: string;
  pauseMs: number;
}

export interface StressTokenAttrs {
  label: string;
  level: -2 | -1 | 1 | 2;
}

export type AnnotationTokenAttrs = PronunciationTokenAttrs | PauseTokenAttrs | StressTokenAttrs;

export function isAnnotationNodeName(name: string): name is AnnotationTokenNodeName {
  return (ANNOTATION_TOKEN_NODE_NAMES as readonly string[]).includes(name);
}

export function normalizePauseMs(value: unknown): number {
  const parsed =
    typeof value === "number" ? value : Number.parseInt(String(value ?? "").trim() || "500", 10);
  if (!Number.isFinite(parsed)) {
    return 500;
  }

  return Math.max(0, Math.round(parsed));
}

export function normalizeStressLevel(value: unknown): -2 | -1 | 1 | 2 {
  const parsed = typeof value === "number" ? value : Number.parseInt(String(value ?? "1"), 10);

  if (parsed === -2 || parsed === -1 || parsed === 1 || parsed === 2) {
    return parsed;
  }

  return parsed < 0 ? -1 : 1;
}

export function createPronunciationMarkup(attrs: PronunciationTokenAttrs): string {
  const label = attrs.label ?? "";
  const phonemes = (attrs.phonemes ?? "").trim() || label;
  return `[${label}](/${phonemes}/)`;
}

export function createPauseMarkup(attrs: PauseTokenAttrs): string {
  return `[${attrs.label ?? ""}](break:${normalizePauseMs(attrs.pauseMs)})`;
}

export function createStressMarkup(attrs: StressTokenAttrs): string {
  const level = normalizeStressLevel(attrs.level);
  return `[${attrs.label ?? ""}](${level > 0 ? `+${level}` : `${level}`})`;
}

function segmentToInlineContent(
  segment: Exclude<SpeechMarkupSegment, { type: "text" }>,
): JSONContent {
  if (segment.type === "phoneme") {
    return {
      type: PRONUNCIATION_TOKEN_NODE,
      attrs: {
        label: segment.label,
        phonemes: segment.value,
      } satisfies PronunciationTokenAttrs,
    };
  }

  if (segment.type === "break") {
    return {
      type: PAUSE_TOKEN_NODE,
      attrs: {
        label: segment.label,
        pauseMs: segment.pauseMs,
      } satisfies PauseTokenAttrs,
    };
  }

  return {
    type: STRESS_TOKEN_NODE,
    attrs: {
      label: segment.label,
      level: segment.level,
    } satisfies StressTokenAttrs,
  };
}

function appendTextToParagraphs(paragraphs: JSONContent[], text: string) {
  let current = paragraphs.at(-1);
  if (!current) {
    current = { type: "paragraph", content: [] };
    paragraphs.push(current);
  }

  const parts = text.split("\n");
  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index] ?? "";

    if (part) {
      current.content = current.content ?? [];
      current.content.push({ type: "text", text: part });
    }

    if (index < parts.length - 1) {
      current = { type: "paragraph", content: [] };
      paragraphs.push(current);
    }
  }
}

function appendInlineContent(paragraphs: JSONContent[], node: JSONContent) {
  let current = paragraphs.at(-1);
  if (!current) {
    current = { type: "paragraph", content: [] };
    paragraphs.push(current);
  }

  current.content = current.content ?? [];
  current.content.push(node);
}

export function speechMarkupToEditorDoc(raw: string): JSONContent {
  const paragraphs: JSONContent[] = [{ type: "paragraph", content: [] }];

  for (const segment of parseSpeechMarkup(raw)) {
    if (segment.type === "text") {
      appendTextToParagraphs(paragraphs, segment.value);
      continue;
    }

    appendInlineContent(paragraphs, segmentToInlineContent(segment));
  }

  if (paragraphs.length === 0) {
    paragraphs.push({ type: "paragraph", content: [] });
  }

  return {
    type: "doc",
    content: paragraphs,
  };
}

function inlineNodeToMarkup(node: JSONContent): string {
  if (node.type === "text") {
    return node.text ?? "";
  }

  if (node.type === PRONUNCIATION_TOKEN_NODE) {
    const attrs = node.attrs as Partial<PronunciationTokenAttrs> | undefined;
    return createPronunciationMarkup({
      label: attrs?.label ?? "",
      phonemes: attrs?.phonemes ?? attrs?.label ?? "",
    });
  }

  if (node.type === PAUSE_TOKEN_NODE) {
    const attrs = node.attrs as Partial<PauseTokenAttrs> | undefined;
    return createPauseMarkup({
      label: attrs?.label ?? "",
      pauseMs: attrs?.pauseMs ?? 500,
    });
  }

  if (node.type === STRESS_TOKEN_NODE) {
    const attrs = node.attrs as Partial<StressTokenAttrs> | undefined;
    return createStressMarkup({
      label: attrs?.label ?? "",
      level: normalizeStressLevel(attrs?.level ?? 1),
    });
  }

  if (Array.isArray(node.content)) {
    return node.content.map(inlineNodeToMarkup).join("");
  }

  return "";
}

export function editorDocToSpeechMarkup(doc: JSONContent | null | undefined): string {
  if (!doc?.content?.length) {
    return "";
  }

  const paragraphs = doc.content
    .filter((node) => node.type === "paragraph")
    .map((node) => (node.content ?? []).map(inlineNodeToMarkup).join(""));

  return paragraphs.join("\n");
}
