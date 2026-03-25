function sanitizeFileName(rawName: string): string {
  const normalized = rawName
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^[-_.]+|[-_.]+$/g, "");
  return normalized.length > 0 ? normalized.slice(0, 80) : "localvoice-audio";
}

function ensureWavExtension(name: string): string {
  return name.toLowerCase().endsWith(".wav") ? name : `${name}.wav`;
}

export function normalizeDownloadName(name: string): string {
  return ensureWavExtension(sanitizeFileName(name));
}

function nowDateParts(timestamp = Date.now()) {
  const d = new Date(timestamp);
  const pad = (value: number) => String(value).padStart(2, "0");
  const date = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
  const time = `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  return { date, time };
}

/** Build the default download file name. */
export function resolveOutputFileName(voice: string, timestamp = Date.now()): string {
  const voiceToken = sanitizeFileName(voice || "voice");
  const { date, time } = nowDateParts(timestamp);
  const template = "localvoice-{voice}-{date}-{time}";
  const resolved = template
    .replaceAll("{voice}", voiceToken)
    .replaceAll("{date}", date)
    .replaceAll("{time}", time);
  return normalizeDownloadName(resolved);
}
