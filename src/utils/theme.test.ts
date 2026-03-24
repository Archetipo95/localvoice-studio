// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

import { applyThemeMode, loadThemeMode, persistThemeMode, resolveThemeMode } from "./theme";

describe("theme utilities", () => {
  it("loads persisted theme modes and falls back to system", () => {
    window.localStorage.setItem("kokoro-theme", "dark");
    expect(loadThemeMode()).toBe("dark");

    window.localStorage.setItem("kokoro-theme", "nope");
    expect(loadThemeMode()).toBe("system");
  });

  it("falls back to system when localStorage access throws", () => {
    const getItemSpy = vi
      .spyOn(window.localStorage.__proto__, "getItem")
      .mockImplementationOnce(() => {
        throw new Error("blocked");
      });

    expect(loadThemeMode()).toBe("system");
    getItemSpy.mockRestore();
  });

  it("persists theme mode and ignores storage write failures", () => {
    persistThemeMode("light");
    expect(window.localStorage.getItem("kokoro-theme")).toBe("light");

    const setItemSpy = vi
      .spyOn(window.localStorage.__proto__, "setItem")
      .mockImplementationOnce(() => {
        throw new Error("quota");
      });

    expect(() => persistThemeMode("dark")).not.toThrow();
    setItemSpy.mockRestore();
  });

  it("resolves system mode from matchMedia and applies document attributes", () => {
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = vi.fn(() => ({ matches: true }) as any) as any;
    expect(resolveThemeMode("system")).toBe("dark");
    expect(resolveThemeMode("light")).toBe("light");
    expect(resolveThemeMode("dark")).toBe("dark");

    expect(applyThemeMode("system")).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(document.documentElement.style.colorScheme).toBe("dark");
    expect(document.documentElement.getAttribute("data-theme-mode")).toBe("system");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");

    window.matchMedia = vi.fn(() => ({ matches: false }) as any) as any;
    expect(applyThemeMode("system")).toBe("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);

    window.matchMedia = originalMatchMedia;
  });
});
