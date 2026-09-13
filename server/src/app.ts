import express from "express";
import cors from "cors";
import { randomUUID } from "crypto";
import { generateContent } from "./ollama.js";
import { generateCartoonImage } from "./fal.js";
import { generateStitchUI } from "./stitch.js";
import { RepoError, fetchRepoDigest, parseRepoRef } from "./repo.js";

/**
 * In-memory Stitch job store (local dev only).
 *
 * Stitch generation can take 40s+ (well beyond the ~60s Firebase Hosting
 * rewrite timeout in production). So instead of blocking, we create a job and
 * run generation in the background. The client polls /api/stitch-status/:id.
 *
 * Production uses Firestore + a Cloud Task worker instead — see
 * functions/src/stitchJobs.ts. This map lives in app.ts (not index.ts) so the
 * app can be imported without triggering the port bootstrap — which makes the
 * router testable via supertest.
 */
type StitchJob = {
  status: "queued" | "running" | "done" | "error";
  html?: string;
  imageUrl?: string;
  error?: string;
};

export function createApp(): express.Express {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "10mb" }));

  const stitchJobs = new Map<string, StitchJob>();

  function createStitchJob(prompt: string): string {
    const jobId = randomUUID();
    const job: StitchJob = { status: "queued" };
    stitchJobs.set(jobId, job);

    // Fire-and-forget background generation so the request returns immediately.
    generateStitchUI(prompt)
      .then((result) => {
        job.status = "done";
        job.html = result.html;
        job.imageUrl = result.imageUrl;
      })
      .catch((err: any) => {
        console.error(`[/api/stitch-generate] job ${jobId} failed:`, err.message);
        job.status = "error";
        job.error = err.message || "Failed to generate UI";
      });

    return jobId;
  }

  /**
   * POST /api/generate
   * Body: { systemPrompt: string, userPrompt: string }
   * Returns: { content: string, model: string, usage: { promptTokens, completionTokens, totalTokens } }
   */
  app.post("/api/generate", async (req, res) => {
    try {
      const { systemPrompt, userPrompt } = req.body as {
        systemPrompt?: string;
        userPrompt?: string;
      };

      if (!userPrompt || typeof userPrompt !== "string") {
        return res.status(400).json({ error: "userPrompt is required" });
      }

      const result = await generateContent(
        systemPrompt || "You are a helpful assistant.",
        userPrompt
      );

      res.json({
        content: result.content,
        model: result.model,
        usage: {
          promptTokens: result.promptTokens,
          completionTokens: result.completionTokens,
          totalTokens: result.totalTokens,
        },
      });
    } catch (err: any) {
      console.error("[/api/generate] Error:", err.message);
      res.status(500).json({
        error: err.message || "Failed to generate content",
      });
    }
  });

  /**
   * POST /api/generate-image
   * Body: { prompt: string, imageUrl?: string }
   * Returns: { imageUrl: string }
   *
   * Generates a cartoon profile picture via fal.ai.
   * If imageUrl is provided, uses image-to-image (cartoonify).
   * Otherwise, uses text-to-image (flux schnell) as fallback.
   */
  app.post("/api/generate-image", async (req, res) => {
    try {
      const { prompt, imageUrl } = req.body as {
        prompt?: string;
        imageUrl?: string;
      };

      if (!prompt && !imageUrl) {
        return res.status(400).json({
          error: "Either prompt or imageUrl is required",
        });
      }

      const resultUrl = await generateCartoonImage({
        prompt: prompt || "Cartoon style profile picture",
        imageUrl,
      });

      res.json({ imageUrl: resultUrl });
    } catch (err: any) {
      console.error("[/api/generate-image] Error:", err.message);
      res.status(500).json({
        error: err.message || "Failed to generate image",
      });
    }
  });

  /**
   * POST /api/stitch-generate
   * Body: { prompt: string }
   * Returns: { jobId: string, status: "queued" | "running" | "done" | "error" }
   */
  app.post("/api/stitch-generate", async (req, res) => {
    try {
      const { prompt } = req.body as { prompt?: string };
      if (!prompt || typeof prompt !== "string") {
        return res.status(400).json({ error: "prompt is required" });
      }
      const jobId = createStitchJob(prompt);
      res.json({ jobId, status: stitchJobs.get(jobId)!.status });
    } catch (err: any) {
      console.error("[/api/stitch-generate] Error:", err.message);
      res.status(500).json({ error: err.message || "Failed to start UI generation" });
    }
  });

  /**
   * GET /api/stitch-status/:jobId
   * Returns: { status, html?, imageUrl?, error? }
   * The client polls this until status is "done" or "error".
   */
  app.get("/api/stitch-status/:jobId", (req, res) => {
    const job = stitchJobs.get(req.params.jobId);
    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }
    res.json(job);
  });

  /**
   * POST /api/repo-digest
   * Body: { repoUrl: string }   e.g. "https://github.com/owner/repo" or "owner/repo#branch"
   * Returns: { repo, branch, digest, files, treeEntries, chars, truncated, notes }
   *
   * Read-only GitHub access for the Code Map box (see ./repo.ts). Only
   * github.com owner/repo references are accepted, so this cannot be used as a
   * general request proxy. `GITHUB_TOKEN` is optional (public repos work
   * without it; a token unlocks private repos and a higher rate limit).
   */
  app.post("/api/repo-digest", async (req, res) => {
    const { repoUrl } = req.body as { repoUrl?: string };
    const ref = parseRepoRef(repoUrl);
    if (!ref) {
      return res.status(400).json({
        error:
          "Provide a GitHub repository like https://github.com/owner/repo (or owner/repo, optionally owner/repo#branch).",
      });
    }
    try {
      const digest = await fetchRepoDigest(ref, { token: process.env.GITHUB_TOKEN });
      res.json({ ok: true, ...digest });
    } catch (err: any) {
      const status = err instanceof RepoError ? 502 : 500;
      console.error("[/api/repo-digest] Error:", err.message);
      res.status(status).json({ error: err.message || "Failed to read the repository" });
    }
  });

  /**
   * GET /api/health — simple health check
   */
  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      ollamaKey: process.env.OLLAMA_API_KEY ? "configured" : "missing",
      falKey: process.env.FAL_KEY ? "configured" : "missing",
      stitchKey: process.env.STITCH_API_KEY ? "configured" : "missing",
      // Optional: public repositories are read without it.
      githubToken: process.env.GITHUB_TOKEN ? "configured" : "optional",
    });
  });

  /**
   * GET /api/admin/stats — admin-only system stats.
   *
   * The local dev server has no Firebase Admin SDK / service account, so admin
   * stats are only available in the production Cloud Function. This stub keeps
   * the API surface consistent and returns a clear message instead of a 404.
   */
  app.get("/api/admin/stats", (_req, res) => {
    res.status(501).json({
      error: "Admin stats are only available in the Firebase Cloud Function (production).",
    });
  });

  /**
   * POST /api/admin/roles — facilitator role management needs the Admin SDK,
   * so it only exists in the Cloud Function (same deviation as admin stats).
   */
  app.post("/api/admin/roles", (_req, res) => {
    res.status(501).json({
      error: "Role management is only available in the Firebase Cloud Function (production).",
    });
  });

  /**
   * Workshop guest join proxies to the DEPLOYED Cloud Function. The join
   * endpoint mints Firebase custom tokens, which requires the Admin SDK —
   * the local server has no service account. Proxying (instead of stubbing)
   * keeps the full guest flow testable on localhost: the deployed function
   * is the source of truth and localhost is an authorized auth domain.
   */
  app.post("/api/workshop/join", async (req, res) => {
    const PROXY_TARGET =
      process.env.WORKSHOP_PROXY_URL || "https://carbondocs.web.app/api/workshop/join";
    try {
      const r = await fetch(PROXY_TARGET, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req.body || {}),
      });
      const data = await r.json();
      res.status(r.status).json(data);
    } catch (e: any) {
      console.error("[/api/workshop/join] proxy error:", e?.message);
      res
        .status(502)
        .json({ error: "Workshop join is unavailable — the production function could not be reached." });
    }
  });

  return app;
}
