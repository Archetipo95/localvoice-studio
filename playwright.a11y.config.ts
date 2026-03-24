import base from "./playwright.config";

export default {
  ...base,
  testIgnore: [],
  testMatch: ["**/ui_accessibility.spec.ts"],
  use: {
    ...base.use,
    baseURL: "http://127.0.0.1:4174",
  },
  webServer: {
    ...base.webServer,
    command: "npm run dev -- --host 127.0.0.1 --port 4174",
    url: "http://127.0.0.1:4174",
  },
};
