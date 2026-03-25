export type SpeechMarkupSegment =
  | { type: "text"; value: string }
  | { type: "phoneme"; value: string; label: string }
  | { type: "stress"; value: string; label: string; level: -2 | -1 | 1 | 2 }
  | { type: "break"; value: string; label: string; pauseMs: number };

const SPEECH_MARKUP_PATTERN = /\[([^\]]+)\]\((\/[^)]+\/|[+-][12]|break:\d+)\)/g;
const VOWEL_OR_STRESSABLE_PATTERN = /[aəeɛɪiɔoʊuʌæɑɚɝɒœøyɨɐɜɞɯʉʏɶ]/i;

export function parseSpeechMarkup(text: string): SpeechMarkupSegment[] {
  SPEECH_MARKUP_PATTERN.lastIndex = 0;
  const segments: SpeechMarkupSegment[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(SPEECH_MARKUP_PATTERN)) {
    const full = match[0];
    const label = match[1] ?? "";
    const annotation = match[2] ?? "";
    const index = match.index ?? 0;

    if (lastIndex < index) {
      segments.push({ type: "text", value: text.slice(lastIndex, index) });
    }

    if (annotation.startsWith("/") && annotation.endsWith("/")) {
      segments.push({
        type: "phoneme",
        label,
        value: annotation.slice(1, -1).trim(),
      });
    } else if (annotation.startsWith("break:")) {
      segments.push({
        type: "break",
        label,
        value: label,
        pauseMs: Number(annotation.slice("break:".length)),
      });
    } else {
      const level = Number(annotation) as -2 | -1 | 1 | 2;
      segments.push({
        type: "stress",
        label,
        value: label,
        level,
      });
    }

    lastIndex = index + full.length;
  }

  if (lastIndex < text.length) {
    segments.push({ type: "text", value: text.slice(lastIndex) });
  }

  if (segments.length === 0) {
    return [{ type: "text", value: text }];
  }

  return segments;
}

export function hasSpeechMarkup(text: string): boolean {
  SPEECH_MARKUP_PATTERN.lastIndex = 0;
  return SPEECH_MARKUP_PATTERN.test(text);
}

export function stripSpeechMarkup(text: string): string {
  return parseSpeechMarkup(text)
    .map((segment) => (segment.type === "text" ? segment.value : segment.label))
    .join("");
}

export function applyStressLevel(phonemes: string, level: -2 | -1 | 1 | 2): string {
  if (!phonemes) {
    return phonemes;
  }

  const primaryIndex = phonemes.indexOf("ˈ");
  const secondaryIndex = phonemes.indexOf("ˌ");
  const stressIndex =
    primaryIndex === -1
      ? secondaryIndex
      : secondaryIndex === -1
        ? primaryIndex
        : Math.min(primaryIndex, secondaryIndex);

  if (level < 0) {
    if (stressIndex === -1) {
      return phonemes;
    }

    if (level === -2) {
      return phonemes.slice(0, stressIndex) + phonemes.slice(stressIndex + 1);
    }

    const nextMarker = phonemes[stressIndex];
    const replacement = nextMarker === "ˈ" ? "ˌ" : "";
    return phonemes.slice(0, stressIndex) + replacement + phonemes.slice(stressIndex + 1);
  }

  if (primaryIndex !== -1) {
    return phonemes;
  }

  if (secondaryIndex !== -1) {
    return phonemes.slice(0, secondaryIndex) + "ˈ" + phonemes.slice(secondaryIndex + 1);
  }

  const insertionIndex = [...phonemes].findIndex((char) => VOWEL_OR_STRESSABLE_PATTERN.test(char));
  if (insertionIndex === -1) {
    return `ˈ${phonemes}`;
  }

  return phonemes.slice(0, insertionIndex) + "ˈ" + phonemes.slice(insertionIndex);
}
