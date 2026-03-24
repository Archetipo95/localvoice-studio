export const NO_BLEND_VOICE = "__none__";

export function blendRatioParts(secondaryRatio: number): {
  primaryParts: number;
  secondaryParts: number;
} {
  const clampedRatio = Math.max(0, Math.min(100, Math.round(secondaryRatio / 5) * 5));
  if (clampedRatio <= 0) {
    return { primaryParts: 20, secondaryParts: 0 };
  }
  if (clampedRatio >= 100) {
    return { primaryParts: 0, secondaryParts: 20 };
  }

  const secondaryParts = Math.max(1, Math.min(19, Math.round((clampedRatio / 100) * 20)));
  return { primaryParts: 20 - secondaryParts, secondaryParts };
}

export function buildVoiceMix(
  primaryVoice: string,
  secondaryVoice: string,
  secondaryRatio: number,
): string {
  const primary = (primaryVoice || "").trim();
  let secondary = (secondaryVoice || "").trim();
  if (secondary === NO_BLEND_VOICE) {
    secondary = "";
  }

  if (!primary) {
    return "";
  }
  if (!secondary || secondary === primary || secondaryRatio <= 0) {
    return primary;
  }
  if (secondaryRatio >= 100) {
    return secondary;
  }

  const { primaryParts, secondaryParts } = blendRatioParts(secondaryRatio);
  return [...Array(primaryParts).fill(primary), ...Array(secondaryParts).fill(secondary)].join(",");
}
