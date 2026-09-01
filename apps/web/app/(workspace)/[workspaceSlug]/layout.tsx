"use client";

import { use } from "react";
import { usePathname } from "next/navigation";
import { AppShell } from "../../../components/layout";
import { SocketProvider } from "../../../providers/SocketProvider";

interface WorkspaceLayoutProps {
  children: React.ReactNode;
  params: Promise<{
    workspaceSlug: string;
  }>;
}

export default function WorkspaceLayout({
  children,
  params,
}: WorkspaceLayoutProps) {
  const pathname = usePathname();
  const { workspaceSlug } = use(params);

  // Determine the active section based on the current pathname
  const getActiveSection = (): string => {
    if (pathname.includes("/chat")) return "chat";
    if (pathname.includes("/projects")) return "projects";
    if (pathname.includes("/members")) return "members";
    if (pathname.includes("/knowledge")) return "knowledge";
    if (pathname.includes("/notifications")) return "notifications";
    if (pathname.includes("/inbox")) return "inbox";
    if (pathname.includes("/settings")) return "settings";
    return "dashboard";
  };

  return (
    <SocketProvider>
      <AppShell
        workspaceSlug={workspaceSlug}
        activeSection={getActiveSection()}
        workspaceName="Nexus"
      >
        {children}
      </AppShell>
    </SocketProvider>
  );
}
