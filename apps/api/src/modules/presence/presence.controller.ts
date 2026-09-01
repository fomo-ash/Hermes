import { Request, Response } from "express";
import { successResponse } from "../../common/responses/api-response";
import { PresenceRepository } from "./presence.repository";
import { PresenceService } from "./presence.service";

const repository = new PresenceRepository();
const service = new PresenceService(repository);

export const getPresenceSnapshot = async (req: Request, res: Response) => {
  const { userIds } = req.body;
  const presenceMap = await service.getPresence(userIds);

  return res.status(200).json(successResponse(presenceMap));
};
