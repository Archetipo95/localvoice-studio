import { describe, expect, it, vi } from "vitest";
import {
  GITHUB_RELEASES_FEED_URL,
  GITHUB_RELEASES_PAGE_URL,
  fetchGithubReleases,
  normalizeGithubReleases,
} from "./useGithubReleases";

describe("normalizeGithubReleases", () => {
  it("maps release feed entries into the app version shape", () => {
    const versions = normalizeGithubReleases([
      {
        name: "Version 1.2.0",
        tag_name: "v1.2.0",
        published_at: "2026-04-15T10:00:00.000Z",
        body: "## 1.2.0 (2026-04-15)\n\n## Added\n- Changelog page",
        html_url: "https://github.com/Archetipo95/localvoice-studio/releases/tag/v1.2.0",
      },
    ]);

    expect(versions).toEqual([
      {
        tag: "v1.2.0",
        title: "Version 1.2.0",
        date: "2026-04-15T10:00:00.000Z",
        markdown: "## 🚀 Added\n- Changelog page",
        url: "https://github.com/Archetipo95/localvoice-studio/releases/tag/v1.2.0",
      },
    ]);
  });

  it("keeps the first markdown heading when it is not a duplicate version/date line", () => {
    const versions = normalizeGithubReleases([
      {
        name: "Version 1.2.0",
        tag_name: "v1.2.0",
        published_at: "2026-04-15T10:00:00.000Z",
        body: "## Highlights\n- Better controls",
      },
    ]);

    expect(versions[0]?.markdown).toBe("## Highlights\n- Better controls");
  });

  it("adds Nuxt-style emojis to common changelog groups", () => {
    const versions = normalizeGithubReleases([
      {
        name: "Version 1.3.0",
        tag_name: "v1.3.0",
        body: "## Fixes\n- Better retry\n## Docs\n- Improve README",
      },
    ]);

    expect(versions[0]?.markdown).toBe("## 🩹 Fixes\n- Better retry\n## 📖 Docs\n- Improve README");
  });

  it("does not duplicate emoji when a section heading already has one", () => {
    const versions = normalizeGithubReleases([
      {
        name: "Version 1.3.1",
        tag_name: "v1.3.1",
        body: "## 🩹 Fixes\n- Preserve formatting",
      },
    ]);

    expect(versions[0]?.markdown).toBe("## 🩹 Fixes\n- Preserve formatting");
  });

  it("falls back safely when name, markdown, or url are missing", () => {
    const versions = normalizeGithubReleases([
      {
        tag_name: "v1.0.0",
        published_at: "not-a-real-date",
      },
    ]);

    expect(versions).toEqual([
      {
        tag: "v1.0.0",
        title: "v1.0.0",
        date: "not-a-real-date",
        markdown: "",
        url: `${GITHUB_RELEASES_PAGE_URL}/tag/v1.0.0`,
      },
    ]);
  });

  it("ignores releases that do not have a tag", () => {
    const versions = normalizeGithubReleases([
      {
        name: "Incomplete release",
      },
    ]);

    expect(versions).toEqual([]);
  });

  it("ignores draft releases", () => {
    const versions = normalizeGithubReleases([
      {
        name: "Draft release",
        tag_name: "v9.9.9",
        draft: true,
      },
    ]);

    expect(versions).toEqual([]);
  });
});

describe("fetchGithubReleases", () => {
  it("requests the public releases feed and normalizes the payload", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ tag_name: "v1.0.0", body: "Hello" }],
    });

    const versions = await fetchGithubReleases(fetchMock as unknown as typeof fetch);

    expect(fetchMock).toHaveBeenCalledWith(GITHUB_RELEASES_FEED_URL, {
      headers: { accept: "application/json" },
    });
    expect(versions[0]?.tag).toBe("v1.0.0");
  });

  it("throws when the feed response is not successful", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
    });

    await expect(fetchGithubReleases(fetchMock as unknown as typeof fetch)).rejects.toThrow(
      "Unable to load releases (503)",
    );
  });
});
