import { describe, it, expect } from "vitest";
import { toReactProject, toStackBlitzProject } from "./project.js";

const SAMPLE_CODE = `function App() {
  const [count, setCount] = React.useState(0);
  return <button onClick={() => setCount(count + 1)}>{count}</button>;
}
ReactDOM.createRoot(document.getElementById('root')).render(<App />);`;

describe("toReactProject", () => {
  it("produces a runnable Vite React project file tree", () => {
    const files = toReactProject(SAMPLE_CODE);
    expect(Object.keys(files)).toEqual(
      expect.arrayContaining([
        "App.jsx",
        "index.jsx",
        "index.html",
        "package.json",
        "vite.config.js",
        "styles.css",
      ])
    );
  });

  it("adds a React import and strips the render call from App.jsx", () => {
    const app = toReactProject(SAMPLE_CODE)["App.jsx"];
    expect(app).toContain('import React from "react"');
    expect(app).toContain("React.useState");
    expect(app).not.toContain("ReactDOM.createRoot");
  });

  it("does not duplicate a React import if the code already has one", () => {
    const withImport = `import React from "react";\nfunction App() { return <div/>; }\nReactDOM.createRoot(document.getElementById('root')).render(<App />);`;
    const app = toReactProject(withImport)["App.jsx"];
    expect(app.match(/import React/g)).toHaveLength(1);
  });

  it("wires the entry file to render App into #root", () => {
    const entry = toReactProject(SAMPLE_CODE)["index.jsx"];
    expect(entry).toContain('import App from "./App"');
    expect(entry).toContain('createRoot(document.getElementById("root"))');
  });

  it("adds a default export to App.jsx (StackBlitz) when the code omits it", () => {
    const app = toReactProject(SAMPLE_CODE)["App.jsx"];
    expect(app).toContain("export default App;");
  });

  it("does not duplicate an existing default export", () => {
    const withExport = `function App() { return <div/>; }\nexport default App;\nReactDOM.createRoot(document.getElementById('root')).render(<App />);`;
    const app = toReactProject(withExport)["App.jsx"];
    expect((app.match(/export default/g) || []).length).toBe(1);
  });
});

describe("toStackBlitzProject", () => {
  it("returns a node-template project with the generated files", () => {
    const project = toStackBlitzProject(SAMPLE_CODE);
    expect(project.template).toBe("node");
    expect(project.files).toHaveProperty("App.jsx");
    expect(project.files).toHaveProperty("package.json");
  });
});
