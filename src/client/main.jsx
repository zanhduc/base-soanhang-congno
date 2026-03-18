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

  const styleTag = document.createElement("style")
  styleTag.textContent = globalStyles
  head.appendChild(styleTag)
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
