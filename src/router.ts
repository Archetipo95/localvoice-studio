import { createRouter, createWebHistory } from "vue-router";

import ChangelogPage from "./pages/ChangelogPage.vue";
import NotFoundPage from "./pages/NotFoundPage.vue";
import StudioPage from "./pages/StudioPage.vue";

export const routes = [
  {
    path: "/",
    name: "home",
    component: StudioPage,
  },
  {
    path: "/changelog",
    name: "changelog",
    component: ChangelogPage,
  },
  {
    path: "/:pathMatch(.*)*",
    name: "not-found",
    component: NotFoundPage,
  },
];

export function createAppRouter() {
  return createRouter({
    history: createWebHistory(),
    routes,
    scrollBehavior() {
      return { top: 0 };
    },
  });
}

export const router = createAppRouter();
