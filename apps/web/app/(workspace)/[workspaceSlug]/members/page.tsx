"use client";

import { use, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Trash2 } from "lucide-react";
import {
  useWorkspaceMembers,
  useMyMembership,
  type WorkspaceMember,
} from "../../../../hooks/use-members";
import { usePresence } from "../../../../hooks/use-presence";
import { UserAvatar } from "../../../../components/ui/UserAvatar";


export default function MembersPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const router = useRouter();
  const { workspaceSlug } = use(params);

  const { members, isLoading, removeMember, leaveWorkspace } =
    useWorkspaceMembers(workspaceSlug);
  const { membership } = useMyMembership(workspaceSlug);
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  // Extract all member user IDs to track real-time presence
  const memberUserIds = useMemo(
    () => members.map((m) => m.userId),
    [members],
  );
  const { isOnline } = usePresence(memberUserIds);


  const getRoleColor = (role: string) => {
    if (role === "OWNER") return "text-purple-400";
    if (role === "ADMIN") return "text-blue-400";
    if (role === "MEMBER") return "text-slate-400";
    return "text-slate-400";
  };

  const formatJoinedDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const diffMs = Date.now() - date.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffDays === 0) return "Joined today";
      if (diffDays === 1) return "Joined yesterday";
      if (diffDays < 30) return `Joined ${diffDays} days ago`;
      if (diffDays < 365)
        return `Joined ${Math.floor(diffDays / 30)} months ago`;
      return `Joined ${Math.floor(diffDays / 365)} years ago`;
    } catch {
      return "Joined recently";
    }
  };

  const handleRemoveMember = async (member: WorkspaceMember) => {
    const confirmed = window.confirm(
      `Remove ${member.name} from this workspace?`,
    );
    if (!confirmed) return;

    setPendingAction(member.id);
    try {
      await removeMember(member.id);
    } catch (err: any) {
      alert(
        err.response?.data?.error || err.message || "Failed to remove member.",
      );
    } finally {
      setPendingAction(null);
    }
  };

  const handleLeaveWorkspace = async () => {
    if (!membership || membership.role === "OWNER") return;

    const confirmed = window.confirm("Leave this workspace?");
    if (!confirmed) return;

    setPendingAction("leave");
    try {
      await leaveWorkspace();
      router.push("/workspaces");
    } catch (err: any) {
      alert(
        err.response?.data?.error ||
          err.message ||
          "Failed to leave workspace.",
      );
    } finally {
      setPendingAction(null);
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 max-w-7xl text-slate-400">Loading members...</div>
    );
  }

  const isOnlyMember = members.length === 1;

  return (
    <div className="p-8 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-100 mb-2">Members</h1>
          <p className="text-slate-400">
            {members.length} total members in your workspace
          </p>
        </div>
        {membership && membership.role !== "OWNER" && (
          <button
            type="button"
            onClick={handleLeaveWorkspace}
            disabled={pendingAction === "leave"}
            className="inline-flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-300 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <LogOut className="h-4 w-4" />
            {pendingAction === "leave" ? "Leaving..." : "Leave workspace"}
          </button>
        )}
      </div>

      {/* Empty State / Only Member */}
      {isOnlyMember && (
        <div className="mb-6 bg-blue-900/20 border border-blue-500/20 p-4 rounded-lg text-blue-200">
          <p>Only you are in this workspace.</p>
          <p className="text-sm opacity-80 mt-1">
            Invite teammates using your workspace invite code.
          </p>
        </div>
      )}

      {/* Members List */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-700 bg-slate-900/50">
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Member
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Role
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Joined
              </th>
              <th className="px-6 py-3 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr
                key={member.id}
                className="border-b border-slate-700 hover:bg-slate-700/30 transition-all duration-200 last:border-0"
              >
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <UserAvatar
                      name={member.name}
                      image={member.image}
                      isOnline={isOnline(member.userId)}
                      size="md"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-100 flex items-center gap-2">
                        {member.name}
                        {membership?.userId === member.userId && (
                          <span className="text-xs bg-slate-700 px-2 py-0.5 rounded text-slate-300">
                            You
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-slate-500">{member.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">

                  <span
                    className={`text-sm font-medium ${getRoleColor(member.role)}`}
                  >
                    {member.role === "OWNER" ? "Owner" : "Member"}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className="text-sm text-slate-400">
                    {formatJoinedDate(member.joinedAt)}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  {membership?.role === "OWNER" &&
                  membership.userId !== member.userId ? (
                    <button
                      type="button"
                      onClick={() => handleRemoveMember(member)}
                      disabled={
                        pendingAction === member.id || pendingAction === "leave"
                      }
                      className="inline-flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm font-medium text-red-300 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Trash2 className="h-4 w-4" />
                      {pendingAction === member.id ? "Removing..." : "Remove"}
                    </button>
                  ) : membership?.userId === member.userId &&
                    membership?.role !== "OWNER" ? (
                    <button
                      type="button"
                      onClick={handleLeaveWorkspace}
                      disabled={
                        pendingAction === "leave" || pendingAction === member.id
                      }
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-600 bg-slate-700/80 px-3 py-2 text-sm font-medium text-slate-200 transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <LogOut className="h-4 w-4" />
                      {pendingAction === "leave" ? "Leaving..." : "Leave"}
                    </button>
                  ) : (
                    <span className="text-sm text-slate-500">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
