"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { MessageCircle, Plus, Send, Users } from "lucide-react";
import { api } from "../../../../../lib/auth";
import { useAuth } from "../../../../../hooks/use-auth";
import { useWorkspaceMembers } from "../../../../../hooks/use-members";
import { useSocket } from "../../../../../providers/SocketProvider";
import { UserAvatar } from "../../../../../components/ui/UserAvatar";

type GroupRole = "OWNER" | "ADMIN" | "MEMBER";
interface GroupMember {
  userId: string;
  role: GroupRole;
  user: { id: string; name: string; imageUrl: string | null };
}
interface Group {
  id: string;
  title: string;
  description: string | null;
  lastSequence: number;
  unreadCount: number;
  myRole: GroupRole;
  members: GroupMember[];
}
interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  sequence: number;
  content: string;
  clientMessageId: string;
  createdAt: string;
  sender: { id: string; name: string; imageUrl: string | null };
}

const errorMessage = (cause: unknown, fallback: string) =>
  typeof cause === "object" && cause !== null && "message" in cause && typeof cause.message === "string" ? cause.message : fallback;

export default function GroupsPage({ params }: { params: Promise<{ workspaceSlug: string }> }) {
  const { workspaceSlug } = use(params);
  const base = `/api/v1/workspaces/${workspaceSlug}/chat`;
  const { user } = useAuth();
  const socket = useSocket();
  const { members: workspaceMembers } = useWorkspaceMembers(workspaceSlug);
  const [groups, setGroups] = useState<Group[]>([]);
  const [active, setActive] = useState<Group | null>(null);
  const activeId = useRef<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [input, setInput] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [newMemberId, setNewMemberId] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [showManage, setShowManage] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const failedSend = useRef<{ groupId: string; content: string; id: string } | null>(null);
  const [typingIds, setTypingIds] = useState<string[]>([]);
  const typingStopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingExpiryTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const refreshGroups = useCallback(async () => {
    try {
      const result = await api.get(`${base}/groups`);
      const list: Group[] = result.data ?? [];
      setGroups(list);
      setActive((previous) => previous ? list.find((item) => item.id === previous.id) ?? null : null);
      if (activeId.current && !list.some((item) => item.id === activeId.current)) {
        activeId.current = null;
        setMessages([]);
      }
    } catch (cause: unknown) {
      setError(errorMessage(cause, "Could not load groups"));
    }
  }, [base]);

  useEffect(() => { void refreshGroups(); }, [refreshGroups]);

  const markRead = useCallback(async (groupId: string, sequence: number) => {
    if (sequence < 1) return;
    try {
      await api.patch(`${base}/conversations/${groupId}/read`, { sequence });
      setGroups((previous) => previous.map((group) => group.id === groupId ? { ...group, unreadCount: 0 } : group));
    } catch { /* A later history refresh will retry. */ }
  }, [base]);

  const openGroup = async (group: Group) => {
    if (activeId.current && typingStopTimer.current) {
      socket?.emit("chat:typing", { conversationId: activeId.current, isTyping: false });
      clearTimeout(typingStopTimer.current);
      typingStopTimer.current = null;
    }
    activeId.current = group.id;
    for (const timer of typingExpiryTimers.current.values()) clearTimeout(timer);
    typingExpiryTimers.current.clear();
    setTypingIds([]);
    setActive(group);
    setMessages([]);
    setNextCursor(null);
    setHasMore(false);
    setShowManage(false);
    failedSend.current = null;
    setError("");
    setLoading(true);
    try {
      const result = await api.get(`${base}/conversations/${group.id}/messages?limit=50`);
      if (activeId.current !== group.id) return;
      const page = result.data;
      setMessages([...page.messages].reverse());
      setNextCursor(page.nextCursor);
      setHasMore(page.hasMore);
      if (page.messages[0]) await markRead(group.id, page.messages[0].sequence);
    } catch (cause: unknown) {
      if (activeId.current === group.id) setError(errorMessage(cause, "Could not load messages"));
    } finally {
      if (activeId.current === group.id) setLoading(false);
    }
  };

  const loadOlder = async () => {
    if (!active || !hasMore || !nextCursor || loading) return;
    setLoading(true);
    try {
      const result = await api.get(`${base}/conversations/${active.id}/messages?limit=50&beforeSequence=${nextCursor}`);
      if (activeId.current !== active.id) return;
      const page = result.data;
      setMessages((previous) => [...page.messages.reverse(), ...previous]);
      setNextCursor(page.nextCursor);
      setHasMore(page.hasMore);
    } catch (cause: unknown) {
      setError(errorMessage(cause, "Could not load older messages"));
    } finally { setLoading(false); }
  };

  useEffect(() => {
    if (!socket) return;
    const onMessage = (message: Message) => {
      void refreshGroups();
      if (activeId.current !== message.conversationId) return;
      setMessages((previous) => previous.some((item) => item.id === message.id) ? previous : [...previous, message].sort((a, b) => a.sequence - b.sequence));
      void markRead(message.conversationId, message.sequence);
    };
    const onGroupChange = () => { void refreshGroups(); };
    const onReconnect = async () => {
      await refreshGroups();
      const groupId = activeId.current;
      if (!groupId) return;
      try {
        const result = await api.get(`${base}/conversations/${groupId}/messages?limit=50`);
        if (activeId.current !== groupId) return;
        const fetched: Message[] = result.data?.messages ?? [];
        setMessages((previous) => {
          const byId = new Map<string, Message>();
          for (const message of [...previous, ...fetched]) byId.set(message.id, message);
          return [...byId.values()].sort((a, b) => a.sequence - b.sequence);
        });
        if (fetched[0]) void markRead(groupId, fetched[0].sequence);
      } catch { /* The next open or reconnect can retry. */ }
    };
    const onTyping = (event: { conversationId: string; userId: string; isTyping: boolean }) => {
      if (activeId.current !== event.conversationId || event.userId === user?.id) return;
      const oldTimer = typingExpiryTimers.current.get(event.userId);
      if (oldTimer) clearTimeout(oldTimer);
      if (event.isTyping) {
        setTypingIds((previous) => previous.includes(event.userId) ? previous : [...previous, event.userId]);
        typingExpiryTimers.current.set(event.userId, setTimeout(() => {
          setTypingIds((previous) => previous.filter((id) => id !== event.userId));
          typingExpiryTimers.current.delete(event.userId);
        }, 3000));
      } else {
        setTypingIds((previous) => previous.filter((id) => id !== event.userId));
        typingExpiryTimers.current.delete(event.userId);
      }
    };
    socket.on("chat:message:new", onMessage);
    socket.on("connect", onReconnect);
    socket.on("chat:typing", onTyping);
    socket.on("chat:group:updated", onGroupChange);
    socket.on("chat:group:removed", onGroupChange);
    socket.on("chat:group:deleted", onGroupChange);
    return () => {
      socket.off("chat:message:new", onMessage);
      socket.off("connect", onReconnect);
      socket.off("chat:typing", onTyping);
      socket.off("chat:group:updated", onGroupChange);
      socket.off("chat:group:removed", onGroupChange);
      socket.off("chat:group:deleted", onGroupChange);
    };
  }, [socket, refreshGroups, markRead, user?.id, base]);

  useEffect(() => () => {
    if (typingStopTimer.current) clearTimeout(typingStopTimer.current);
    for (const timer of typingExpiryTimers.current.values()) clearTimeout(timer);
  }, []);

  const updateInput = (value: string) => {
    setInput(value);
    if (!activeId.current) return;
    const wasTyping = typingStopTimer.current !== null;
    if (typingStopTimer.current) clearTimeout(typingStopTimer.current);
    if (!value.trim()) {
      socket?.emit("chat:typing", { conversationId: activeId.current, isTyping: false });
      typingStopTimer.current = null;
      return;
    }
    if (!wasTyping) socket?.emit("chat:typing", { conversationId: activeId.current, isTyping: true });
    const conversationId = activeId.current;
    typingStopTimer.current = setTimeout(() => {
      socket?.emit("chat:typing", { conversationId, isTyping: false });
      typingStopTimer.current = null;
    }, 1500);
  };

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.length, active?.id]);

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim() || selectedIds.length === 0) return;
    setBusy(true); setError("");
    try {
      const result = await api.post(`${base}/groups`, { title: title.trim(), description: description.trim(), memberUserIds: selectedIds });
      setShowCreate(false); setTitle(""); setDescription(""); setSelectedIds([]);
      await refreshGroups();
      await openGroup(result.data);
    } catch (cause: unknown) { setError(errorMessage(cause, "Could not create group")); }
    finally { setBusy(false); }
  };

  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!active || !input.trim() || busy) return;
    const content = input.trim();
    const clientMessageId = failedSend.current?.groupId === active.id && failedSend.current.content === content
      ? failedSend.current.id : crypto.randomUUID();
    if (typingStopTimer.current) clearTimeout(typingStopTimer.current);
    typingStopTimer.current = null;
    socket?.emit("chat:typing", { conversationId: active.id, isTyping: false });
    setBusy(true); setInput(""); setError("");
    try {
      const result = await api.post(`${base}/conversations/${active.id}/messages`, { content, clientMessageId });
      const message: Message = result.data;
      failedSend.current = null;
      if (activeId.current === active.id) setMessages((previous) => previous.some((item) => item.id === message.id) ? previous : [...previous, message].sort((a, b) => a.sequence - b.sequence));
      await markRead(active.id, message.sequence);
      void refreshGroups();
    } catch (cause: unknown) { failedSend.current = { groupId: active.id, content, id: clientMessageId }; setInput(content); setError(errorMessage(cause, "Could not send message")); }
    finally { setBusy(false); }
  };

  const changeGroup = async (action: () => Promise<unknown>) => {
    setBusy(true); setError("");
    try { await action(); await refreshGroups(); }
    catch (cause: unknown) { setError(errorMessage(cause, "Could not update group")); }
    finally { setBusy(false); }
  };

  return <div className="flex h-full min-h-0 bg-slate-950 text-slate-100">
    <aside className="w-72 shrink-0 border-r border-slate-800 bg-slate-900/60 flex flex-col">
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2"><Users className="w-5 h-5 text-blue-400" /><h1 className="font-semibold">Group chats</h1></div>
        <button aria-label="Create group" title="Create group" onClick={() => setShowCreate((value) => !value)} className="p-1 rounded hover:bg-slate-800"><Plus className="w-5 h-5" /></button>
      </div>
      <div className="px-4 py-2 text-xs text-blue-300"><Link href={`/${workspaceSlug}/chat`}>Direct messages</Link></div>
      {showCreate && <form onSubmit={create} className="p-3 border-b border-slate-800 space-y-2">
        <input aria-label="Group name" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={100} placeholder="Group name" className="w-full p-2 rounded bg-slate-800 text-sm" />
        <input aria-label="Description" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={500} placeholder="Description (optional)" className="w-full p-2 rounded bg-slate-800 text-sm" />
        <div className="max-h-32 overflow-y-auto text-xs space-y-1">{workspaceMembers.filter((member) => member.userId !== user?.id).map((member) => <label key={member.userId} className="flex gap-2 items-center"><input type="checkbox" checked={selectedIds.includes(member.userId)} onChange={(event) => setSelectedIds((previous) => event.target.checked ? [...previous, member.userId] : previous.filter((id) => id !== member.userId))} />{member.name}</label>)}</div>
        <button disabled={busy || !title.trim() || selectedIds.length === 0} className="w-full rounded bg-blue-600 disabled:opacity-50 p-2 text-sm">Create group</button>
      </form>}
      <div className="flex-1 overflow-y-auto p-2">{groups.map((group) => <button key={group.id} onClick={() => void openGroup(group)} className={`w-full p-3 rounded-lg text-left flex items-center gap-2 ${active?.id === group.id ? "bg-blue-600/20 text-blue-200" : "hover:bg-slate-800"}`}>
        <Users className="w-4 h-4 shrink-0" /><span className="truncate flex-1 text-sm">{group.title}</span>{group.unreadCount > 0 && <span className="rounded-full bg-blue-600 px-2 text-xs">{group.unreadCount}</span>}
      </button>)}</div>
    </aside>
    <main className="flex-1 min-w-0 flex flex-col">
      {active ? <>
        <header className="min-h-16 border-b border-slate-800 px-6 flex items-center justify-between">
          <div><h2 className="font-semibold">{active.title}</h2><p className="text-xs text-slate-400">{active.members.length} members{active.description ? ` · ${active.description}` : ""}</p></div>
          <button onClick={() => setShowManage((value) => !value)} className="text-sm text-blue-300 hover:text-blue-200">Members</button>
        </header>
        {showManage && <section className="border-b border-slate-800 p-4 space-y-3 bg-slate-900/60 text-sm">
          {active.members.map((member) => <div key={member.userId} className="flex items-center gap-2">
            <span className="flex-1">{member.user.name} <span className="text-slate-400">({member.role.toLowerCase()})</span></span>
            {active.myRole === "OWNER" && member.role !== "OWNER" && <select aria-label={`Role for ${member.user.name}`} value={member.role} disabled={busy} onChange={(event) => void changeGroup(async () => { await api.patch(`${base}/groups/${active.id}/members/${member.userId}/role`, { role: event.target.value }); })} className="bg-slate-800 rounded p-1"><option value="MEMBER">Member</option><option value="ADMIN">Admin</option><option value="OWNER">Owner</option></select>}
            {(member.userId === user?.id && member.role !== "OWNER" || member.userId !== user?.id && (active.myRole === "OWNER" || active.myRole === "ADMIN" && member.role === "MEMBER")) && <button disabled={busy} onClick={() => void changeGroup(async () => { await api.delete(`${base}/groups/${active.id}/members/${member.userId}`); })} className="text-red-300">{member.userId === user?.id ? "Leave" : "Remove"}</button>}
          </div>)}
          {active.myRole !== "MEMBER" && <div className="flex gap-2"><select aria-label="Add member" value={newMemberId} onChange={(event) => setNewMemberId(event.target.value)} className="bg-slate-800 rounded p-1 flex-1"><option value="">Choose a workspace member</option>{workspaceMembers.filter((member) => !active.members.some((current) => current.userId === member.userId)).map((member) => <option key={member.userId} value={member.userId}>{member.name}</option>)}</select><button disabled={!newMemberId || busy} onClick={() => void changeGroup(async () => { await api.post(`${base}/groups/${active.id}/members`, { userIds: [newMemberId] }); setNewMemberId(""); })} className="text-blue-300 disabled:opacity-50">Add</button></div>}
          {active.myRole !== "MEMBER" && <button disabled={busy} onClick={() => { const name = window.prompt("New group name", active.title); if (name?.trim()) void changeGroup(async () => { await api.patch(`${base}/groups/${active.id}`, { title: name.trim() }); }); }} className="text-blue-300 mr-4">Rename group</button>}
          {active.myRole === "OWNER" && <button disabled={busy} onClick={() => { if (window.confirm(`Delete ${active.title} and all its messages?`)) void changeGroup(async () => { await api.delete(`${base}/groups/${active.id}`); }); }} className="text-red-300">Delete group</button>}
        </section>}
        {error && <p role="alert" className="px-6 py-2 text-sm text-red-300">{error}</p>}
        <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-4">
          {hasMore && <button disabled={loading} onClick={() => void loadOlder()} className="block mx-auto text-sm text-blue-300 disabled:opacity-50">Load older messages</button>}
          {loading && messages.length === 0 ? <p className="text-sm text-slate-400">Loading messages...</p> : messages.length === 0 ? <p className="text-sm text-slate-400 text-center mt-10">Start the conversation.</p> : messages.map((message) => <div key={message.id} className={`flex gap-2 ${message.senderId === user?.id ? "justify-end" : "justify-start"}`}>
            {message.senderId !== user?.id && <UserAvatar name={message.sender.name} image={message.sender.imageUrl} size="xs" />}
            <div className={`max-w-[70%] rounded-2xl p-3 text-sm ${message.senderId === user?.id ? "bg-blue-600" : "bg-slate-800"}`}><div className="text-xs opacity-70 mb-1">{message.sender.name}</div><p className="whitespace-pre-wrap break-words">{message.content}</p><time className="block text-right text-[10px] opacity-60 mt-1">{new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time></div>
          </div>)}<div ref={bottomRef} />
        </div>
        {typingIds.length > 0 && <p className="px-6 py-1 text-xs text-slate-400">{typingIds.map((id) => active.members.find((member) => member.userId === id)?.user.name ?? "Someone").join(", ")} {typingIds.length === 1 ? "is" : "are"} typing...</p>}
        <form onSubmit={send} className="p-4 border-t border-slate-800 flex gap-2"><input aria-label="Message" value={input} onChange={(event) => updateInput(event.target.value)} placeholder={`Message ${active.title}...`} className="flex-1 min-w-0 rounded-xl bg-slate-800 p-3 text-sm" /><button aria-label="Send" disabled={busy || !input.trim()} className="rounded-xl bg-blue-600 p-3 disabled:opacity-50"><Send className="w-4 h-4" /></button></form>
      </> : <div className="flex-1 flex flex-col items-center justify-center text-slate-400"><MessageCircle className="w-10 h-10 mb-3" /><p>Select a group or create one.</p>{error && <p role="alert" className="text-red-300 text-sm mt-2">{error}</p>}</div>}
    </main>
  </div>;
}
