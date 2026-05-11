import { Router, type IRouter } from "express";
import { eq, desc, and } from "drizzle-orm";
import { db, conversations, messages } from "@workspace/db";
import { openai } from "@workspace/integrations-openai-ai-server";
import { generateImageBuffer } from "@workspace/integrations-openai-ai-server/image";
import { YoutubeTranscript } from "youtube-transcript";
import {
  CreateOpenaiConversationBody,
  GetOpenaiConversationParams,
  DeleteOpenaiConversationParams,
  ListOpenaiMessagesParams,
  SendOpenaiMessageParams,
  SendOpenaiMessageBody,
} from "@workspace/api-zod";
import { optionalAuth, type AuthedRequest } from "../../middlewares/requireAuth";

const router: IRouter = Router();

type ChatCompletionTool = Parameters<typeof openai.chat.completions.create>[0]["tools"] extends (infer T)[] | undefined ? NonNullable<T> : never;
type ChatCompletionMessageParam = Parameters<typeof openai.chat.completions.create>[0]["messages"][number];

const SYSTEM_PROMPT = `You are NovaMind AI, a powerful multi-modal AI assistant and creative studio. You can:
- Chat and answer ANY question intelligently
- Generate images from descriptions
- Write, debug, and explain code in any language
- Compose original song lyrics
- Fetch real YouTube video transcripts
- Humanize AI-generated text
- Get current weather for any location

Use your tools whenever the user's request matches one of them — don't just describe what you could do, DO it.
Be helpful, concise, and natural. Use markdown for formatting when it helps readability.`;

