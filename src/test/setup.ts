import { config } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { ref } from "vue";
import { routeLocationKey, routerKey } from "vue-router";
import { beforeEach } from "vitest";

class MemoryStorage implements Storage {
  private readonly store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
}

function ensureLocalStorage(): void {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      return;
    }
  } catch {
    // Fall through and provide an in-memory storage implementation.
  }

  const storage = new MemoryStorage();
  Object.defineProperty(globalThis, "localStorage", {
    value: storage,
    configurable: true,
    writable: true,
  });

  if (typeof window !== "undefined") {
    Object.defineProperty(window, "localStorage", {
      value: storage,
      configurable: true,
      writable: true,
    });
  }
}

ensureLocalStorage();

const mockRoute = {
  fullPath: "/",
  hash: "",
  href: "/",
  matched: [],
  meta: {},
  name: undefined,
  params: {},
  path: "/",
  query: {},
  redirectedFrom: undefined,
};

const mockRouter = {
  resolve(to: unknown) {
    const path = typeof to === "string" ? to : "/";
    return {
      ...mockRoute,
      fullPath: path,
      href: path,
      path,
    };
  },
  push: async () => undefined,
  replace: async () => undefined,
  currentRoute: ref(mockRoute),
};

config.global.provide = {
  ...config.global.provide,
  [routeLocationKey as symbol]: mockRoute,
  [routerKey as symbol]: mockRouter,
};

beforeEach(() => {
  setActivePinia(createPinia());
});
