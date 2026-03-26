import { config } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { ref } from "vue";
import { routeLocationKey, routerKey } from "vue-router";
import { beforeEach } from "vitest";

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
