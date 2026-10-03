import type { BoxTypeMeta } from "../core.js";

export const slidesBox: BoxTypeMeta = {
  label: "Slides",
  icon: "📊",
  color: "#fb923c",
  description: "Generate a pitch deck from research. Takes input from connected boxes and creates visual slides.",
  hasAI: true,
  category: "worker",
  roles: ["product", "designer"],
  defaultPrompt:
    "Create a 10-slide startup pitch deck from the following research. Each slide should have a clear title and 3-5 concise bullet points.\n\nSlide structure:\n1. Problem — What pain point exists?\n2. Solution — How does your product solve it?\n3. Market Size — How big is the opportunity?\n4. Product — Key features and demo highlights\n5. Business Model — How do you make money?\n6. Traction — Current progress and metrics\n7. Competition — Competitive landscape and advantage\n8. Team — Who is building this?\n9. Financials — Key projections\n10. Ask — What do you need from investors?\n\nOutput as JSON array: [{\"title\": \"...\", \"bullets\": [\"...\", \"...\"], \"notes\": \"...\"}]\n\nResearch:\n{{inputs}}",
  defaultSystemPrompt:
    "You are a pitch deck creator. You create concise, impactful slides from research data. Output ONLY a valid JSON array of slide objects. Each slide has a \"title\" (string), \"bullets\" (array of strings, 3-5 items), and optional \"notes\" (string with speaker notes). Do not include any text before or after the JSON array.",
  defaultWidth: 380,
  defaultHeight: 380,
};
