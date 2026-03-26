import type { VoiceOption } from "../types";

const GRADE_SCORES: Record<string, number> = {
  "A+": 12,
  A: 11,
  "A-": 10,
  "B+": 9,
  B: 8,
  "B-": 7,
  "C+": 6,
  C: 5,
  "C-": 4,
  "D+": 3,
  D: 2,
  "D-": 1,
  F: 0,
};

export function sortVoicesByGrade(voices: VoiceOption[]): VoiceOption[] {
  return [...voices].sort((left, right) => {
    const gradeDelta = scoreVoiceGrade(right.overallGrade) - scoreVoiceGrade(left.overallGrade);
    if (gradeDelta !== 0) {
      return gradeDelta;
    }

    return left.label.localeCompare(right.label);
  });
}

export function splitVoicesByGender(voices: VoiceOption[]): {
  female: VoiceOption[];
  male: VoiceOption[];
  other: VoiceOption[];
} {
  const female: VoiceOption[] = [];
  const male: VoiceOption[] = [];
  const other: VoiceOption[] = [];

  for (const voice of voices) {
    const group = inferVoiceGroup(voice);
    if (group === "female") {
      female.push(voice);
      continue;
    }

    if (group === "male") {
      male.push(voice);
      continue;
    }

    other.push(voice);
  }

  return { female, male, other };
}

export function voiceLocaleFlag(voice: VoiceOption): string {
  if (voice.id.startsWith("af_") || voice.id.startsWith("am_")) {
    return "🇺🇸";
  }

  if (voice.id.startsWith("bf_") || voice.id.startsWith("bm_")) {
    return "🇬🇧";
  }

  return "";
}

export function voiceDisplayName(voice: VoiceOption): string {
  const parts = voice.label
    .split("·")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length >= 2 && parts[0] === voice.id) {
    return parts[1] ?? voice.label ?? voice.id;
  }

  return parts[0] || voice.label || voice.id;
}

export function voiceDisplayGender(voice: VoiceOption): string {
  const gender = voice.gender?.trim();
  if (gender) {
    if (gender.toLowerCase().startsWith("f")) {
      return "Female";
    }
    if (gender.toLowerCase().startsWith("m")) {
      return "Male";
    }
    return gender;
  }

  if (voice.id.startsWith("af_") || voice.id.startsWith("bf_") || voice.id.startsWith("if_")) {
    return "Female";
  }

  if (voice.id.startsWith("am_") || voice.id.startsWith("bm_") || voice.id.startsWith("im_")) {
    return "Male";
  }

  return "";
}

export function formatVoiceLabel(voice: VoiceOption): string {
  const flag = voiceLocaleFlag(voice);
  const pieces = [voiceDisplayName(voice)];
  const gender = voiceDisplayGender(voice);
  const grade = voice.overallGrade?.trim() ?? "";

  if (gender) {
    pieces.push(gender);
  }

  if (grade) {
    pieces.push(grade);
  }

  const summary = pieces.join(" · ");
  return flag ? `${flag} ${summary}` : summary;
}

function scoreVoiceGrade(grade: string | undefined): number {
  if (!grade) {
    return -1;
  }

  return GRADE_SCORES[grade.trim().toUpperCase()] ?? -1;
}

function inferVoiceGroup(voice: VoiceOption): "female" | "male" | "other" {
  const gender = voice.gender?.trim().toLowerCase();
  if (gender?.startsWith("f")) {
    return "female";
  }
  if (gender?.startsWith("m")) {
    return "male";
  }

  if (voice.id.startsWith("af_") || voice.id.startsWith("bf_") || voice.id.startsWith("if_")) {
    return "female";
  }
  if (voice.id.startsWith("am_") || voice.id.startsWith("bm_") || voice.id.startsWith("im_")) {
    return "male";
  }

  return "other";
}
