import {
  LayoutGrid,
  MessageCircle,
  FileText,
  Users,
  Lightbulb,
  Bell,
  Mail,
  Settings,
  LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const RAIL_NAV_ITEMS: NavItem[] = [
  {
    label: "Overview",
    href: "dashboard",
    icon: LayoutGrid,
  },
  {
    label: "Chat",
    href: "chat",
    icon: MessageCircle,
  },
  {
    label: "Projects",
    href: "projects",
    icon: FileText,
  },
  {
    label: "Members",
    href: "members",
    icon: Users,
  },
  {
    label: "Knowledge",
    href: "knowledge",
    icon: Lightbulb,
  },
  {
    label: "Notifications",
    href: "notifications",
    icon: Bell,
    badge: "3",
  },
  {
    label: "Inbox",
    href: "inbox",
    icon: Mail,
  },
  {
    label: "Settings",
    href: "settings",
    icon: Settings,
  },
];

export const SIDEBAR_NAVIGATION: Record<string, NavSection[]> = {
  dashboard: [
    {
      title: "Dashboard",
      items: [
        { label: "Overview", href: "dashboard", icon: LayoutGrid },
        {
          label: "My Activity",
          href: "dashboard/activity",
          icon: MessageCircle,
        },
        { label: "Assigned to Me", href: "dashboard/assigned", icon: FileText },
        { label: "Recent Projects", href: "projects", icon: FileText },
      ],
    },
  ],
  chat: [
    {
      title: "Chat",
      items: [
        { label: "Direct Messages", href: "chat", icon: MessageCircle },
        { label: "Groups", href: "chat/groups", icon: Users },
      ],
    },
  ],
  projects: [
    {
      title: "Projects",
      items: [
        { label: "All Projects", href: "projects", icon: FileText },
        { label: "Roadmap", href: "projects/roadmap", icon: FileText },
        { label: "Milestones", href: "projects/milestones", icon: FileText },
        { label: "Sprints", href: "projects/sprints", icon: FileText },
      ],
    },
  ],
  members: [
    {
      title: "Members",
      items: [
        { label: "Team Members", href: "members", icon: Users },
        { label: "Roles", href: "members/roles", icon: Users },
        { label: "Permissions", href: "members/permissions", icon: Users },
      ],
    },
  ],
  knowledge: [
    {
      title: "Knowledge",
      items: [
        { label: "All Documents", href: "knowledge", icon: Lightbulb },
        { label: "Recent", href: "knowledge/recent", icon: Lightbulb },
        { label: "Favorites", href: "knowledge/favorites", icon: Lightbulb },
      ],
    },
  ],
  notifications: [
    {
      title: "Notifications",
      items: [
        { label: "All", href: "notifications", icon: Bell },
        { label: "Unread", href: "notifications/unread", icon: Bell },
        { label: "Mentions", href: "notifications/mentions", icon: Bell },
      ],
    },
  ],
  inbox: [
    {
      title: "Inbox",
      items: [
        { label: "All Messages", href: "inbox", icon: Mail },
        { label: "Unread", href: "inbox/unread", icon: Mail },
        { label: "Assigned", href: "inbox/assigned", icon: Mail },
      ],
    },
  ],
  settings: [
    {
      title: "Workspace Settings",
      items: [
        { label: "General", href: "settings/general", icon: Settings },
        { label: "Members", href: "settings/members", icon: Users },
        { label: "Permissions", href: "settings/permissions", icon: Settings },
        {
          label: "Integrations",
          href: "settings/integrations",
          icon: Settings,
        },
        { label: "Billing", href: "settings/billing", icon: Settings },
      ],
    },
    {
      title: "Account",
      items: [
        { label: "Profile", href: "settings/profile", icon: Users },
        { label: "Preferences", href: "settings/preferences", icon: Settings },
      ],
    },
  ],
};
