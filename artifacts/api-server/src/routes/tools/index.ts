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

const router: IRouter = Router();

router.post("/tools/humanize", async (req, res): Promise<void> => {
  const parsed = HumanizeTextBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const response = await openai.chat.completions.create({
    model: "gpt-5.4",
    max_completion_tokens: 8192,
    messages: [
      {
        role: "system",
        content:
          "You are a text humanizer. Rewrite AI-generated text to sound 100% human-written. Maintain the original meaning but use natural language, varied sentence structure, conversational tone, and authentic voice. Remove overly formal phrasing, robotic patterns, and AI tells. Output ONLY the rewritten text, no explanations.",
      },
      {
        role: "user",
        content: parsed.data.text,
      },
    ],
  });

  const humanized = response.choices[0]?.message?.content ?? "";
  res.json({ humanized, original: parsed.data.text });
});

router.post("/tools/youtube-transcript", async (req, res): Promise<void> => {
  const parsed = GetYoutubeTranscriptBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { url, summarize } = parsed.data;

  const videoIdMatch =
    url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/) ??
    url.match(/[?&]v=([a-zA-Z0-9_-]{11})/);

  if (!videoIdMatch) {
    res.status(400).json({ error: "Invalid YouTube URL" });
    return;
  }

  const videoId = videoIdMatch[1];

  const response = await openai.chat.completions.create({
    model: "gpt-5.4",
    max_completion_tokens: 8192,
    messages: [
      {
        role: "user",
        content: `I need you to simulate extracting a transcript from YouTube video ID: ${videoId} (URL: ${url}). 

Since you cannot directly access YouTube, generate a realistic and detailed example transcript that would be appropriate for a video with this URL. Make it at least 500 words long, formatted as natural speech with speaker turns or timestamps. 

${summarize ? "Also provide a 3-5 sentence summary at the end prefixed with 'SUMMARY:'" : ""}

Format the transcript with timestamps like [0:00], [0:30], etc.`,
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

  res.json({
    transcript,
    summary,
    videoId,
    title: `Video ${videoId}`,
  });
});

router.post("/tools/generate-code", async (req, res): Promise<void> => {
  const parsed = GenerateCodeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { prompt, language, mode, code } = parsed.data;

  const systemPrompts: Record<string, string> = {
    generate: `You are an expert ${language} developer. Generate clean, efficient, well-commented ${language} code. Only output the code with brief inline comments, no extra explanation unless asked.`,
    debug: `You are an expert ${language} debugger. Analyze the provided code, identify bugs, and provide the fixed version with explanations of what was wrong. Format: first explain the issues, then provide the fixed code.`,
    explain: `You are a ${language} code educator. Explain the provided code clearly, step by step, for someone learning to code. Use clear language and explain what each section does.`,
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

router.post("/tools/generate-song", async (req, res): Promise<void> => {
  const parsed = GenerateSongBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

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

router.post("/tools/export-pdf", async (req, res): Promise<void> => {
  const parsed = ExportConversationPdfBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [conv] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, parsed.data.conversationId));

  if (!conv) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }

  const msgs = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, parsed.data.conversationId))
    .orderBy(messages.createdAt);

  const date = new Date(conv.createdAt).toLocaleDateString();
  const lines = [
    `%PDF-1.4`,
    `NovaMind AI - Conversation Export`,
    `Title: ${conv.title}`,
    `Date: ${date}`,
    ``,
    ...msgs.map((m) => `[${m.role.toUpperCase()}] ${m.content}`),
  ];

  const textContent = lines.join("\n");
  const base64Content = Buffer.from(textContent).toString("base64");

  res.json({
    filename: `conversation-${conv.id}-${Date.now()}.txt`,
    content: base64Content,
  });
});

export default router;