const TOOLS: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "generate_image",
      description: "Generate an AI image. Use when user wants to create, draw, generate, visualize, or make any image, picture, illustration, or artwork.",
      parameters: {
        type: "object",
        properties: {
          prompt: { type: "string", description: "Detailed image description" },
          style: { type: "string", enum: ["realistic", "anime", "logo", "artistic"] },
          size: { type: "string", enum: ["1024x1024"], description: "Image dimensions" },
        },
        required: ["prompt", "style", "size"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "generate_code",
      description: "Write, debug, or explain code. Use when user wants code written, a bug fixed, or code explained.",
      parameters: {
        type: "object",
        properties: {
          prompt: { type: "string" },
          language: { type: "string", description: "Programming language" },
          mode: { type: "string", enum: ["generate", "debug", "explain"] },
          code: { type: "string", description: "Existing code to debug or explain (optional)" },
        },
        required: ["prompt", "language", "mode"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "generate_song",
      description: "Write original song lyrics. Use when user asks to write a song, compose lyrics, or create music.",
      parameters: {
        type: "object",
        properties: {
          mood: { type: "string" },
          genre: { type: "string" },
          language: { type: "string" },
          theme: { type: "string" },
        },
        required: ["mood", "genre", "language"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_youtube_transcript",
      description: "Extract and summarize a YouTube video transcript. Use when user shares a YouTube URL or asks about a video.",
      parameters: {
        type: "object",
        properties: {
          url: { type: "string", description: "Full YouTube URL" },
          summarize: { type: "boolean" },
        },
        required: ["url", "summarize"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "humanize_text",
      description: "Rewrite AI-generated text to sound natural and human. Use when user wants to humanize, rewrite, or de-AI text.",
      parameters: {
        type: "object",
        properties: {
          text: { type: "string" },
        },
        required: ["text"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_weather",
      description: "Get real-time current weather for any city or location. Use whenever user asks about weather, temperature, or climate.",
      parameters: {
        type: "object",
        properties: {
          location: { type: "string", description: "City or location name (e.g. 'London', 'New York', 'Tokyo, Japan')" },
        },
        required: ["location"],
      },
    },
  },
];

function formatSeconds(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const WX_CODES: Record<number, string> = {
  0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
  45: "Foggy", 48: "Icy fog", 51: "Light drizzle", 53: "Drizzle", 55: "Heavy drizzle",
  61: "Light rain", 63: "Moderate rain", 65: "Heavy rain",
  71: "Light snow", 73: "Moderate snow", 75: "Heavy snow",
  80: "Light showers", 81: "Showers", 82: "Heavy showers",
  95: "Thunderstorm", 99: "Thunderstorm with hail",
};

async function executeToolCall(toolName: string, args: Record<string, any>): Promise<any> {
  switch (toolName) {
    case "generate_image": {
      const styleMap: Record<string, string> = {
        realistic: `${args.prompt}, photorealistic, highly detailed, 8K quality`,
        anime: `${args.prompt}, anime style, vibrant colors, Studio Ghibli quality`,
        logo: `${args.prompt}, professional logo design, clean, minimalist, vector`,
        artistic: `${args.prompt}, digital painting, concept art, expressive style`,
      };
      const styledPrompt = styleMap[args.style as string] ?? args.prompt;
      const buffer = await generateImageBuffer(styledPrompt, "1024x1024");
      return { b64_json: buffer.toString("base64"), prompt: args.prompt, style: args.style ?? "realistic" };
    }

    case "generate_code": {
      const systemMap: Record<string, string> = {
        generate: `Expert ${args.language} developer. Write clean, efficient, well-commented code.`,
        debug: `Expert ${args.language} debugger. Find and fix bugs, explain what was wrong.`,
        explain: `${args.language} educator. Explain code step by step for a learner.`,
      };
      const contentMap: Record<string, string> = {
        generate: `Write ${args.language} code for: ${args.prompt}`,
        debug: `Debug this ${args.language} code:\n\n${args.code ?? ""}\n\nProblem: ${args.prompt}`,
        explain: `Explain this ${args.language} code:\n\n${args.code ?? ""}`,
      };
      const resp = await openai.chat.completions.create({
        model: "gpt-5.3-codex",
        max_completion_tokens: 4096,
        messages: [
          { role: "system", content: systemMap[args.mode as string] ?? systemMap.generate },
          { role: "user", content: contentMap[args.mode as string] ?? contentMap.generate },
        ],
      });
      return { result: resp.choices[0]?.message?.content ?? "", language: args.language, mode: args.mode };
    }

    case "generate_song": {
      const resp = await openai.chat.completions.create({
        model: "gpt-5.4",
        max_completion_tokens: 2048,
        messages: [
          {
            role: "system",
            content: `Professional songwriter. Write authentic, emotionally resonant lyrics in ${args.language}. Use labeled song sections.`,
          },
          {
            role: "user",
            content: `Write a ${args.mood} ${args.genre} song${args.theme ? ` about: ${args.theme}` : ""}. Start with "TITLE: " then the title on its own line. Use sections: [Verse 1], [Chorus], [Bridge], etc.`,
          },
        ],
      });
      const content = resp.choices[0]?.message?.content ?? "";
      let title = `${args.mood} ${args.genre} Song`;
      let lyrics = content;
      if (content.startsWith("TITLE:")) {
        const lines = content.split("\n");
        title = lines[0]?.replace("TITLE:", "").trim() ?? title;
        lyrics = lines.slice(1).join("\n").trim();
      }
      return { lyrics, title, mood: args.mood, genre: args.genre };
    }

    case "get_youtube_transcript": {
      const match =
        args.url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/) ??
        args.url.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
      const videoId = match?.[1];
      if (!videoId) return { error: "Invalid YouTube URL" };

      let transcript = "";
      let usedReal = false;

      // Try real transcript first
      try {
        const items = await YoutubeTranscript.fetchTranscript(videoId);
        transcript = items.map((item: any) => `[${formatSeconds(item.offset / 1000)}] ${item.text}`).join("\n");
        usedReal = true;
      } catch {
        // Fallback: GPT-simulated transcript
        const fallbackResp = await openai.chat.completions.create({
          model: "gpt-5.4",
          max_completion_tokens: 2048,
          messages: [
            {
              role: "user",
              content: `Generate a realistic detailed transcript for YouTube video ${videoId} (${args.url}). Use [0:00] timestamps. Make it 400+ words.${args.summarize ? '\nEnd with "SUMMARY:" and a 3-5 sentence summary.' : ""}`,
            },
          ],
        });
        transcript = fallbackResp.choices[0]?.message?.content ?? "";
      }

      let summary: string | null = null;
      if (args.summarize) {
        if (!usedReal && transcript.includes("SUMMARY:")) {
          const parts = transcript.split("SUMMARY:");
          transcript = parts[0]?.trim() ?? transcript;
          summary = parts[1]?.trim() ?? null;
        } else if (usedReal) {
          const summResp = await openai.chat.completions.create({
            model: "gpt-5.4",
            max_completion_tokens: 512,
            messages: [
              { role: "system", content: "Summarize this transcript in 4-5 clear sentences." },
              { role: "user", content: transcript.slice(0, 8000) },
            ],
          });
          summary = summResp.choices[0]?.message?.content ?? null;
        }
      }

      return { transcript, summary, videoId, url: args.url, realTranscript: usedReal };
    }

    case "humanize_text": {
      const resp = await openai.chat.completions.create({
        model: "gpt-5.4",
        max_completion_tokens: 4096,
        messages: [
          {
            role: "system",
            content: "Rewrite AI-generated text to sound 100% human. Keep meaning but use natural, varied, authentic language. Output ONLY the rewritten text.",
          },
          { role: "user", content: args.text },
        ],
      });
      return { humanized: resp.choices[0]?.message?.content ?? "", original: args.text };
    }

    case "get_weather": {
      // Geocode via Nominatim (free, no key)
      const geoResp = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(args.location)}&format=json&limit=1`,
        { headers: { "User-Agent": "NovaMind-AI/1.0 (contact@novamind.ai)" } }
      );
      const geoData = await geoResp.json() as any[];
      if (!geoData.length) return { error: `Could not find location: ${args.location}` };
      const { lat, lon, display_name } = geoData[0];

      // Weather via Open-Meteo (free, no key)
      const wxResp = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
        `&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m` +
        `&wind_speed_unit=mph&temperature_unit=celsius&timezone=auto`
      );
      const wxData = await wxResp.json() as any;
      const c = wxData.current;

      return {
        location: display_name,
        temperature: Math.round(c.temperature_2m),
        feelsLike: Math.round(c.apparent_temperature),
        humidity: c.relative_humidity_2m,
        windSpeed: Math.round(c.wind_speed_10m),
        description: WX_CODES[c.weather_code as number] ?? "Unknown",
        precipitation: c.precipitation,
        unit: "°C",
      };
    }

    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}

function summarizeToolResult(toolName: string, result: any): string {
  switch (toolName) {
    case "generate_image": return `Generated a ${result.style} image for: "${result.prompt}". Image displayed to user.`;
    case "generate_code": return `Generated ${result.language} code (${result.mode}):\n${String(result.result).slice(0, 300)}`;
    case "generate_song": return `Wrote "${result.title}" — a ${result.mood} ${result.genre} song.`;
    case "get_youtube_transcript": return `Got transcript for video ${result.videoId}. ${result.summary ?? String(result.transcript).slice(0, 200)}`;
    case "humanize_text": return `Humanized: ${String(result.humanized).slice(0, 300)}`;
    case "get_weather": return `Weather for ${result.location}: ${result.temperature}${result.unit}, ${result.description}.`;
    default: return JSON.stringify(result).slice(0, 300);
  }
}

// ─── Routes ───────────────────────────────────────────────────────────────────

router.get("/openai/conversations", optionalAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId;
  const convos = await db.select().from(conversations)
    .where(eq(conversations.userId, userId))
    .orderBy(desc(conversations.updatedAt));
  res.json(convos);
});

router.post("/openai/conversations", optionalAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId;
  const parsed = CreateOpenaiConversationBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [conv] = await db.insert(conversations).values({ title: parsed.data.title, userId }).returning();
  res.status(201).json(conv);
});

router.get("/openai/conversations/:id", optionalAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId;
  const params = GetOpenaiConversationParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [conv] = await db.select().from(conversations)
    .where(and(eq(conversations.id, params.data.id), eq(conversations.userId, userId)));
  if (!conv) { res.status(404).json({ error: "Not found" }); return; }
  const msgs = await db.select().from(messages).where(eq(messages.conversationId, params.data.id)).orderBy(messages.createdAt);
  res.json({ ...conv, messages: msgs });
});

router.delete("/openai/conversations/:id", optionalAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId;
  const params = DeleteOpenaiConversationParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [deleted] = await db.delete(conversations)
    .where(and(eq(conversations.id, params.data.id), eq(conversations.userId, userId)))
    .returning();
  if (!deleted) { res.status(404).json({ error: "Not found" }); return; }
  res.sendStatus(204);
});

router.get("/openai/conversations/:id/messages", optionalAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId;
  const params = ListOpenaiMessagesParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [conv] = await db.select().from(conversations)
    .where(and(eq(conversations.id, params.data.id), eq(conversations.userId, userId)));
  if (!conv) { res.status(404).json({ error: "Not found" }); return; }
  const msgs = await db.select().from(messages).where(eq(messages.conversationId, params.data.id)).orderBy(messages.createdAt);
  res.json(msgs);
});

router.post("/openai/conversations/:id/messages", optionalAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId;
  const params = SendOpenaiMessageParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const body = SendOpenaiMessageBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

  const [conv] = await db.select().from(conversations)
    .where(and(eq(conversations.id, params.data.id), eq(conversations.userId, userId)));
  if (!conv) { res.status(404).json({ error: "Not found" }); return; }

  await db.insert(messages).values({ conversationId: params.data.id, role: "user", content: body.data.content });

  const history = await db.select().from(messages)
    .where(eq(messages.conversationId, params.data.id))
    .orderBy(messages.createdAt);

  const chatMessages: ChatCompletionMessageParam[] = history.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  let fullAssistantContent = "";

  try {
    const stream = await openai.chat.completions.create({
      model: "gpt-5.4",
      max_completion_tokens: 8192,
      messages: [{ role: "system", content: SYSTEM_PROMPT }, ...chatMessages],
      tools: TOOLS,
      tool_choice: "auto",
      stream: true,
    } as any);

    let toolCallId = "";
    let toolCallName = "";
    let toolCallArgs = "";
    let isToolCall = false;

    for await (const chunk of stream as any) {
      const delta = chunk.choices?.[0]?.delta as any;
      const finishReason = chunk.choices?.[0]?.finish_reason;

      if (delta?.tool_calls?.length) {
        isToolCall = true;
        const tc = delta.tool_calls[0];
        if (tc?.id) toolCallId = tc.id;
        if (tc?.function?.name) toolCallName += tc.function.name;
        if (tc?.function?.arguments) toolCallArgs += tc.function.arguments;
      }

      if (delta?.content) {
        fullAssistantContent += delta.content;
        res.write(`data: ${JSON.stringify({ content: delta.content })}\n\n`);
      }

      if (finishReason === "tool_calls" && isToolCall) {
        res.write(`data: ${JSON.stringify({ type: "tool_call", tool: toolCallName })}\n\n`);

        let parsedArgs: Record<string, any> = {};
        try { parsedArgs = JSON.parse(toolCallArgs); } catch { parsedArgs = {}; }

        const toolResult = await executeToolCall(toolCallName, parsedArgs);
        res.write(`data: ${JSON.stringify({ type: "tool_result", tool: toolCallName, data: toolResult })}\n\n`);

        const followUp = await openai.chat.completions.create({
          model: "gpt-5.4",
          max_completion_tokens: 512,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            ...chatMessages,
            {
              role: "assistant",
              tool_calls: [{ id: toolCallId, type: "function", function: { name: toolCallName, arguments: toolCallArgs } }],
            } as ChatCompletionMessageParam,
            { role: "tool", tool_call_id: toolCallId, content: summarizeToolResult(toolCallName, toolResult) } as ChatCompletionMessageParam,
          ],
          stream: true,
        } as any);

        let followUpText = "";
        for await (const fc of followUp as any) {
          const content = fc.choices?.[0]?.delta?.content;
          if (content) { followUpText += content; res.write(`data: ${JSON.stringify({ content })}\n\n`); }
        }
        fullAssistantContent = `[${toolCallName}] ${followUpText}`;
      }
    }
  } catch (err: any) {
    const errMsg = `\n\n_Error: ${err.message}_`;
    res.write(`data: ${JSON.stringify({ content: errMsg })}\n\n`);
    fullAssistantContent += errMsg;
  }

  await db.insert(messages).values({
    conversationId: params.data.id,
    role: "assistant",
    content: fullAssistantContent || "I'm having trouble processing that right now.",
  });
  await db.update(conversations).set({ updatedAt: new Date() }).where(eq(conversations.id, params.data.id));

  res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  res.end();
});

export default router;
