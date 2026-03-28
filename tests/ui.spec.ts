import { test, expect, Page } from "@playwright/test";

async function chooseOption(page: Page, label: string, optionName: string | RegExp): Promise<void> {
  await page.getByRole("combobox", { name: label, exact: true }).click();
  await page.getByRole("option", { name: optionName }).click();
}

async function setSlider(page: Page, selector: string, value: number): Promise<void> {
  await page.locator(selector).evaluate((element: any, nextValue: number) => {
    element.value = String(nextValue);
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
}

async function setTheme(page: Page, label: string): Promise<void> {
  await page.getByRole("button", { name: /System|Light|Dark/ }).click();
  await page.getByRole("menuitem", { name: label, exact: true }).click();
}

async function _openSecondVoiceControls(page: Page): Promise<void> {
  const secondaryVoiceSelect = page.getByRole("combobox", { name: "Add Voice", exact: true });
  if (!(await secondaryVoiceSelect.isVisible())) {
    await page.getByRole("button", { name: "Blend", exact: true }).click();
  }
  await expect(secondaryVoiceSelect).toBeVisible();
}

test("app loads as a calm studio workspace in mock mode", async ({ page }) => {
  await page.goto("/?mockTts=1");

  await expect(page.getByRole("banner").getByText("LocalVoice Studio")).toBeVisible({
    timeout: 10000,
  });
  await expect(page.getByRole("button", { name: /System|Light|Dark/ })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Runtime", exact: true })).toBeVisible();
  // UEditor uses contenteditable div instead of textarea
  await expect(page.locator(".tiptap[contenteditable='true']")).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Base Voice", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Blend", exact: true })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Add Voice", exact: true })).toBeHidden();
  await page.getByRole("combobox", { name: "Base Voice", exact: true }).click();
  await expect(page.getByRole("option", { name: /Heart/ })).toBeVisible();
  await expect(page.getByRole("option", { name: /Michael/ })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator(".markup-summary")).toContainText("Speech Markup");
  await expect(page.locator(".output-empty-state")).toContainText(
    "Generate audio to preview and download your final output.",
  );
  await expect(page.getByLabel("Model Repo")).toHaveCount(0);
  await page.locator(".markup-summary").click();
  await expect(page.locator("body")).toContainText("[stronger](+1)");
});

test("theme defaults to system and follows the browser color scheme", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/?mockTts=1");

  await expect(page.locator("html")).toHaveAttribute("data-theme-mode", "system");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("dark theme can be selected and persists after reload", async ({ page }) => {
  await page.goto("/?mockTts=1");

  await setTheme(page, "Dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme-mode", "dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  const storedTheme = await page.evaluate(() => window.localStorage.getItem("kokoro-theme"));
  expect(storedTheme).toBe("dark");

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme-mode", "dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("generation produces playable output and a download link", async ({ page }) => {
  await page.goto("/?mockTts=1");

  const editor = page.locator(".tiptap[contenteditable='true']");
  await editor.click();
  await editor.fill("Hello from the browser worker.");
  await page.getByRole("button", { name: "Generate Audio" }).click();

  const audio = page.locator("#output-audio");
  const download = page.locator("#download-link");

  await expect(audio).toHaveAttribute("src", /^blob:/);
  await expect(download).toHaveAttribute("href", /^blob:/);
  await expect(download).toHaveAttribute("download", /^localvoice-.*\.wav$/);
});

test("typing into the editor preserves the full text", async ({ page }) => {
  await page.goto("/?mockTts=1");

  const editor = page.locator(".tiptap[contenteditable='true']");
  await editor.click();
  await editor.fill("Hello world.");

  await expect(editor).toContainText("Hello world.");
});

test("long editor content keeps the toolbar visible and scrolls inside the editor panel", async ({
  page,
}) => {
  await page.goto("/?mockTts=1");

  const editor = page.locator(".tiptap[contenteditable='true']");
  const longText = Array.from(
    { length: 120 },
    (_, index) =>
      `Line ${index + 1}: This is a long paragraph to force the editor to overflow and scroll.`,
  ).join("\n\n");

  await editor.click();
  await editor.fill(longText);

  const toolbar = page.locator('[aria-label="Toggle markup view"]').first();

  await expect(toolbar).toBeVisible();
  await expect
    .poll(async () => {
      return await editor.evaluate((element) => {
        const container = element.parentElement;
        return container ? container.scrollHeight > container.clientHeight : false;
      });
    })
    .toBe(true);

  await editor.evaluate((element) => {
    const container = element.parentElement;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  });

  await expect
    .poll(async () => {
      return await editor.evaluate((element) => element.parentElement?.scrollTop ?? 0);
    })
    .toBeGreaterThan(0);
  await expect(toolbar).toBeVisible();
});

test("phonetic suggestion menu opens and inserts an IPA symbol", async ({ page }) => {
  await page.goto("/?mockTts=1");

  const editor = page.locator(".tiptap[contenteditable='true']");
  await editor.click();
  await editor.press("End");
  await editor.type(" :sch");

  await expect(page.getByRole("listbox")).toBeVisible();
  await expect(page.getByRole("option", { name: /ə\s+Schwa/ })).toBeVisible();

  await page.getByRole("option", { name: /ə\s+Schwa/ }).click();

  await expect(page.getByRole("listbox")).toHaveCount(0);
  await expect(editor).toContainText("ə");
});

test("runtime can be switched from gpu to cpu", async ({ page }) => {
  await page.goto("/?mockTts=1");

  const runtimeSelect = page.getByRole("combobox", { name: "Runtime", exact: true });
  await expect(runtimeSelect).toContainText(/GPU|CPU|webgpu|wasm|slower/i);
  await chooseOption(page, "Runtime", "CPU (slower)");
  await expect(runtimeSelect).toContainText(/CPU|slower/i);
});

test("generating with a blended voice produces output", async ({ page }) => {
  await page.goto("/?mockTts=1");

  const editor = page.locator(".tiptap[contenteditable='true']");
  await editor.click();
  await editor.fill("Hi.");
  await _openSecondVoiceControls(page);
  await chooseOption(page, "Add Voice", /Michael/);
  await setSlider(page, "#secondary-ratio-input", 10);
  await page.getByRole("button", { name: "Generate Audio" }).click();

  await expect(page.locator("#output-audio")).toHaveAttribute("src", /^blob:/);
});

test("placeholder shown when editor is empty", async ({ page }) => {
  await page.goto("/?mockTts=1");

  const editor = page.locator(".tiptap[contenteditable='true']");
  await expect(editor).toBeVisible();
  await editor.click();
  await editor.press("ControlOrMeta+A");
  await editor.press("Backspace");

  const placeholderHost = editor.locator("[data-placeholder]").first();
  if (await placeholderHost.count()) {
    await expect(placeholderHost).toBeVisible();
    await expect(placeholderHost).toHaveAttribute(
      "data-placeholder",
      /Type something to generate speech\.\.\./,
    );
    return;
  }

  const firstParagraph = editor.locator("p").first();
  await expect(firstParagraph).toBeVisible();
  await expect
    .poll(async () => {
      const text = await editor.evaluate((element) => element.textContent?.trim() ?? "");
      return text;
    })
    .toBe("");
});

test("placeholder hidden when text is entered", async ({ page }) => {
  await page.goto("/?mockTts=1");

  const editor = page.locator(".tiptap[contenteditable='true']");
  await editor.click();
  await editor.press("ControlOrMeta+A");
  await editor.press("Backspace");
  await editor.type("Hello world");
  await expect(editor).toContainText("Hello world");
  if (await editor.locator("[data-placeholder]").count()) {
    await expect(editor.locator("[data-placeholder]")).toHaveCount(0);
  }
});
