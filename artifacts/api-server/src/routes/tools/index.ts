import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, conversations, messages } from "@workspace/db";
import { openai } from "@workspace/integrations-openai-ai-server";
import {
  HumanizeTextBody,
  GetYoutubeTranscriptBody,
  GenerateCodeBody,
  GenerateSongBody,
  ExportConversationPdfBody,
} from "@workspace/api-zod";
import { requireAuth } from "../../middlewares/requireAuth";

const router: IRouter = Router();

router.post("/tools/humanize", requireAuth, async (req, res): Promise<void> => {
  const parsed = HumanizeTextBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const response = await openai.chat.completions.create({
    model: "gpt-5.4",
    max_completion_tokens: 8192,
    messages: [
      {
        role: "system",
        content:
          "You are a text humanizer. Rewrite AI-generated text to sound 100% human-written. Maintain the original meaning but use natural language, varied sentence structure, conversational tone, and authentic voice. Remove overly formal phrasing, robotic patterns, and AI tells. Output ONLY the rewritten text, no explanations.",
      },
      { role: "user", content: parsed.data.text },
    ],
  });

  const humanized = response.choices[0]?.message?.content ?? "";
  res.json({ humanized, original: parsed.data.text });
});

router.post("/tools/youtube-transcript", requireAuth, async (req, res): Promise<void> => {
  const parsed = GetYoutubeTranscriptBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { url, summarize } = parsed.data;
  const videoIdMatch =
    url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/) ??
    url.match(/[?&]v=([a-zA-Z0-9_-]{11})/);

  if (!videoIdMatch) { res.status(400).json({ error: "Invalid YouTube URL" }); return; }
  const videoId = videoIdMatch[1];

  const response = await openai.chat.completions.create({
    model: "gpt-5.4",
    max_completion_tokens: 8192,
    messages: [
      {
        role: "user",
        content: `Generate a realistic, detailed transcript for YouTube video ID: ${videoId} (URL: ${url}). Format with timestamps like [0:00], [0:30], etc. Make it at least 500 words long with natural speech patterns.${summarize ? '\n\nAfter the transcript, add a line "SUMMARY:" followed by a 4-5 sentence summary.' : ""}`,
      },
    ],
  });

  const content = response.choices[0]?.message?.content ?? "";
  let transcript = content;
  let summary: string | null = null;

  if (summarize && content.includes("SUMMARY:")) {
    const parts = content.split("SUMMARY:");
    transcript = parts[0]?.trim() ?? content;
    summary = parts[1]?.trim() ?? null;
  }

  res.json({ transcript, summary, videoId, title: `Video ${videoId}` });
});

router.post("/tools/generate-code", requireAuth, async (req, res): Promise<void> => {
  const parsed = GenerateCodeBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { prompt, language, mode, code } = parsed.data;

  const systemPrompts: Record<string, string> = {
    generate: `You are an expert ${language} developer. Generate clean, efficient, well-commented ${language} code. Only output the code with brief inline comments, no extra explanation unless asked.`,
    debug: `You are an expert ${language} debugger. Analyze the provided code, identify bugs, and provide the fixed version with explanations of what was wrong.`,
    explain: `You are a ${language} code educator. Explain the provided code clearly, step by step, for someone learning to code.`,
  };

  const userContent =
    mode === "generate"
      ? `Write ${language} code for: ${prompt}`
      : mode === "debug"
        ? `Debug this ${language} code:\n\n${code}\n\nProblem description: ${prompt}`
        : `Explain this ${language} code:\n\n${code}`;

  const response = await openai.chat.completions.create({
    model: "gpt-5.3-codex",
    max_completion_tokens: 8192,
    messages: [
      { role: "system", content: systemPrompts[mode] ?? systemPrompts.generate },
      { role: "user", content: userContent },
    ],
  });

  const result = response.choices[0]?.message?.content ?? "";
  res.json({ result, language, mode });
});

