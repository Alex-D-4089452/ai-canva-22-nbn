import type { BoxTypeMeta } from "../core.js";

/**
 * The user-prompt template for applying a change request to the code a UI
 * Design box already generated. Deliberately NOT editable per box: the rules in
 * it are what stop an AI change from quietly dropping features the request never
 * mentioned. The box's own system prompt and build prompt stay editable.
 */
export const CODE_CHANGE_PROMPT = `Here is the current code of a working prototype, followed by a change request. Apply ONLY that change and return the complete updated file.

Rules:
- Return the COMPLETE file — never a fragment, never a diff, never an explanation.
- Keep every part the request does not mention exactly as it is: no reformatting, no renaming, no "improvements", no dropping features.
- Change as little as the request allows. If the request is ambiguous, choose the smallest sensible interpretation and keep the rest working.
- Keep the existing structure and style of the file.

The current code:

\`\`\`jsx
{{code}}
\`\`\`

Change request:
{{request}}`;

export const uiBox: BoxTypeMeta = {
  label: "UI Design",
  icon: "✨",
  color: "#c026d3",
  description: "Generate beautiful, production-quality React UIs with Tailwind CSS.",
  hasAI: true,
  category: "worker",
  roles: ["designer"],
  defaultPrompt:
    "Design a beautiful React UI for the following. Use Tailwind CSS classes for ALL styling (no inline styles). Make it look like a real polished product.\n\nDesign requirements:\n- Modern, clean design with attention to detail\n- Good spacing, typography, and color harmony\n- Use gradients, shadows, rounded corners, and smooth transitions\n- Hover states on interactive elements\n- Include at least one gradient or glassmorphism effect\n- Make it responsive\n- Use small mock data (3-5 items)\n\nOutput ONLY JavaScript/JSX code. Use React hooks (React.useState, React.useEffect). Define a component called App. End with ReactDOM.createRoot(document.getElementById('root')).render(<App />).\n\nDescription:\n{{inputs}}",
  defaultSystemPrompt:
    "You are an expert UI designer and React developer. You create beautiful, modern, production-quality user interfaces using Tailwind CSS classes. Focus on visual polish: gradients, shadows, rounded corners, good typography, proper spacing, and smooth transitions. Make it look like a real product — not a demo. Output ONLY JavaScript/JSX code. Use the React.* API. Define App component. End with ReactDOM.createRoot(document.getElementById('root')).render(<App />).",
  defaultWidth: 440,
  defaultHeight: 420,
};
