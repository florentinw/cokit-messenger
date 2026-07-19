import "web-streams-polyfill/polyfill";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { isTauri } from "@tauri-apps/api/core";
import { initTheme } from "./lib/theme";
import "./styles/app.css";

initTheme();

if (isTauri()) {
  document.documentElement.classList.add("tauri-vibrancy");
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
