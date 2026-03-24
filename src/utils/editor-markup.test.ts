import { describe, expect, it } from "vitest";

import { applyBreakMarkup, applyPronunciationMarkup, applyStressMarkup } from "./editor-markup";

describe("editor markup actions", () => {
  it("wraps the selected text with stress markup", () => {
    expect(applyStressMarkup("Leave it better.", 9, 15, 1)).toEqual({
      text: "Leave it [better](+1).",
      selectionStart: 9,
      selectionEnd: 21,
    });
  });

  it("renders negative stress levels without a plus sign", () => {
    expect(applyStressMarkup("Leave it better.", 9, 15, -2)).toEqual({
      text: "Leave it [better](-2).",
      selectionStart: 9,
      selectionEnd: 21,
    });
  });

  it("wraps the selected text with a pronunciation template and selects the phoneme part", () => {
    expect(applyPronunciationMarkup("Say stewardship now.", 4, 15)).toEqual({
      text: "Say [stewardship](/stewardship/) now.",
      selectionStart: 18,
      selectionEnd: 29,
    });
  });

  it("wraps the selected text with a break template and selects the pause amount", () => {
    expect(applyBreakMarkup("Pause here now.", 0, 10)).toEqual({
      text: "[Pause here](break:500) now.",
      selectionStart: 18,
      selectionEnd: 21,
    });
  });

  it("returns null when nothing is selected", () => {
    expect(applyStressMarkup("Hello", 2, 2, -1)).toBeNull();
    expect(applyPronunciationMarkup("Hello", 2, 2)).toBeNull();
    expect(applyBreakMarkup("Hello", 2, 2)).toBeNull();
  });

  it("preserves surrounding text when replacing a middle selection", () => {
    expect(applyPronunciationMarkup("abc def ghi", 4, 7)).toEqual({
      text: "abc [def](/def/) ghi",
      selectionStart: 10,
      selectionEnd: 13,
    });
  });
});
