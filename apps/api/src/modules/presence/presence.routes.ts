import { Router } from "express";
import { asyncHandler } from "../../common/utils/async-handler";
import { validate } from "../../middleware/validate.middleware";
import * as presenceController from "./presence.controller";
import {
  getPresenceQuerySchema,
  getPresenceBatchSchema,
  getUserPresenceSchema,
} from "./presence.schema";

const router = Router();

// GET /api/v1/presence?userIds=id1,id2
router.get(
  "/",
  validate(getPresenceQuerySchema),
  asyncHandler(presenceController.getPresenceSnapshot),
);

// POST /api/v1/presence/batch (for larger lists)
router.post(
  "/batch",
  validate(getPresenceBatchSchema),
  asyncHandler(presenceController.getPresenceSnapshot),
);

// GET /api/v1/presence/:userId (single user check)
router.get(
  "/:userId",
  validate(getUserPresenceSchema),
  asyncHandler(presenceController.getUserPresence),
);

export default router;
