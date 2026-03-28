import { describe, expect, it } from "vitest";

import {
  LONG_TEXT_MAX_CHARS,
  LONG_TEXT_NEWLINE_PAUSE_MS,
  LONG_TEXT_PARAGRAPH_PAUSE_MS,
  splitTextForSynthesis,
} from "./long-text";

describe("splitTextForSynthesis", () => {
  it("returns no chunks for empty or whitespace-only text", () => {
    expect(splitTextForSynthesis("   \n\t ")).toEqual([]);
  });

  it("keeps short text in a single chunk", () => {
    expect(splitTextForSynthesis("Short text.")).toEqual([
      { text: "Short text.", pauseAfterMs: 0 },
    ]);
  });

  it("groups sentence chunks up to the configured max length", () => {
    const text = "One short sentence. Two short sentence. Three short sentence.";

    expect(splitTextForSynthesis(text, { maxChunkLength: 30 })).toEqual([
      { text: "One short sentence.", pauseAfterMs: 150 },
      { text: "Two short sentence.", pauseAfterMs: 150 },
      { text: "Three short sentence.", pauseAfterMs: 0 },
    ]);
  });

  it("splits oversized text on clause boundaries before falling back to words", () => {
    const text =
      "This is a fairly long opening clause, and this is another clause, followed by a final clause.";

    const chunks = splitTextForSynthesis(text, { maxChunkLength: 35 });

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.text.length <= 35)).toBe(true);
    expect(chunks.map((chunk) => chunk.text).join(" ")).toBe(text);
  });

  it("never returns chunks longer than the default limit", () => {
    const text = `${"word ".repeat(LONG_TEXT_MAX_CHARS).trim()}. ${"tail ".repeat(30).trim()}.`;

    const chunks = splitTextForSynthesis(text);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.text.length <= LONG_TEXT_MAX_CHARS)).toBe(true);
  });

  it("adds a pause for new lines and a longer one for paragraph breaks", () => {
    expect(splitTextForSynthesis("First line\nSecond line")).toEqual([
      { text: "First line", pauseAfterMs: LONG_TEXT_NEWLINE_PAUSE_MS },
      { text: "Second line", pauseAfterMs: 0 },
    ]);

    expect(splitTextForSynthesis("First paragraph\n\nSecond paragraph")).toEqual([
      { text: "First paragraph", pauseAfterMs: LONG_TEXT_PARAGRAPH_PAUSE_MS },
      { text: "Second paragraph", pauseAfterMs: 0 },
    ]);
  });

  it("uses custom pause settings when provided", () => {
    expect(
      splitTextForSynthesis("One.\nTwo.\n\nThree.", {
        sentencePauseMs: 80,
        newlinePauseMs: 140,
        paragraphPauseMs: 260,
        maxChunkLength: 6,
      }),
    ).toEqual([
      { text: "One.", pauseAfterMs: 140 },
      { text: "Two.", pauseAfterMs: 260 },
      { text: "Three.", pauseAfterMs: 0 },
    ]);
  });

  it("turns inline break markup into explicit chunk pauses", () => {
    expect(splitTextForSynthesis("First [pause here](break:500) second.")).toEqual([
      { text: "First pause here", pauseAfterMs: 500 },
      { text: "second.", pauseAfterMs: 0 },
    ]);
  });

  it("ignores leading line breaks before the first chunk", () => {
    expect(splitTextForSynthesis("\n\nFirst paragraph")).toEqual([
      { text: "First paragraph", pauseAfterMs: 0 },
    ]);
  });

  it("splits a single oversized token into bounded chunks", () => {
    const chunks = splitTextForSynthesis("supercalifragilisticexpialidocious", {
      maxChunkLength: 10,
    });

    expect(chunks).toEqual([
      { text: "supercalif", pauseAfterMs: 150 },
      { text: "ragilistic", pauseAfterMs: 150 },
      { text: "expialidoc", pauseAfterMs: 150 },
      { text: "ious", pauseAfterMs: 0 },
    ]);
  });

  it("falls back cleanly when sentence splitting yields no sentences", () => {
    expect(splitTextForSynthesis("---", { maxChunkLength: 2 })).toEqual([
      { text: "--", pauseAfterMs: 150 },
      { text: "-", pauseAfterMs: 0 },
    ]);
  });

  it("flushes the current chunk before splitting an oversized later part", () => {
    expect(
      splitTextForSynthesis("tiny words enormousphrasewithnospaces", { maxChunkLength: 10 }),
    ).toEqual([
      { text: "tiny words", pauseAfterMs: 150 },
      { text: "enormousph", pauseAfterMs: 150 },
      { text: "rasewithno", pauseAfterMs: 150 },
      { text: "spaces", pauseAfterMs: 0 },
    ]);
  });

  it("flushes accumulated parts when a sentence chunk would overflow the limit", () => {
    expect(splitTextForSynthesis("Alpha beta gamma.", { maxChunkLength: 10 })).toEqual([
      { text: "Alpha beta", pauseAfterMs: 150 },
      { text: "gamma.", pauseAfterMs: 0 },
    ]);
  });

  it("flushes accumulated word groups when combining bounded parts", () => {
    expect(splitTextForSynthesis("aaa bbb ccc", { maxChunkLength: 7 })).toEqual([
      { text: "aaa bbb", pauseAfterMs: 150 },
      { text: "ccc", pauseAfterMs: 0 },
    ]);
  });

  it("creates a new chunk when break label cannot fit into the previous chunk", () => {
    const chunks = splitTextForSynthesis("word [verylonglabel](break:500)", {
      maxChunkLength: 8,
    });

    expect(chunks).toEqual([
      { text: "word", pauseAfterMs: 0 },
      { text: "verylong", pauseAfterMs: 150 },
      { text: "label", pauseAfterMs: 0 },
    ]);
  });

  it("preserves sentences with question marks followed by closing double quotes", () => {
    const text = 'Lorem ipsum "can this work?" or maybe "how far can I push this?"';

    const chunks = splitTextForSynthesis(text);

    expect(chunks).toEqual([{ text, pauseAfterMs: 0 }]);
  });

  it("reconstructs quoted prose without dropping the text between paragraphs", () => {
    const text = `Start test. Lorem ipsum "can this work?" or maybe "how far can I push this?"

End test`;

    const chunks = splitTextForSynthesis(text);
    const reconstructed = chunks
      .map((chunk) => chunk.text)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    expect(reconstructed).toBe(text.replace(/\s+/g, " ").trim());
  });
});
