// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import { ref } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";

const versions = ref<any[]>([]);
const pending = ref(false);
const error = ref<Error | null>(null);
const refresh = vi.fn();

vi.mock("../composables/useGithubReleases", () => ({
  GITHUB_RELEASES_PAGE_URL: "https://github.com/Archetipo95/localvoice-studio/releases",
  useGithubReleases: () => ({
    versions,
    pending,
    error,
    refresh,
  }),
}));

describe("ChangelogPage", () => {
  beforeEach(() => {
    versions.value = [];
    pending.value = false;
    error.value = null;
    refresh.mockClear();
  });

  async function mountPage() {
    const ChangelogPage = (await import("./ChangelogPage.vue")).default;

    return mount(ChangelogPage, {
      global: {
        stubs: {
          UBadge: { template: "<span><slot />{{ label }}</span>", props: ["label"] },
          USkeleton: { template: "<div class='skeleton'></div>" },
          UButton: { template: "<button><slot />{{ label }}</button>", props: ["label"] },
          UAlert: {
            template: "<div class='alert'>{{ title }} {{ description }}</div>",
            props: ["title", "description"],
          },
          UEmpty: {
            template: "<div class='empty'>{{ title }} {{ description }}</div>",
            props: ["title", "description"],
          },
          UChangelogVersions: {
            props: ["versions"],
            template:
              "<div class='versions'><div v-for='version in versions' :key='version.tag'><slot name='title' :version='version' /><slot name='body' :version='version' /></div></div>",
          },
          ReleaseMarkdown: {
            template: "<div class='release-markdown'>{{ value }}</div>",
            props: ["value"],
          },
        },
      },
    });
  }

  it("shows loading placeholders while the feed is pending", async () => {
    pending.value = true;

    const wrapper = await mountPage();

    expect(wrapper.find("[aria-busy='true']").exists()).toBe(true);
  });

  it("shows an empty state when no releases are published yet", async () => {
    const wrapper = await mountPage();

    expect(wrapper.text()).toContain("No releases published yet");
  });

  it("shows an error state when the feed fails", async () => {
    error.value = new Error("Feed unavailable");

    const wrapper = await mountPage();

    expect(wrapper.text()).toContain("Unable to load changelog entries right now");
    expect(wrapper.text()).toContain("Feed unavailable");
  });

  it("renders changelog entries when versions are available", async () => {
    versions.value = [
      {
        tag: "v1.1.0",
        title: "Spring polish",
        date: "2026-04-15T10:00:00.000Z",
        markdown: "## Added\n- Dedicated changelog page",
        url: "https://github.com/Archetipo95/localvoice-studio/releases/tag/v1.1.0",
      },
    ];

    const wrapper = await mountPage();

    expect(wrapper.text()).toContain("Spring polish");
    expect(wrapper.text()).toContain("v1.1.0");
    expect(wrapper.text()).toContain("Dedicated changelog page");
    expect(wrapper.text()).toContain("View on GitHub");
  });

  it("hides redundant version badge when title already carries the version", async () => {
    versions.value = [
      {
        tag: "v1.1.0",
        title: "1.1.0",
        date: "2026-04-15T10:00:00.000Z",
        markdown: "## Added\n- Dedicated changelog page",
        url: "https://github.com/Archetipo95/localvoice-studio/releases/tag/v1.1.0",
      },
    ];

    const wrapper = await mountPage();

    expect(wrapper.text()).not.toContain("v1.1.0");
    expect(wrapper.text()).toContain("1.1.0");
  });
});
