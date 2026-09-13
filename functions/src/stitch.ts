import { Stitch, StitchToolClient } from "@google/stitch-sdk";

// Cap the prompt so real pipelines (e.g. a whole Research box via {{inputs}})
// don't make Stitch time out or return a written spec instead of a UI screen.
const MAX_PROMPT_CHARS = 6000;

function createStitchClient() {
  const apiKey = process.env.STITCH_API_KEY;
  if (!apiKey) {
    throw new Error("STITCH_API_KEY is not configured.");
  }
  const client = new StitchToolClient({
    apiKey,
    baseUrl: process.env.STITCH_HOST || "https://stitch.googleapis.com/mcp",
  });
  return new Stitch(client);
}

/**
 * Generates a UI screen from a text prompt using Google Stitch.
 * Returns the HTML content and a screenshot URL.
 */
export async function generateStitchUI(
  prompt: string
): Promise<{ html: string; imageUrl: string }> {
  const trimmed = prompt.trim();
  if (trimmed.length === 0) {
    throw new Error("No prompt provided. Type a description or connect an input.");
  }
  const shortPrompt =
    trimmed.length > MAX_PROMPT_CHARS
      ? trimmed.slice(0, MAX_PROMPT_CHARS).trim()
      : trimmed;

  const stitchInstance = createStitchClient();
  const project = await stitchInstance.createProject("AI Canva");
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
