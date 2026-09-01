import { Router } from "express";
import { asyncHandler } from "../../common/utils/async-handler";
import { validate } from "../../middleware/validate.middleware";
import * as presenceController from "./presence.controller";
import { getPresenceSchema } from "./presence.schema";

const router = Router();

// POST /api/v1/presence
router.post(
  "/",
  validate(getPresenceSchema),
  asyncHandler(presenceController.getPresenceSnapshot),
);

export default router;
