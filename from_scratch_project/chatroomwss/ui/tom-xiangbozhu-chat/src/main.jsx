import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";

if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('/xbzchat/sw.js', {
        scope: '/xbzchat/',
      });
      console.log('SW registered:', reg);
    } catch (err) {
      console.error('❌ SW register failed', err);
    }
  });
}


createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
