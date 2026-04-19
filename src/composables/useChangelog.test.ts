import { describe, expect, it } from "vitest";

import { parseChangelogMarkdown } from "./useChangelog";

describe("parseChangelogMarkdown", () => {
  it("parses linked and plain version headings into changelog entries", () => {
    const versions = parseChangelogMarkdown(`# Changelog

Intro copy that should not appear in any release body.

## [1.2.0](https://example.com/compare/v1.1.0...v1.2.0) (2026-04-15)

### 🚀 Features

* improve release rendering

## 1.0.0 (2026-03-24)

### 🚀 Features

* initial public release
`);

    expect(versions).toEqual([
      {
        tag: "v1.2.0",
        title: "1.2.0",
        date: "2026-04-15",
        markdown: "### 🚀 Features\n\n* improve release rendering",
        url: "https://example.com/compare/v1.1.0...v1.2.0",
      },
      {
        tag: "v1.0.0",
        title: "1.0.0",
        date: "2026-03-24",
        markdown: "### 🚀 Features\n\n* initial public release",
        url: undefined,
      },
    ]);
  });

  it("ignores the top-level changelog heading and intro text before the first release", () => {
    const versions = parseChangelogMarkdown(`# Changelog

Some intro text.

## 1.1.0 (2026-04-15)

### 🩹 Bug Fixes

* patch dependencies
`);

    expect(versions).toHaveLength(1);
    expect(versions[0]?.markdown).toBe("### 🩹 Bug Fixes\n\n* patch dependencies");
  });

  it("returns an empty list when no version headings are present", () => {
    expect(parseChangelogMarkdown("# Changelog\n\nNo releases yet.")).toEqual([]);
  });
});
