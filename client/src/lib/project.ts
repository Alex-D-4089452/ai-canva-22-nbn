import type { Project } from "@stackblitz/sdk";

/**
 * A flat file tree keyed by file path, as expected by the StackBlitz SDK.
 */
export interface ProjectFiles {
  [path: string]: string;
}

/**
 * Strips the `ReactDOM.createRoot(...).render(<App />)` bootstrap line from
 * generated code. That call moves to the project's entry file instead.
 */
function stripRenderCall(code: string): string {
  return code
    .split("\n")
    .filter((line) => !/ReactDOM\.(createRoot|render)\s*\(/.test(line))
    .join("\n")
    .trim();
}

/**
 * The UI Design box's generation prompt tells the model to "define a component
 * called App" but does not require it to `export default`. If the generated
 * App file has no default export, the entry file's `import App from "./App"`
 * resolves to `undefined`, which React reports as "Element type is invalid ...
 * got: object ... mixed up default and named imports". Guarantee a default
 * export unless the generated code already provides one.
 */
function ensureDefaultExport(appFile: string): string {
  if (/\bexport\s+default\b/.test(appFile)) return appFile;
  return `${appFile}\n\nexport default App;`;
}

/**
 * Turns a single generated React component (which uses the `React.*` API and
 * ends with a `ReactDOM.createRoot` render call) into a real, runnable Vite
 * React project: index.html + entry + App + package.json + vite config.
 */
export function toReactProject(code: string): ProjectFiles {
  const appCode = stripRenderCall(code);
  const hasReactImport = /import\s+React\b/.test(appCode);
  const appFile = ensureDefaultExport(
    (hasReactImport ? appCode : `import React from "react";\n\n${appCode}`).trim()
  );

  return {
    // StackBlitz WebContainers (template: 'node') requires `path.relative()`-style,
    // non-leading-slash file paths — a leading "/" makes it throw
    // "path should be a path.relative()'d string".
    "App.jsx": appFile,
    "index.jsx": `import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import App from "./App";

const root = createRoot(document.getElementById("root"));
root.render(
  <StrictMode>
    <App />
  </StrictMode>
);`,
    "index.html": `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>AI Canva Prototype</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="./index.jsx"></script>
  </body>
</html>`,
    "package.json": JSON.stringify(
      {
        scripts: { dev: "vite", build: "vite build", preview: "vite preview" },
        dependencies: { react: "^18.2.0", "react-dom": "^18.2.0" },
        devDependencies: {
          "@vitejs/plugin-react": "3.1.0",
          vite: "4.1.4",
          "esbuild-wasm": "0.17.12",
        },
      },
      null,
      2
    ),
    "vite.config.js": `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
});`,
    "styles.css": `body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 0; }
#root { padding: 16px; }
* { box-sizing: border-box; }`,
  };
}

/**
 * Builds a StackBlitz project definition from the generated code so it can be
 * opened in a full IDE via `sdk.openProject(...)`.
 */
export function toStackBlitzProject(code: string): Project {
  return {
    title: "AI Canva Prototype",
    description: "A React prototype generated with AI Canva",
    template: "node",
    files: toReactProject(code),
  };
}
