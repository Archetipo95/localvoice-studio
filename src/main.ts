import { createApp } from "vue";
import { createPinia } from "pinia";
import ui from "@nuxt/ui/vue-plugin";
import App from "./App.vue";
import { router } from "./router";
import "./styles.css";

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.error("Service worker registration failed:", error);
    });
  });
}

const app = createApp(App);

app.use(createPinia());
app.use(router);
app.use(ui);
registerServiceWorker();

void router.isReady().then(() => {
  app.mount("#app");
});
