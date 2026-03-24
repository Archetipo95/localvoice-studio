export interface EditorTransformResult {
  text: string;
  selectionStart: number;
  selectionEnd: number;
}

function replaceSelection(
  text: string,
  selectionStart: number,
  selectionEnd: number,
  replacement: string,
  nextSelectionStart: number,
  nextSelectionEnd: number,
): EditorTransformResult {
  return {
    text: text.slice(0, selectionStart) + replacement + text.slice(selectionEnd),
    selectionStart: nextSelectionStart,
    selectionEnd: nextSelectionEnd,
  };
}

export function applyStressMarkup(
  text: string,
  selectionStart: number,
  selectionEnd: number,
  level: -2 | -1 | 1 | 2,
): EditorTransformResult | null {
  const selected = text.slice(selectionStart, selectionEnd);
  if (!selected) {
    return null;
  }

  const replacement = `[${selected}](${level > 0 ? `+${level}` : `${level}`})`;
  return replaceSelection(
    text,
    selectionStart,
    selectionEnd,
    replacement,
    selectionStart,
    selectionStart + replacement.length,
  );
}

export function applyPronunciationMarkup(
  text: string,
  selectionStart: number,
  selectionEnd: number,
): EditorTransformResult | null {
  const selected = text.slice(selectionStart, selectionEnd);
  if (!selected) {
    return null;
  }

  const replacement = `[${selected}](/${selected}/)`;
  const phonemeStart = selectionStart + selected.length + 3;
  const phonemeEnd = phonemeStart + selected.length;

  return replaceSelection(
    text,
    selectionStart,
    selectionEnd,
    replacement,
    phonemeStart,
    phonemeEnd,
  );
}

export function applyBreakMarkup(
  text: string,
  selectionStart: number,
  selectionEnd: number,
): EditorTransformResult | null {
  const selected = text.slice(selectionStart, selectionEnd);
  if (!selected) {
    return null;
  }

  const replacement = `[${selected}](break:500)`;
  const pauseStart = selectionStart + selected.length + 8;
  const pauseEnd = pauseStart + 3;

  return replaceSelection(text, selectionStart, selectionEnd, replacement, pauseStart, pauseEnd);
}
