import { Router, type IRouter } from "express";
import { generateImageBuffer } from "@workspace/integrations-openai-ai-server/image";
import { GenerateOpenaiImageBody } from "@workspace/api-zod";

const router: IRouter = Router();

router.post("/openai/generate-image", async (req, res): Promise<void> => {
  const parsed = GenerateOpenaiImageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { prompt, style, size } = parsed.data;

  const stylePrompt = style
    ? {
        realistic: `${prompt}, photorealistic, highly detailed, 8K quality`,
        anime: `${prompt}, anime style, vibrant colors, detailed illustration`,
        logo: `${prompt}, professional logo design, clean, minimalist, vector style`,
        artistic: `${prompt}, artistic painting, creative, expressive art style`,
      }[style] ?? prompt
    : prompt;

  const imageSize = (size as "1024x1024" | "1536x1024" | "1024x1536") ?? "1024x1024";

  const buffer = await generateImageBuffer(stylePrompt, imageSize);
  res.json({ b64_json: buffer.toString("base64"), prompt });
});

export default router;
