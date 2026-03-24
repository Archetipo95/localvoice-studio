import { describe, expect, it, vi } from "vitest";

describe("useAppState", () => {
  it("exposes a shared state ref and dispatch reducer updates", async () => {
    vi.resetModules();
    const { useAppState } = await import("./useAppState");

    const first = useAppState();
    const second = useAppState();

    expect(first.state).toBe(second.state);

    first.dispatch({ type: "text", text: "Hello from composable" });
    expect(second.state.value.text).toBe("Hello from composable");

    first.dispatch({ type: "speed", speed: 1.4 });
    expect(first.state.value.speed).toBe(1.4);
  });
});
