import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateContent } from "./ollama.js";

// generateContent reads env lazily and calls the global fetch.
describe("generateContent", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    process.env.OLLAMA_HOST = "https://ollama.example";
    process.env.OLLAMA_API_KEY = "test-key";
    delete process.env.OLLAMA_MODEL;
    delete process.env.OLLAMA_TEMPERATURE;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("returns content, model and parsed token counts", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        model: "deepseek-v4-flash",
        message: { role: "assistant", content: "Hello!" },
        prompt_eval_count: 42,
        eval_count: 7,
      }),
    });

    const result = await generateContent("sys", "user input");
    expect(result).toEqual({
      content: "Hello!",
      model: "deepseek-v4-flash",
      promptTokens: 42,
      completionTokens: 7,
      totalTokens: 49,
    });
  });

  it("uses the configured host, model and bearer auth", async () => {
    process.env.OLLAMA_MODEL = "custom-model";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ message: { content: "ok" } }),
    });
    globalThis.fetch = fetchMock as any;

    await generateContent("sys", "hi");

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://ollama.example/api/chat");
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer test-key"
    );
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe("custom-model");
    expect(body.stream).toBe(false);
  });

  it("sends a default temperature and honours OLLAMA_TEMPERATURE", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ message: { content: "ok" } }),
    });
    globalThis.fetch = fetchMock as any;

    await generateContent("sys", "hi");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string).options)
      .toEqual({ num_predict: 8192, temperature: 0.2 });

    process.env.OLLAMA_TEMPERATURE = "0.9";
    await generateContent("sys", "hi");
    expect(JSON.parse(fetchMock.mock.calls[1][1].body as string).options)
      .toEqual({ num_predict: 8192, temperature: 0.9 });

    process.env.OLLAMA_TEMPERATURE = "7";
    await generateContent("sys", "hi");
    expect(JSON.parse(fetchMock.mock.calls[2][1].body as string).options)
      .toEqual({ num_predict: 8192, temperature: 2 });
  });

  it("throws a descriptive error when Ollama returns a non-OK status", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => "rate limited",
    });

    await expect(generateContent("sys", "hi")).rejects.toThrow(
      /Ollama request failed \(429\)/
    );
  });

  it("throws when the response has no message content", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ model: "m", message: { content: "" } }),
    });

    await expect(generateContent("sys", "hi")).rejects.toThrow(
      "Ollama returned no content"
    );
  });
});
