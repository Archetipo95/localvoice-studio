// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { routes } from "./router";

describe("router", () => {
  it("defines the home route for the studio", () => {
    expect(routes.find((route) => route.path === "/")?.name).toBe("home");
  });

  it("defines the changelog route", () => {
    expect(routes.find((route) => route.path === "/changelog")?.name).toBe("changelog");
  });

  it("defines a fallback not-found route", () => {
    expect(routes.find((route) => route.name === "not-found")?.path).toBe("/:pathMatch(.*)*");
  });
});
