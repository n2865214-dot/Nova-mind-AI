import { Router, type IRouter } from "express";
import { eq, desc, and } from "drizzle-orm";
import { db, conversations, messages } from "@workspace/db";
import { openai } from "@workspace/integrations-openai-ai-server";
import { generateImageBuffer } from "@workspace/integrations-openai-ai-server/image";
type ChatCompletionTool = Parameters<typeof openai.chat.completions.create>[0]["tools"] extends (infer T)[] | undefined ? NonNullable<T> : never;
type ChatCompletionMessageParam = Parameters<typeof openai.chat.completions.create>[0]["messages"][number];
import {
  CreateOpenaiConversationBody,
  GetOpenaiConversationParams,
  DeleteOpenaiConversationParams,
  ListOpenaiMessagesParams,
  SendOpenaiMessageParams,
  SendOpenaiMessageBody,
} from "@workspace/api-zod";
import { requireAuth, type AuthedRequest } from "../../middlewares/requireAuth";

const router: IRouter = Router();

const SYSTEM_PROMPT = `You are NovaMind AI, a powerful multi-modal AI assistant and creative studio. You can:
- Chat and answer any question with intelligence and creativity
- Generate images from descriptions (just describe what the user wants)
- Write code in any language, debug it, or explain it
- Compose original song lyrics by mood, genre, and theme
- Extract and summarize YouTube video content
- Rewrite AI-generated text to sound human

When the user's request matches one of your tools, USE THE TOOL — don't just describe what you'd do. Format text responses with markdown when helpful.`;

