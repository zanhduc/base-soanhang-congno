import esbuild from "esbuild";
import fs from "fs";

const result = await esbuild.build({
  entryPoints: ["src/server/index.js"],
  bundle: true,
  outfile: "dist/Code.js",
  format: "esm",
  platform: "neutral",
  treeShaking: false, // giữ tất cả code, không xóa "unused"
  write: false,
});

// GAS không dùng ES modules — strip tất cả export/import keywords
let code = result.outputFiles[0].text;

// Bỏ export declarations
code = code.replace(
  /^export\s+(async\s+)?(function|const|let|var|class)\s+/gm,
  "$1$2 ",
);
code = code.replace(/^export\s+default\s+/gm, "var _default = ");
code = code.replace(/^export\s*\{[^}]*\}\s*;?\s*$/gm, "");

// Bỏ import statements (đã được esbuild bundle vào rồi)
code = code.replace(/^import\s+.*?from\s+["'].*?["'];?\s*$/gm, "");

fs.writeFileSync("dist/Code.js", code.trim());
fs.copyFileSync("appsscript.json", "dist/appsscript.json");

console.log(
  "✅ Server build complete —",
  result.outputFiles[0].text.length,
  "bytes",
);
