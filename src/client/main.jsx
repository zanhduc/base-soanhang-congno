import React from "react"
import ReactDOM from "react-dom/client"
import App from "./app"

const globalStyles = `
  :root {
    --bg: #f8fafc;
    --surface: #ffffff;
    --primary: #2563eb;
    --primary-hover: #1d4ed8;
    --text: #0f172a;
    --text-muted: #64748b;
    --border: #e2e8f0;
    --danger: #ef4444;
  }

  body {
    margin: 0;
    font-family: "Inter", system-ui, -apple-system, sans-serif;
    background-color: var(--bg);
    color: var(--text);
  }

  body.pos-mode {
    background: #f1f5f9;
    touch-action: manipulation;
  }

  body.pos-mode button,
  body.pos-mode [role="button"],
  body.pos-mode a {
    min-height: 44px;
  }

  body.pos-mode input,
  body.pos-mode select,
  body.pos-mode textarea {
    font-size: 16px !important;
  }

  body.pos-mode .global-notice-banner {
    bottom: 78px !important;
  }

  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }

  @keyframes pulseglow {
    0%, 100% { transform: translateY(0); filter: drop-shadow(0 0 0 rgba(0,0,0,0)); }
    50% { transform: translateY(-2px); filter: drop-shadow(0 8px 16px rgba(37,99,235,0.4)); }
  }

  .spinner {
    width: 16px; height: 16px; border-radius: 50%;
    border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
`

const head = document.head || document.getElementsByTagName("head")[0]
if (head) {
  const linkPreconnect1 = document.createElement("link")
  linkPreconnect1.rel = "preconnect"
  linkPreconnect1.href = "https://fonts.googleapis.com"
  head.appendChild(linkPreconnect1)

  const linkPreconnect2 = document.createElement("link")
  linkPreconnect2.rel = "preconnect"
  linkPreconnect2.href = "https://fonts.gstatic.com"
  linkPreconnect2.crossOrigin = "anonymous"
  head.appendChild(linkPreconnect2)

  const linkFont = document.createElement("link")
  linkFont.rel = "stylesheet"
  linkFont.href =
    "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
  head.appendChild(linkFont)

  // Cấu hình CSS an toàn cho iframe và mobile (100dvh thay vì 100vh)
  const iframeGlobalStyles = `
    ${globalStyles}
    @supports (height: 100dvh) {
      .h-screen { height: 100dvh !important; }
      .min-h-screen { min-height: 100dvh !important; }
      .max-h-screen { max-height: 100dvh !important; }
    }
  `

  const styleTag = document.createElement("style")
  styleTag.textContent = iframeGlobalStyles
  head.appendChild(styleTag)

  // Tự động thêm cấu hình viewport chống zoom nếu chạy trong Iframe
  try {
    const isIframe = window.self !== window.top;
    if (isIframe) {
      let viewportMeta = document.querySelector('meta[name="viewport"]');
      if (!viewportMeta) {
        viewportMeta = document.createElement('meta');
        viewportMeta.name = "viewport";
        head.appendChild(viewportMeta);
      }
      viewportMeta.content = "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover";
    }
  } catch (e) {
    // Nếu bị block catch ngoại lệ (Same-origin policy), coi như đang trong Iframe
    let viewportMeta = document.querySelector('meta[name="viewport"]');
    if (viewportMeta) {
      viewportMeta.content = "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover";
    }
  }
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)

const shouldRegisterServiceWorker = (() => {
  if (!("serviceWorker" in navigator)) return false;
  if (!window.isSecureContext) return false;
  try {
    if (window.self !== window.top) return false;
  } catch (e) {
    return false;
  }
  const host = String(window.location.hostname || "").toLowerCase();
  if (
    host.endsWith("script.googleusercontent.com") ||
    host.endsWith("script.google.com")
  ) {
    return false;
  }
  return true;
})();

if (shouldRegisterServiceWorker) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("?sw=1").catch(() => {
      // Ignore registration failure in non-PWA environments.
    });
  });
}
