import { Router, type IRouter } from "express";
import healthRouter from "./health";
import conversationsRouter from "./openai/conversations";
import voiceRouter from "./openai/voice";
import imageRouter from "./openai/image";
import toolsRouter from "./tools/index";

const router: IRouter = Router();

router.use(healthRouter);
router.use(conversationsRouter);
router.use(voiceRouter);
router.use(imageRouter);
router.use(toolsRouter);

export default router;
