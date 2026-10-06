import { Buffer } from "buffer";
import { handleGenerateTheme } from "./generate-theme.ts";
import { handleGenerateOpenAITheme } from "./generate-theme_openai.ts";
import { handleLyricProxy } from "./lyric-proxy.ts";
import { handleSegmentLyrics } from "./segment-lyrics.ts";

// Workers do not expose Buffer without nodejs_compat; keep the polyfill at module
// scope so it runs before the fetch handler.
(globalThis as typeof globalThis & { Buffer: typeof Buffer }).Buffer = Buffer;

type Env = {
  ASSETS: {
    fetch(request: Request): Promise<Response>;
  };
  AI_PROVIDER?: string;
  GEMINI_API_KEY?: string;
  OPENAI_API_KEY?: string;
  OPENAI_API_URL?: string;
  OPENAI_API_MODEL?: string;
  OPENAI_API_TEMPERATURE?: string;
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/generate-theme") {
      return handleGenerateTheme(request, env);
    }

    if (url.pathname === "/api/generate-theme_openai") {
      return handleGenerateOpenAITheme(request, env);
    }

    if (url.pathname === "/api/lyric-proxy") {
      return handleLyricProxy(request);
    }

    if (url.pathname === "/api/segment-lyrics") {
      return handleSegmentLyrics(request, env);
    }

    return env.ASSETS.fetch(request);
  },
};
