// Public surface of the box-type system: core shapes, BOX_TYPES, and the
// box-specific constants other modules reference directly.

export * from "./core.js";
export * from "./boxTypes.js";
export { AGENT_CONTROLLER_SYSTEM_PROMPT } from "./boxes/agent.js";
export { CODE_CHANGE_PROMPT } from "./boxes/ui.js";
export { LABEL_COLORS } from "./boxes/label.js";
