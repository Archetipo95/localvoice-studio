import { onMounted, ref } from "vue";

export interface GithubReleaseVersion {
  tag: string;
  title: string;
  date: string;
  markdown: string;
  url: string;
}

interface GithubReleaseFeed {
  name?: string;
  tag_name?: string;
  published_at?: string;
  body?: string;
  html_url?: string;
  draft?: boolean;
}

const REPOSITORY = "Archetipo95/localvoice-studio";
export const GITHUB_RELEASES_PAGE_URL = `https://github.com/${REPOSITORY}/releases`;
export const GITHUB_RELEASES_FEED_URL = `https://api.github.com/repos/${REPOSITORY}/releases`;

function extractVersionToken(text: string): string | null {
  const match = text.match(/v?(\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?)/i);
  return match?.[1]?.toLowerCase() || null;
}

function stripLeadingDuplicateVersionLine(
  markdown: string,
  title: string,
  tag: string,
  date: string,
): string {
  if (!markdown.trim()) {
    return "";
  }

  const lines = markdown.split("\n");
  const firstContentLineIndex = lines.findIndex((line) => line.trim().length > 0);

  if (firstContentLineIndex < 0) {
    return markdown;
  }

  const firstLine = lines[firstContentLineIndex]!.trim();
  const comparableFirstLine = firstLine
    .replace(/^#{1,6}\s+/, "")
    .replace(/^\*\*(.*)\*\*$/, "$1")
    .trim()
    .toLowerCase();

  const releaseDate = date ? date.slice(0, 10) : "";
  const titleVersion = extractVersionToken(title);
  const tagVersion = extractVersionToken(tag);

  const hasMatchingVersion = [titleVersion, tagVersion].some(
    (version) => version && comparableFirstLine.includes(version),
  );
  const hasMatchingDate = releaseDate ? comparableFirstLine.includes(releaseDate) : true;

  if (!hasMatchingVersion || !hasMatchingDate) {
    return markdown;
  }

  lines.splice(firstContentLineIndex, 1);

  // Trim a single extra spacer line left behind by removed duplicate heading.
  if (lines[firstContentLineIndex]?.trim() === "") {
    lines.splice(firstContentLineIndex, 1);
  }

  return lines.join("\n").trimStart();
}

const SECTION_EMOJI_RULES: Array<{ pattern: RegExp; emoji: string }> = [
  { pattern: /breaking|deprecat|remove/i, emoji: "💥" },
  { pattern: /security/i, emoji: "🔒" },
  { pattern: /enhancement|feature|added|new/i, emoji: "🚀" },
  { pattern: /fix|bug|patch/i, emoji: "🩹" },
  { pattern: /performance|perf/i, emoji: "⚡" },
  { pattern: /refactor|cleanup|internal/i, emoji: "♻️" },
  { pattern: /docs|documentation/i, emoji: "📖" },
  { pattern: /test|testing/i, emoji: "✅" },
  { pattern: /build|ci|release/i, emoji: "📦" },
  { pattern: /chore|maintenance/i, emoji: "🏡" },
];

function addSectionHeadingEmojis(markdown: string): string {
  if (!markdown.trim()) {
    return markdown;
  }

  return markdown
    .split("\n")
    .map((line) => {
      const headingMatch = line.match(/^(#{2,6})\s+(.+)$/);

      if (!headingMatch) {
        return line;
      }

      const headingLevel = headingMatch[1];
      const headingText = headingMatch[2];

      if (!headingLevel || !headingText) {
        return line;
      }

      const title = headingText.trim();

      if (/^\p{Extended_Pictographic}/u.test(title)) {
        return line;
      }

      const matchingRule = SECTION_EMOJI_RULES.find((rule) => rule.pattern.test(title));

      if (!matchingRule) {
        return line;
      }

      return `${headingLevel} ${matchingRule.emoji} ${title}`;
    })
    .join("\n");
}

export function normalizeGithubReleases(feed: GithubReleaseFeed[]): GithubReleaseVersion[] {
  return feed
    .filter((release): release is GithubReleaseFeed & { tag_name: string } =>
      Boolean(release.tag_name),
    )
    .filter((release) => !release.draft)
    .map((release) => {
      const tag = release.tag_name;
      const title = release.name?.trim() || tag;
      const date = release.published_at || "";
      const markdown = addSectionHeadingEmojis(
        stripLeadingDuplicateVersionLine(release.body || "", title, tag, date),
      );

      return {
        tag,
        title,
        date,
        markdown,
        url: release.html_url || `${GITHUB_RELEASES_PAGE_URL}/tag/${encodeURIComponent(tag)}`,
      };
    });
}

export async function fetchGithubReleases(
  fetchImpl: typeof fetch = fetch,
): Promise<GithubReleaseVersion[]> {
  const response = await fetchImpl(GITHUB_RELEASES_FEED_URL, {
    headers: {
      accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Unable to load releases (${response.status})`);
  }

  const feed = (await response.json()) as GithubReleaseFeed[];
  return normalizeGithubReleases(feed);
}

export function useGithubReleases(
  loader: () => Promise<GithubReleaseVersion[]> = fetchGithubReleases,
) {
  const versions = ref<GithubReleaseVersion[]>([]);
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
