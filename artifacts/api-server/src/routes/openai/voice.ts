import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, conversations, messages } from "@workspace/db";
import { voiceChatStream, ensureCompatibleFormat } from "@workspace/integrations-openai-ai-server/audio";
import {
  SendOpenaiVoiceMessageParams,
  SendOpenaiVoiceMessageBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.post("/openai/conversations/:id/voice-messages", async (req, res): Promise<void> => {
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
    .where(eq(conversations.id, params.data.id));
  if (!conv) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const audioBuffer = Buffer.from(body.data.audio, "base64");
  const { buffer, format } = await ensureCompatibleFormat(audioBuffer);
  const stream = await voiceChatStream(buffer, "alloy", format);

  let assistantTranscript = "";
  let userTranscript = "";

  for await (const event of stream) {
    if (event.type === "transcript") {
      assistantTranscript += event.data;
    }
    if (event.type === "user_transcript") {
      userTranscript += event.data;
    }
    res.write(`data: ${JSON.stringify(event)}\n\n`);
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