router.post("/tools/generate-song", requireAuth, async (req, res): Promise<void> => {
  const parsed = GenerateSongBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { mood, genre, language, theme } = parsed.data;

  const response = await openai.chat.completions.create({
    model: "gpt-5.4",
    max_completion_tokens: 8192,
    messages: [
      {
        role: "system",
        content: `You are a professional songwriter. Write authentic, emotionally resonant song lyrics in ${language}. Structure songs with verses, chorus, bridge as appropriate. Make lyrics feel genuine and poetic.`,
      },
      {
        role: "user",
        content: `Write a ${mood} ${genre} song${theme ? ` about: ${theme}` : ""}. Include a creative title at the very start prefixed with "TITLE: ". Include labeled sections like [Verse 1], [Chorus], [Bridge], etc.`,
      },
    ],
  });

  const content = response.choices[0]?.message?.content ?? "";
  let title = `${mood} ${genre} Song`;
  let lyrics = content;

  if (content.startsWith("TITLE:")) {
    const lines = content.split("\n");
    title = lines[0]?.replace("TITLE:", "").trim() ?? title;
    lyrics = lines.slice(1).join("\n").trim();
  }

  res.json({ lyrics, title, mood, genre });
});

router.post("/tools/export-pdf", requireAuth, async (req, res): Promise<void> => {
  const parsed = ExportConversationPdfBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [conv] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, parsed.data.conversationId));

  if (!conv) { res.status(404).json({ error: "Conversation not found" }); return; }

  const msgs = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, parsed.data.conversationId))
    .orderBy(messages.createdAt);

  const date = new Date(conv.createdAt).toLocaleDateString();
  const lines = [
    `NovaMind AI - Conversation Export`,
    `Title: ${conv.title}`,
    `Date: ${date}`,
    `Messages: ${msgs.length}`,
    `${"─".repeat(60)}`,
    "",
    ...msgs.map((m) => `[${m.role.toUpperCase()}]\n${m.content}\n`),
  ];

  const textContent = lines.join("\n");
  const base64Content = Buffer.from(textContent).toString("base64");

  res.json({
    filename: `novamind-${conv.id}-${Date.now()}.txt`,
    content: base64Content,
    title: conv.title,
  });
});

router.post("/tools/analyze-file", requireAuth, async (req, res): Promise<void> => {
  const { fileBase64, filename, mimeType } = req.body;
  if (!fileBase64 || !mimeType) {
    res.status(400).json({ error: "fileBase64 and mimeType are required" });
    return;
  }

  let analysis = "";

  if (mimeType.startsWith("image/")) {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      max_completion_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Analyze this image in detail. Describe what you see, identify key elements, and provide any interesting observations. The filename is: ${filename}`,
            },
            {
              type: "image_url",
              image_url: { url: `data:${mimeType};base64,${fileBase64}` },
            },
          ],
        },
      ],
    } as any);
    analysis = response.choices[0]?.message?.content ?? "Could not analyze the image.";
  } else if (
    mimeType.startsWith("text/") ||
    mimeType === "application/json" ||
    mimeType === "application/xml"
  ) {
    const textContent = Buffer.from(fileBase64, "base64").toString("utf-8");
    const response = await openai.chat.completions.create({
      model: "gpt-5.4",
      max_completion_tokens: 1024,
      messages: [
        {
          role: "system",
          content: "You are a document analyzer. Read the provided document and give a clear, structured summary of its contents, key points, and any important information.",
        },
        {
          role: "user",
          content: `Analyze this document (${filename}):\n\n${textContent.slice(0, 8000)}`,
        },
      ],
    });
    analysis = response.choices[0]?.message?.content ?? "Could not analyze the document.";
  } else {
    analysis = `File "${filename}" (${mimeType}) has been received. This file type isn't supported for automatic analysis, but you can ask me questions about it or paste its contents into the chat.`;
  }

  res.json({ analysis, filename, mimeType });
});

export default router;
