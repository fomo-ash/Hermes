"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../hooks/use-auth";
import { useWorkspaces } from "../../hooks/use-workspaces";
import { Loader2 } from "lucide-react";


export default function DashboardRedirectPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const { workspaces, isLoading: workspacesLoading } = useWorkspaces();

  useEffect(() => {
    if (!authLoading && !workspacesLoading) {
      if (user) {
        if (!user.onboarded) {
          router.push("/onboarding");
        } else if (workspaces.length > 0 && workspaces[0]) {
          // Redirect to the first workspace's dashboard
          router.push(`/${workspaces[0].slug}/dashboard`);
        } else {
          // Onboarded but no workspaces, send to workspace selection/creation hub
          router.push("/workspaces");
        }
      }
    }
  }, [user, authLoading, workspaces, workspacesLoading, router]);



  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#090d16] text-slate-400 font-sans">
      <div className="flex items-center gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
        <span className="text-sm font-semibold tracking-wider uppercase text-slate-300 animate-pulse">
          Entering Hermes...
        </span>
      </div>
    </div>
  );
}
