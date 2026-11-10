/**
 * Generates a deterministic canonical unique key for 1:1 Direct Messages.
 * Format: "${workspaceId}:${smallerUserId}:${greaterUserId}"
 *
 * Sorting user IDs alphabetically guarantees that whether userA initiates with userB,
 * or userB with userA, both produce the identical canonical key.
 */
export function getCanonicalDmKey(
  workspaceId: string,
  userAId: string,
  userBId: string,
): string {
  const [smallerId, greaterId] = [userAId, userBId].sort();
  return `${workspaceId}:${smallerId}:${greaterId}`;
}

