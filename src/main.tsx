import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./theme.css";

const rootEl = document.getElementById("root");
if (!rootEl) {
  throw new Error("missing root element");
}

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Register the service worker so Chrome treats the app as installable
// and the installed app can open offline. Safari's Add to Dock works
// with or without it.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {
      // Offline support is a nice-to-have; the app works fine without it.
    });
  });
}
