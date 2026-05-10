import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, conversations, messages } from "@workspace/db";
import {
  speechToText,
  voiceChatStream,
  ensureCompatibleFormat,
} from "@workspace/integrations-openai-ai-server/audio";
import {
  SendOpenaiVoiceMessageParams,
  SendOpenaiVoiceMessageBody,
} from "@workspace/api-zod";
import { requireAuth, type AuthedRequest } from "../../middlewares/requireAuth";

const router: IRouter = Router();

router.post("/openai/conversations/:id/voice-messages", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId;

  const params = SendOpenaiVoiceMessageParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const body = SendOpenaiVoiceMessageBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [conv] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, params.data.id), eq(conversations.userId, userId)));

  if (!conv) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const rawAudioBuffer = Buffer.from(body.data.audio, "base64");
  const { buffer: compatibleBuffer, format } = await ensureCompatibleFormat(rawAudioBuffer);

  let userTranscript = "";
  try {
    userTranscript = await speechToText(compatibleBuffer, format);
  } catch {
    userTranscript = "[Voice message]";
  }

  res.write(`data: ${JSON.stringify({ type: "user_transcript", data: userTranscript })}\n\n`);

  const stream = await voiceChatStream(compatibleBuffer, "alloy", format);

  let assistantTranscript = "";

  for await (const event of stream) {
    if (event.type === "transcript") {
      assistantTranscript += event.data;
      res.write(`data: ${JSON.stringify({ type: "transcript", data: event.data })}\n\n`);
    }
    if (event.type === "audio") {
      res.write(`data: ${JSON.stringify({ type: "audio", data: event.data })}\n\n`);
    }
  }

  await db.insert(messages).values([
    {
      conversationId: params.data.id,
      role: "user",
      content: userTranscript || "[Voice message]",
    },
    {
      conversationId: params.data.id,
      role: "assistant",
      content: assistantTranscript || "[Voice response]",
    },
  ]);

  await db
    .update(conversations)
    .set({ updatedAt: new Date() })
    .where(eq(conversations.id, params.data.id));

  res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  res.end();
});

export default router;
