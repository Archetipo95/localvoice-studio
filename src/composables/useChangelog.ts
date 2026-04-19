import { onMounted, ref } from "vue";

import changelogMarkdown from "../../CHANGELOG.md?raw";

export interface ChangelogVersion {
  tag: string;
  title: string;
  date: string;
  markdown: string;
  url?: string;
}

export const GITHUB_CHANGELOG_URL =
  "https://github.com/Archetipo95/localvoice-studio/blob/main/CHANGELOG.md";

const VERSION_HEADING_PATTERN =
  /^##\s+(?:\[(.+?)\]\((.+?)\)|(.+?))\s+\((\d{4}-\d{2}-\d{2})\)\s*$/gm;

function extractVersionTag(title: string): string {
  const match = title.match(/(\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?)/);
  return match ? `v${match[1]}` : title.trim();
}

export function parseChangelogMarkdown(markdown: string): ChangelogVersion[] {
  const matches = Array.from(markdown.matchAll(VERSION_HEADING_PATTERN));

  return matches.map((match, index) => {
    const heading = match[0];
    const title = (match[1] || match[3] || "").trim();
    const url = match[2]?.trim() || undefined;
    const date = match[4] || "";
    const contentStart = (match.index ?? 0) + heading.length;
    const contentEnd = matches[index + 1]?.index ?? markdown.length;
    const body = markdown.slice(contentStart, contentEnd).trim();

    return {
      tag: extractVersionTag(title),
      title,
      date,
      markdown: body.replace(/^#\s+Changelog\s*$/m, "").trim(),
      url,
    };
  });
}

export async function fetchChangelog(): Promise<ChangelogVersion[]> {
  return parseChangelogMarkdown(changelogMarkdown);
}

export function useChangelog(loader: () => Promise<ChangelogVersion[]> = fetchChangelog) {
  const versions = ref<ChangelogVersion[]>([]);
  const pending = ref(true);
  const error = ref<Error | null>(null);

  async function refresh() {
    pending.value = true;
    error.value = null;

    try {
      versions.value = await loader();
    } catch (caughtError) {
      error.value =
        caughtError instanceof Error ? caughtError : new Error("Unable to load changelog.");
      versions.value = [];
    } finally {
      pending.value = false;
    }
  }

  onMounted(() => {
    void refresh();
  });

  return {
    versions,
    pending,
    error,
    refresh,
  };
}
