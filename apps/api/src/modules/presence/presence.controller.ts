import { Request, Response } from "express";
import { successResponse } from "../../common/responses/api-response";
import { PresenceRepository } from "./presence.repository";
import { PresenceService } from "./presence.service";

const repository = new PresenceRepository();
const service = new PresenceService(repository);

// user Ids - bulk
function extractUserIds(req: Request): string[] {
  if (Array.isArray(req.body?.userIds)) {
    return req.body.userIds;
  }

  const queryUserIds = req.query.userIds;
  if (typeof queryUserIds === "string") {
    return queryUserIds
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);
  }

  if (Array.isArray(queryUserIds)) {
    return queryUserIds
      .map((id) => (typeof id === "string" ? id.trim() : ""))
      .filter(Boolean);
  }

  return [];
}


// intial snapshot
export const getPresenceSnapshot = async (req: Request, res: Response) => {
  const userIds = extractUserIds(req);
  const presenceMap = await service.getPresence(userIds);

  return res.status(200).json(successResponse(presenceMap));
};

export const getUserPresence = async (req: Request, res: Response) => {
  const userId = Array.isArray(req.params.userId)
    ? req.params.userId[0]
    : req.params.userId;

  const online = await service.isOnline(userId);

  return res.status(200).json(
    successResponse({
      userId,
      online,
    }),
  );
};
