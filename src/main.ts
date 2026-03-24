import { createApp, h } from "vue";
import { createRouter, createWebHistory } from "vue-router";
import ui from "@nuxt/ui/vue-plugin";
import App from "./App.vue";
import "./styles.css";

const app = createApp(App);
const router = createRouter({
  routes: [{ path: "/:pathMatch(.*)*", component: { render: () => h("div") } }],
  history: createWebHistory(),
});
app.use(router);
app.use(ui);
app.mount("#app");
