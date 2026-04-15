import { onMounted, ref } from "vue";

export interface GithubReleaseVersion {
  tag: string;
  title: string;
  date: string;
  markdown: string;
  url: string;
}

interface GithubReleaseFeed {
  releases?: Array<{
    name?: string;
    tag?: string;
    publishedAt?: string;
    markdown?: string;
    url?: string;
  }>;
}

const REPOSITORY = "Archetipo95/localvoice-studio";
export const GITHUB_RELEASES_PAGE_URL = `https://github.com/${REPOSITORY}/releases`;
export const GITHUB_RELEASES_FEED_URL = `https://ungh.cc/repos/${REPOSITORY}/releases`;

export function normalizeGithubReleases(feed: GithubReleaseFeed): GithubReleaseVersion[] {
  return (feed.releases ?? [])
    .filter(
      (release): release is NonNullable<GithubReleaseFeed["releases"]>[number] & { tag: string } =>
        Boolean(release?.tag),
    )
    .map((release) => ({
      tag: release.tag,
      title: release.name?.trim() || release.tag,
      date: release.publishedAt || "",
      markdown: release.markdown || "",
      url: release.url || `${GITHUB_RELEASES_PAGE_URL}/tag/${encodeURIComponent(release.tag)}`,
    }));
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

  const feed = (await response.json()) as GithubReleaseFeed;
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
