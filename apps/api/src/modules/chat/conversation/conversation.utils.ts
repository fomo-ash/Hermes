// Generates deterministic unique key for DMs: "wsId:minUserId:maxUserId"
export function getCanonicalDmKey(
  workspaceId: string,
  userAId: string,
  userBId: string,
): string {
  const [smallerId, greaterId] = [userAId, userBId].sort();
  return `${workspaceId}:${smallerId}:${greaterId}`;
}