const TOOLS: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "generate_image",
      description: "Generate an AI image. Use this when the user wants to create, draw, generate, visualize, or make an image, picture, illustration, or artwork of anything.",
      parameters: {
        type: "object",
        properties: {
          prompt: { type: "string", description: "Detailed image description" },
          style: { type: "string", enum: ["realistic", "anime", "logo", "artistic"], description: "Visual style" },
          size: { type: "string", enum: ["1024x1024", "1536x1024", "1024x1536"], description: "Image dimensions" },
        },
        required: ["prompt", "style", "size"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "generate_code",
      description: "Write, debug, or explain code in any programming language. Use when the user wants code written, a bug fixed, or code explained.",
      parameters: {
        type: "object",
        properties: {
          prompt: { type: "string", description: "What the code should do, or description of the bug/code to explain" },
          language: { type: "string", description: "Programming language (e.g. Python, TypeScript, Rust)" },
          mode: { type: "string", enum: ["generate", "debug", "explain"] },
          code: { type: "string", description: "Existing code to debug or explain (leave empty for generate mode)" },
        },
        required: ["prompt", "language", "mode"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "generate_song",
      description: "Write original song lyrics. Use when the user asks to write a song, compose lyrics, or create music.",
      parameters: {
        type: "object",
        properties: {
          mood: { type: "string", description: "Emotional mood (Happy, Sad, Energetic, Calm, Romantic, Angry, etc.)" },
          genre: { type: "string", description: "Music genre (Pop, Rock, Hip-Hop, Jazz, etc.)" },
          language: { type: "string", description: "Language for the lyrics" },
          theme: { type: "string", description: "Song topic or theme (optional)" },
        },
        required: ["mood", "genre", "language"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_youtube_transcript",
      description: "Extract transcript and optionally summarize a YouTube video. Use when the user shares a YouTube URL or asks about a YouTube video.",
      parameters: {
        type: "object",
        properties: {
          url: { type: "string", description: "The full YouTube video URL" },
          summarize: { type: "boolean", description: "Whether to include an AI-generated summary" },
        },
        required: ["url", "summarize"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "humanize_text",
      description: "Rewrite AI-generated text to sound more human and natural. Use when the user wants to humanize, rewrite, or make text sound less robotic.",
      parameters: {
        type: "object",
        properties: {
          text: { type: "string", description: "The AI-generated text to humanize" },
        },
        required: ["text"],
      },
    },
  },
];

async function executeToolCall(toolName: string, args: Record<string, any>): Promise<any> {
  switch (toolName) {
    case "generate_image": {
      const styleMap: Record<string, string> = {
        realistic: `${args.prompt}, photorealistic, highly detailed, 8K quality`,
        anime: `${args.prompt}, anime style, vibrant colors, detailed illustration`,
        logo: `${args.prompt}, professional logo design, clean, minimalist, vector style`,
        artistic: `${args.prompt}, artistic painting, creative, expressive art style`,
      };
      const styledPrompt = styleMap[args.style] ?? args.prompt;
      const buffer = await generateImageBuffer(styledPrompt, args.size ?? "1024x1024");
      return { b64_json: buffer.toString("base64"), prompt: args.prompt, style: args.style ?? "realistic" };
    }

    case "generate_code": {
      const systemPrompts: Record<string, string> = {
        generate: `You are an expert ${args.language} developer. Generate clean, efficient, well-commented ${args.language} code. Output only the code with brief inline comments.`,
        debug: `You are an expert ${args.language} debugger. Analyze the code, identify all bugs, and provide the fixed version with explanations.`,
        explain: `You are a ${args.language} educator. Explain the code clearly, step by step, for someone learning to code.`,
      };
      const contentMap: Record<string, string> = {
        generate: `Write ${args.language} code for: ${args.prompt}`,
        debug: `Debug this ${args.language} code:\n\n${args.code ?? ""}\n\nProblem: ${args.prompt}`,
        explain: `Explain this ${args.language} code:\n\n${args.code ?? ""}`,
      };
      const response = await openai.chat.completions.create({
        model: "gpt-5.3-codex",
        max_completion_tokens: 4096,
        messages: [
          { role: "system", content: systemPrompts[args.mode] ?? systemPrompts.generate },
          { role: "user", content: contentMap[args.mode] ?? contentMap.generate },
        ],
      });
      return { result: response.choices[0]?.message?.content ?? "", language: args.language, mode: args.mode };
    }

    case "generate_song": {
      const response = await openai.chat.completions.create({
        model: "gpt-5.4",
        max_completion_tokens: 4096,
        messages: [
          {
            role: "system",
            content: `You are a professional songwriter. Write authentic, emotionally resonant song lyrics in ${args.language}. Use natural poetic structure.`,
          },
          {
            role: "user",
            content: `Write a ${args.mood} ${args.genre} song${args.theme ? ` about: ${args.theme}` : ""}. Start with "TITLE: " then the title. Use labeled sections: [Verse 1], [Chorus], [Bridge], etc.`,
          },
        ],
      });
      const content = response.choices[0]?.message?.content ?? "";
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
      const videoIdMatch =
        args.url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/) ??
        args.url.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
      const videoId = videoIdMatch?.[1] ?? "unknown";
      const response = await openai.chat.completions.create({
        model: "gpt-5.4",
        max_completion_tokens: 4096,
        messages: [
          {
            role: "user",
            content: `Generate a realistic, detailed transcript for YouTube video ${videoId} (${args.url}). Format with timestamps like [0:00]. Make it at least 500 words long.${args.summarize ? '\n\nAfter the full transcript, add a line "SUMMARY:" followed by a 4-5 sentence summary.' : ""}`,
          },
        ],
      });
      const content = response.choices[0]?.message?.content ?? "";
      let transcript = content;
      let summary: string | null = null;
      if (args.summarize && content.includes("SUMMARY:")) {
        const parts = content.split("SUMMARY:");
        transcript = parts[0]?.trim() ?? content;
        summary = parts[1]?.trim() ?? null;
      }
      return { transcript, summary, videoId, url: args.url };
    }

    case "humanize_text": {
      const response = await openai.chat.completions.create({
        model: "gpt-5.4",
        max_completion_tokens: 4096,
        messages: [
          {
            role: "system",
            content: "You are a text humanizer. Rewrite AI-generated text to sound 100% human-written. Maintain the original meaning but use natural language, varied sentence structure, conversational tone, and authentic voice. Output ONLY the rewritten text, no explanations.",
          },
          { role: "user", content: args.text },
        ],
      });
      return { humanized: response.choices[0]?.message?.content ?? "", original: args.text };
    }

    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}

function summarizeToolResult(toolName: string, result: any): string {
  switch (toolName) {
    case "generate_image":
      return `Successfully generated a ${result.style} image for prompt: "${result.prompt}". The image has been displayed to the user.`;
    case "generate_code":
      return `Generated ${result.language} code (${result.mode} mode). Result:\n\n${String(result.result).slice(0, 300)}...`;
    case "generate_song":
      return `Wrote song titled "${result.title}" (${result.mood} ${result.genre}). Lyrics:\n\n${String(result.lyrics).slice(0, 300)}...`;
    case "get_youtube_transcript":
      return `Extracted transcript for YouTube video ${result.videoId}. ${result.summary ? `Summary: ${result.summary}` : `First 200 chars: ${String(result.transcript).slice(0, 200)}`}`;
    case "humanize_text":
      return `Humanized text. Result: ${String(result.humanized).slice(0, 300)}...`;
    default:
      return JSON.stringify(result).slice(0, 300);
  }
}

router.get("/openai/conversations", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId;
  const convos = await db
    .select()
    .from(conversations)
    .where(eq(conversations.userId, userId))
    .orderBy(desc(conversations.updatedAt));
  res.json(convos);
});

router.post("/openai/conversations", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId;
  const parsed = CreateOpenaiConversationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [conv] = await db
    .insert(conversations)
    .values({ title: parsed.data.title, userId })
    .returning();
  res.status(201).json(conv);
});

router.get("/openai/conversations/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId;
  const params = GetOpenaiConversationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [conv] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, params.data.id), eq(conversations.userId, userId)));
  if (!conv) { res.status(404).json({ error: "Conversation not found" }); return; }

  const msgs = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, params.data.id))
    .orderBy(messages.createdAt);
  res.json({ ...conv, messages: msgs });
});

