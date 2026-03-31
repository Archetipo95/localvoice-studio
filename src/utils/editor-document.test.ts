import { describe, expect, it } from "vitest";
import {
  PAUSE_TOKEN_NODE,
  PRONUNCIATION_TOKEN_NODE,
  STRESS_TOKEN_NODE,
  createPronunciationMarkup,
  editorDocToSpeechMarkup,
  normalizePauseMs,
  normalizeStressLevel,
  speechMarkupToEditorDoc,
} from "./editor-document";

describe("speechMarkupToEditorDoc", () => {
  it("builds annotation tokens from raw markup", () => {
    const doc = speechMarkupToEditorDoc(
      "Leave the place [better](+1) than [stewardship](/stjuːədʃɪp/) [pause here](break:500).",
    );

    const paragraph = doc.content?.[0];
    expect(paragraph?.type).toBe("paragraph");
    expect(paragraph?.content?.map((node) => node.type)).toEqual([
      "text",
      STRESS_TOKEN_NODE,
      "text",
      PRONUNCIATION_TOKEN_NODE,
      "text",
      PAUSE_TOKEN_NODE,
      "text",
    ]);
  });

  it("preserves empty paragraphs and malformed markup as plain text", () => {
    const doc = speechMarkupToEditorDoc("Hello\n\n[missing](break:)\nworld");

    expect(doc.content).toHaveLength(4);
    expect(doc.content?.[1]?.type).toBe("paragraph");
    expect(doc.content?.[1]?.content).toEqual([]);
    expect(doc.content?.[2]?.content?.[0]).toEqual({
      type: "text",
      text: "[missing](break:)",
    });
  });

  it("supports empty labels and adjacent annotations without losing ordering", () => {
    const doc = speechMarkupToEditorDoc("[](break:500)[](+1)[name](/neɪm/)");

    expect(doc.content?.[0]?.content).toEqual([
      {
        type: PAUSE_TOKEN_NODE,
        attrs: { label: "", pauseMs: 500 },
      },
      {
        type: STRESS_TOKEN_NODE,
        attrs: { label: "", level: 1 },
      },
      {
        type: PRONUNCIATION_TOKEN_NODE,
        attrs: { label: "name", phonemes: "neɪm" },
      },
    ]);
  });
});

describe("editorDocToSpeechMarkup", () => {
  it("roundtrips raw speech markup through the editor document model", () => {
    const raw = "Hello [friend](/fɹɛnd/).\n\n[pause](break:350)\n[stronger](+2) and [softer](-1).";

    expect(editorDocToSpeechMarkup(speechMarkupToEditorDoc(raw))).toBe(raw);
  });

  it("serializes custom annotation nodes back to raw speech markup", () => {
    const doc = {
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
            { type: "text", text: " clearly." },
          ],
        },
      ],
    };

    expect(editorDocToSpeechMarkup(doc)).toBe("Say [Kokoro](/kˈoʊkəɹoʊ/) clearly.");
  });

  it("roundtrips leading and trailing newlines plus adjacent annotations", () => {
    const raw = "\n[](break:500)[](+1)[friend](/fɹɛnd/)\n\n";

    expect(editorDocToSpeechMarkup(speechMarkupToEditorDoc(raw))).toBe(raw);
  });
});

describe("normalizers", () => {
  it("normalizes pause durations and stress levels safely", () => {
    expect(normalizePauseMs(-12)).toBe(0);
    expect(normalizePauseMs("450")).toBe(450);
    expect(normalizeStressLevel(2)).toBe(2);
    expect(normalizeStressLevel("99")).toBe(1);
    expect(normalizeStressLevel("-7")).toBe(-1);
  });

  it("builds pronunciation markup with a label fallback", () => {
    expect(createPronunciationMarkup({ label: "word", phonemes: "" })).toBe("[word](/word/)");
  });
});
