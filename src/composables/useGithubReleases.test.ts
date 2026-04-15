import { describe, expect, it, vi } from "vitest";
import {
  GITHUB_RELEASES_FEED_URL,
  GITHUB_RELEASES_PAGE_URL,
  fetchGithubReleases,
  normalizeGithubReleases,
} from "./useGithubReleases";

describe("normalizeGithubReleases", () => {
  it("maps release feed entries into the app version shape", () => {
    const versions = normalizeGithubReleases({
      releases: [
        {
          name: "Version 1.2.0",
          tag: "v1.2.0",
          publishedAt: "2026-04-15T10:00:00.000Z",
          markdown: "## Added\n- Changelog page",
          url: "https://github.com/Archetipo95/localvoice-studio/releases/tag/v1.2.0",
        },
      ],
    });

    expect(versions).toEqual([
      {
        tag: "v1.2.0",
        title: "Version 1.2.0",
        date: "2026-04-15T10:00:00.000Z",
        markdown: "## Added\n- Changelog page",
        url: "https://github.com/Archetipo95/localvoice-studio/releases/tag/v1.2.0",
      },
    ]);
  });

  it("falls back safely when name, markdown, or url are missing", () => {
    const versions = normalizeGithubReleases({
      releases: [
        {
          tag: "v1.0.0",
          publishedAt: "not-a-real-date",
        },
      ],
    });

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
    const versions = normalizeGithubReleases({
      releases: [
        {
          name: "Incomplete release",
        },
      ],
    });

    expect(versions).toEqual([]);
  });
});

describe("fetchGithubReleases", () => {
  it("requests the public releases feed and normalizes the payload", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        releases: [{ tag: "v1.0.0", markdown: "Hello" }],
      }),
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
