import { createApp } from "vue";
import { createPinia } from "pinia";
import { createRouter, createWebHistory } from "vue-router";
import ui from "@nuxt/ui/vue-plugin";
import App from "./App.vue";
import "./styles.css";

const app = createApp(App);
const router = createRouter({
  history: createWebHistory(),
  routes: [{ path: "/:pathMatch(.*)*", component: { template: "<div />" } }],
});

app.use(createPinia());
app.use(router);
app.use(ui);

void router.isReady().then(() => {
  app.mount("#app");
});
