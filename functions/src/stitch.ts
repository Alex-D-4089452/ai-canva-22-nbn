import { stitch } from "@google/stitch-sdk";

let _projectId: string | null = null;

// Cap the prompt so real pipelines (e.g. a whole Research box via {{inputs}})
// don't make Stitch time out or return a written spec instead of a UI screen.
const MAX_PROMPT_CHARS = 6000;

/**
 * Generates a UI screen from a text prompt using Google Stitch.
 * Returns the HTML content and a screenshot URL.
 */
export async function generateStitchUI(
  prompt: string
): Promise<{ html: string; imageUrl: string }> {
  const apiKey = process.env.STITCH_API_KEY;
  if (!apiKey) {
    throw new Error("STITCH_API_KEY is not configured.");
  }

  const trimmed = prompt.trim();
  if (trimmed.length === 0) {
    throw new Error("No prompt provided. Type a description or connect an input.");
  }
  const shortPrompt =
    trimmed.length > MAX_PROMPT_CHARS
      ? trimmed.slice(0, MAX_PROMPT_CHARS).trim()
      : trimmed;

  // Create or reuse a project
  if (!_projectId) {
    const project = await stitch.createProject("AI Canva");
    _projectId = project.id;
  }

  const project = stitch.project(_projectId);
  // Only send required params — the Stitch API rejects optional deviceType/modelId
  // when the server-side schema has changed since the SDK was published (v0.3.5).
  const screen = await project.generate(shortPrompt);

  // Get the HTML download URL and fetch the actual HTML content
  const htmlUrl = await screen.getHtml();
  const imageUrl = await screen.getImage();

  // Fetch the HTML content from the download URL
  const htmlResponse = await fetch(htmlUrl);
  if (!htmlResponse.ok) {
    throw new Error("Failed to fetch Stitch HTML: " + htmlResponse.status);
  }
  const html = await htmlResponse.text();

  return { html, imageUrl };
}
