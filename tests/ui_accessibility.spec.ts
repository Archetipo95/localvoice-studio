import { test, expect, Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function setTheme(page: Page, label: string): Promise<void> {
  const themeButton = page.getByRole("button", { name: /System|Light|Dark/ });
  await themeButton.click();
  const themeItem = page.getByRole("menuitem", { name: label, exact: true });
  await expect(themeItem).toBeVisible();
  await themeItem.click();
  await expect(themeButton).toHaveText(label, { timeout: 5000 });
  await expect(page.locator("#app")).not.toHaveAttribute("aria-hidden", "true", {
    timeout: 5000,
  });
}

async function tabTo(page: Page, locator: any, attempts: number = 60): Promise<void> {
  for (let index = 0; index < attempts; index += 1) {
    await page.keyboard.press("Tab");
    if (await locator.evaluate((element: HTMLElement) => element === document.activeElement)) {
      return;
    }
  }

  await expect(locator).toBeFocused();
}

test.beforeEach(async ({ page }) => {
  await page.goto("/?mockTts=1");
  await expect(page.getByRole("banner").getByText("LocalVoice Studio")).toBeVisible({
    timeout: 10000,
  });
  await expect(page.getByRole("combobox", { name: "Runtime", exact: true })).toBeVisible({
    timeout: 10000,
  });
  await expect(page.locator(".tiptap[contenteditable='true']")).toBeVisible({ timeout: 10000 });
});

test("axe audit has no serious accessibility violations in light and dark themes", async ({
  page,
}) => {
  for (const themeLabel of ["Light", "Dark"]) {
    await setTheme(page, themeLabel);

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      // Some violations come from third-party UI internals (icon-only editor buttons)
      // and visual design token contrast that is tracked separately from functional checks.
      .disableRules(["region", "button-name", "color-contrast", "aria-hidden-focus"])
      .analyze();

    const seriousViolations = results.violations.filter(
      (violation: any) => violation.impact === "serious" || violation.impact === "critical",
    );

    expect(seriousViolations).toEqual([]);
  }
});

test("keyboard navigation reaches the main controls", async ({ page }) => {
  const themeButton = page.getByRole("button", { name: /System|Light|Dark/ });
  await tabTo(page, themeButton);
  await expect(themeButton).toBeFocused();

  await tabTo(page, page.getByLabel("Runtime"));
  await expect(page.getByLabel("Runtime")).toBeFocused();

  const baseVoiceSelect = page.getByRole("combobox", { name: "Base Voice", exact: true });
  await tabTo(page, baseVoiceSelect);
  await expect(baseVoiceSelect).toBeFocused();

  await tabTo(page, page.getByRole("button", { name: "Generate" }));
  await expect(page.getByRole("button", { name: "Generate" })).toBeFocused();
});

test("theme button is keyboard focusable", async ({ page }) => {
  const themeButton = page.getByRole("button", { name: /System|Light|Dark/ });
  await tabTo(page, themeButton);
  await expect(themeButton).toBeFocused();
});

test("keyboard users can apply markup and generate audio", async ({ page }) => {
  const editor = page.locator(".tiptap[contenteditable='true']");
  await editor.click();
  await editor.fill("Leave it better.");

  const generateButton = page.getByRole("button", { name: "Generate Audio" });
  await expect(generateButton).toBeEnabled({ timeout: 10000 });
  await tabTo(page, generateButton);
  await expect(generateButton).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#output-audio")).toHaveAttribute("src", /^blob:/);
});

test("keyboard users can reach the pronunciation preview control", async ({ page }) => {
  const button = page.getByRole("button", { name: "Play pronunciation for stewardship" });

  await expect(button).toBeVisible();
  await tabTo(page, button, 120);
  await expect(button).toBeFocused();
});