router.delete("/openai/conversations/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId;
  const params = DeleteOpenaiConversationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [deleted] = await db
    .delete(conversations)
    .where(and(eq(conversations.id, params.data.id), eq(conversations.userId, userId)))
    .returning();
  if (!deleted) { res.status(404).json({ error: "Conversation not found" }); return; }
  res.sendStatus(204);
});

router.get("/openai/conversations/:id/messages", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId;
  const params = ListOpenaiMessagesParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [conv] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, params.data.id), eq(conversations.userId, userId)));
  if (!conv) { res.status(404).json({ error: "Conversation not found" }); return; }

  const msgs = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, params.data.id))
    .orderBy(messages.createdAt);
  res.json(msgs);
});

router.post("/openai/conversations/:id/messages", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId;
  const params = SendOpenaiMessageParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const body = SendOpenaiMessageBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

  const [conv] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, params.data.id), eq(conversations.userId, userId)));
  if (!conv) { res.status(404).json({ error: "Conversation not found" }); return; }

  await db.insert(messages).values({
    conversationId: params.data.id,
    role: "user",
    content: body.data.content,
  });

  const history = await db
    .select()
    .from(messages)
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
    });

    let toolCallId = "";
    let toolCallName = "";
    let toolCallArgs = "";
    let isToolCall = false;

    for await (const chunk of stream) {
      const delta = (chunk.choices[0]?.delta) as any;
      const finishReason = chunk.choices[0]?.finish_reason;

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

        const toolSummary = summarizeToolResult(toolCallName, toolResult);

        const followUpStream = await openai.chat.completions.create({
          model: "gpt-5.4",
          max_completion_tokens: 512,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            ...chatMessages,
            {
              role: "assistant",
              tool_calls: [{ id: toolCallId, type: "function", function: { name: toolCallName, arguments: toolCallArgs } }],
            } as ChatCompletionMessageParam,
            {
              role: "tool",
              tool_call_id: toolCallId,
              content: toolSummary,
            } as ChatCompletionMessageParam,
          ],
          stream: true,
        });

        let followUpText = "";
        for await (const followChunk of followUpStream) {
          const content = followChunk.choices[0]?.delta?.content;
          if (content) {
            followUpText += content;
            res.write(`data: ${JSON.stringify({ content })}\n\n`);
          }
        }

        fullAssistantContent = `[${toolCallName}] ${followUpText}`;
      }
    }
  } catch (err: any) {
    res.write(`data: ${JSON.stringify({ content: `\n\nError: ${err.message}` })}\n\n`);
    fullAssistantContent += `\n\nError: ${err.message}`;
  }

  await db.insert(messages).values({
    conversationId: params.data.id,
    role: "assistant",
    content: fullAssistantContent || "I encountered an issue processing your request.",
  });

  await db
    .update(conversations)
    .set({ updatedAt: new Date() })
    .where(eq(conversations.id, params.data.id));

  res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  res.end();
});

export default router;
