const BREAK_MARKUP_PATTERN = /\[([^\]]+)\]\(break:(\d+)\)/g;
export const LONG_TEXT_PAUSE_MS = 150;
export const LONG_TEXT_NEWLINE_PAUSE_MS = 225;
export const LONG_TEXT_PARAGRAPH_PAUSE_MS = 325;
export const LONG_TEXT_MAX_CHARS = 260;

const SENTENCE_PATTERN = /[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g;

interface SplitOptions {
  maxChunkLength?: number;
  sentencePauseMs?: number;
  newlinePauseMs?: number;
  paragraphPauseMs?: number;
}

export interface SynthesisChunk {
  text: string;
  pauseAfterMs: number;
}

export function splitTextForSynthesis(text: string, options: SplitOptions = {}): SynthesisChunk[] {
  const normalized = text.trim();
  if (!normalized) {
    return [];
  }

  const maxChunkLength = options.maxChunkLength ?? LONG_TEXT_MAX_CHARS;
  const sentencePauseMs = options.sentencePauseMs ?? LONG_TEXT_PAUSE_MS;
  const newlinePauseMs = options.newlinePauseMs ?? LONG_TEXT_NEWLINE_PAUSE_MS;
  const paragraphPauseMs = options.paragraphPauseMs ?? LONG_TEXT_PARAGRAPH_PAUSE_MS;
  const chunks: SynthesisChunk[] = [];
  appendSegmentChunks(
    chunks,
    normalized,
    maxChunkLength,
    sentencePauseMs,
    newlinePauseMs,
    paragraphPauseMs,
  );

  if (chunks.length > 0) {
    const last = chunks[chunks.length - 1];
    if (last) {
      chunks[chunks.length - 1] = { ...last, pauseAfterMs: 0 };
    }
  }

  return chunks;
}

function appendSegmentChunks(
  chunks: SynthesisChunk[],
  text: string,
  maxChunkLength: number,
  sentencePauseMs: number,
  newlinePauseMs: number,
  paragraphPauseMs: number,
): void {
  let lastIndex = 0;
  BREAK_MARKUP_PATTERN.lastIndex = 0;

  for (const match of text.matchAll(BREAK_MARKUP_PATTERN)) {
    const label = match[1] ?? "";
    const pauseMs = Number(match[2] ?? 0);
    const index = match.index ?? 0;

    if (lastIndex < index) {
      appendPlainTextChunks(
        chunks,
        text.slice(lastIndex, index),
        maxChunkLength,
        sentencePauseMs,
        newlinePauseMs,
        paragraphPauseMs,
      );
    }

    if (label.trim()) {
      const trimmedLabel = label.trim();
      const previousChunk = chunks.at(-1);
      if (previousChunk && previousChunk.text.length + trimmedLabel.length + 1 <= maxChunkLength) {
        chunks[chunks.length - 1] = {
          ...previousChunk,
          text: `${previousChunk.text} ${trimmedLabel}`.trim(),
        };
      } else {
        appendPlainTextChunks(
          chunks,
          trimmedLabel,
          maxChunkLength,
          sentencePauseMs,
          newlinePauseMs,
          paragraphPauseMs,
        );
      }
    }

    if (chunks.length > 0) {
      const last = chunks[chunks.length - 1];
      if (last) {
        chunks[chunks.length - 1] = {
          ...last,
          pauseAfterMs: Math.max(last.pauseAfterMs, pauseMs),
        };
      }
    }

    lastIndex = index + match[0].length;
  }

  if (lastIndex < text.length) {
    appendPlainTextChunks(
      chunks,
      text.slice(lastIndex),
      maxChunkLength,
      sentencePauseMs,
      newlinePauseMs,
      paragraphPauseMs,
    );
  }
}

function appendPlainTextChunks(
  chunks: SynthesisChunk[],
  text: string,
  maxChunkLength: number,
  sentencePauseMs: number,
  newlinePauseMs: number,
  paragraphPauseMs: number,
): void {
  const blocks = text
    .split(/(\n+)/)
    .map((part) => part.replace(/[ \t]+$/g, ""))
    .filter(Boolean);

  for (const block of blocks) {
    if (/^\n+$/.test(block)) {
      if (chunks.length === 0) {
        continue;
      }

      const last = chunks[chunks.length - 1];
      if (last) {
        chunks[chunks.length - 1] = {
          ...last,
          pauseAfterMs: Math.max(
            last.pauseAfterMs,
            block.length >= 2 ? paragraphPauseMs : newlinePauseMs,
          ),
        };
      }
      continue;
    }

    const sentenceChunks = splitTextBlock(block, maxChunkLength);
    sentenceChunks.forEach((chunkText, index) => {
      chunks.push({
        text: chunkText,
        pauseAfterMs: index < sentenceChunks.length - 1 ? sentencePauseMs : 0,
      });
    });
  }
}

function splitTextBlock(text: string, maxChunkLength: number): string[] {
  const normalized = text.trim();
  const sentences = (normalized.match(SENTENCE_PATTERN) ?? [])
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  if (sentences.length === 0) {
    return splitOversizedSegment(text, maxChunkLength);
  }

  const chunks: string[] = [];
  let currentChunk = "";

  for (const sentence of sentences) {
    const sentenceParts = splitOversizedSegment(sentence, maxChunkLength);
    for (const part of sentenceParts) {
      const candidate = currentChunk ? `${currentChunk} ${part}` : part;
      if (candidate.length <= maxChunkLength) {
        currentChunk = candidate;
        continue;
      }

      if (currentChunk) {
        chunks.push(currentChunk);
      }
      currentChunk = part;
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks;
}

function splitOversizedSegment(segment: string, maxChunkLength: number): string[] {
  const trimmed = segment.trim();
  if (!trimmed) {
    return [];
  }

  if (trimmed.length <= maxChunkLength) {
    return [trimmed];
  }

  const clauseParts = trimmed
    .split(/(?<=[,;:])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (clauseParts.length > 1) {
    return combineBoundedParts(clauseParts, maxChunkLength);
  }

  return combineBoundedParts(trimmed.split(/\s+/), maxChunkLength);
}

function combineBoundedParts(parts: string[], maxChunkLength: number): string[] {
  const chunks: string[] = [];
  let current = "";

  for (const part of parts) {
    if (part.length > maxChunkLength) {
      if (current) {
        chunks.push(current);
        current = "";
      }

      if (/\s/.test(part)) {
        chunks.push(...combineBoundedParts(part.split(/\s+/), maxChunkLength));
        continue;
      }

      for (let start = 0; start < part.length; start += maxChunkLength) {
        chunks.push(part.slice(start, start + maxChunkLength));
      }
      continue;
    }

    const candidate = current ? `${current} ${part}` : part;
    if (candidate.length <= maxChunkLength) {
      current = candidate;
      continue;
    }

    if (current) {
      chunks.push(current);
    }
    current = part;
  }

  if (current) {
    chunks.push(current);
  }

  return chunks;
}
