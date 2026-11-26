"use client";

import { use, useEffect, useRef, useState } from "react";
import { Send, MessageCircle, Users } from "lucide-react";
import Link from "next/link";
import { api } from "../../../../lib/auth";
import { useAuth } from "../../../../hooks/use-auth";
import { useWorkspaceMembers, WorkspaceMember } from "../../../../hooks/use-members";
import { usePresence } from "../../../../hooks/use-presence";
import { useSocket } from "../../../../providers/SocketProvider";
import { UserAvatar } from "../../../../components/ui/UserAvatar";

interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  sequence: number;
  content: string;
  clientMessageId: string;
  createdAt: string;
  sender: {
    id: string;
    name: string;
    email: string;
    imageUrl: string | null;
  };
}

interface Conversation {
  id: string;
  workspaceId: string;
  type: "DIRECT" | "GROUP";
  canonicalDmKey: string | null;
  lastSequence: number;
  unreadCount?: number;
  otherMember?: {
    id: string;
    name: string;
    email: string;
    imageUrl: string | null;
  } | null;
}

export default function ChatPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = use(params);
  const { user } = useAuth();
  const socket = useSocket();

  const { members, isLoading: membersLoading } = useWorkspaceMembers(workspaceSlug);
  const otherMembers = members.filter((m) => m.userId !== user?.id);
  const memberUserIds = otherMembers.map((m) => m.userId);
  const { isOnline } = usePresence(memberUserIds);

  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [activeRecipient, setActiveRecipient] = useState<WorkspaceMember | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [dmThreads, setDmThreads] = useState<Conversation[]>([]);
  const [inputText, setInputText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const activeIdRef = useRef<string | null>(null);
  const failedSendRef = useRef<{ content: string; id: string } | null>(null);

  // Auto-scroll to latest message
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (!socket) return;
    const refresh = async () => {
      try {
        const result = await api.get(`/api/v1/workspaces/${workspaceSlug}/chat/conversations?type=DIRECT`);
        setDmThreads(result.data ?? []);
      } catch (error) { console.error("Failed to load DM list:", error); }
    };
    socket.on("chat:message:new", refresh);
    socket.on("connect", refresh);
    void refresh();
    return () => { socket.off("chat:message:new", refresh); socket.off("connect", refresh); };
  }, [socket, workspaceSlug]);

  // Open or create a 1:1 DM with selected member
  const handleSelectMember = async (member: WorkspaceMember) => {
    setActiveRecipient(member);
    setActiveConversation(null);
    setIsLoadingMessages(true);
    setMessages([]);
    activeIdRef.current = null;
    failedSendRef.current = null;
    try {
      const res = await api.post(
        `/api/v1/workspaces/${workspaceSlug}/chat/conversations/direct`,
        { recipientUserId: member.userId },
      );
      const conversation = res.data;
      activeIdRef.current = conversation.id;
      setActiveConversation(conversation);
      setDmThreads((previous) => previous.some((item) => item.id === conversation.id) ? previous : [...previous, conversation]);
    } catch (err: unknown) {
      console.error("Failed to open DM:", err);
      setActiveRecipient(null);
      setActiveConversation(null);
      setIsLoadingMessages(false);
    }
  };

  // Send message
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const content = inputText.trim();
    if (!content || !activeConversation || isSending) return;

    const clientMessageId = failedSendRef.current?.content === content
      ? failedSendRef.current.id
      : crypto.randomUUID();
    setInputText("");
    setIsSending(true);

    try {
      const res = await api.post(
        `/api/v1/workspaces/${workspaceSlug}/chat/conversations/${activeConversation.id}/messages`,
        { content, clientMessageId },
      );
      const savedMessage = res.data;
      failedSendRef.current = null;

      // Append message if not already present
      if (activeIdRef.current === activeConversation.id) setMessages((prev) => {
        if (prev.some((m) => m.id === savedMessage.id || m.clientMessageId === clientMessageId)) {
          return prev;
        }
        return [...prev, savedMessage].sort((a, b) => a.sequence - b.sequence);
      });
      void api.patch(`/api/v1/workspaces/${workspaceSlug}/chat/conversations/${activeConversation.id}/read`, { sequence: savedMessage.sequence }).then(() => setDmThreads((previous) => previous.map((item) => item.id === activeConversation.id ? { ...item, unreadCount: 0 } : item))).catch(() => {});
    } catch (err: unknown) {
      console.error("Failed to send message:", err);
      failedSendRef.current = { content, id: clientMessageId };
      // Restore input text on error
      setInputText(content);
    } finally {
      setIsSending(false);
    }
  };

  // Attach the listener before fetching history, then merge both sources by ID.
  useEffect(() => {
    if (!socket || !activeConversation) return;
    const conversationId = activeConversation.id;
    let cancelled = false;

    const refreshHistory = async () => {
      try {
        const result = await api.get(`/api/v1/workspaces/${workspaceSlug}/chat/conversations/${conversationId}/messages?limit=50`);
        if (cancelled || activeIdRef.current !== conversationId) return;
        const fetched: Message[] = result.data?.messages ?? [];
        setMessages((previous) => {
          const byId = new Map<string, Message>();
          for (const message of [...fetched, ...previous.filter((item) => item.conversationId === conversationId)]) byId.set(message.id, message);
          return [...byId.values()].sort((a, b) => a.sequence - b.sequence);
        });
        const latest = fetched[0]?.sequence;
        if (latest) void api.patch(`/api/v1/workspaces/${workspaceSlug}/chat/conversations/${conversationId}/read`, { sequence: latest }).then(() => setDmThreads((previous) => previous.map((item) => item.id === conversationId ? { ...item, unreadCount: 0 } : item))).catch(() => {});
      } catch (err) {
        console.error("Failed to load DM history:", err);
      } finally {
        if (!cancelled) setIsLoadingMessages(false);
      }
    };

    const onNewMessage = (newMsg: Message) => {
      if (newMsg.conversationId === conversationId) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === newMsg.id || m.clientMessageId === newMsg.clientMessageId)) {
            return prev;
          }
          return [...prev, newMsg].sort((a, b) => a.sequence - b.sequence);
        });
        void api.patch(`/api/v1/workspaces/${workspaceSlug}/chat/conversations/${conversationId}/read`, { sequence: newMsg.sequence }).then(() => setDmThreads((previous) => previous.map((item) => item.id === conversationId ? { ...item, unreadCount: 0 } : item))).catch(() => {});
      }
    };

    socket.on("chat:message:new", onNewMessage);
    socket.on("connect", refreshHistory);
    void refreshHistory();
    return () => {
      cancelled = true;
      socket.off("chat:message:new", onNewMessage);
      socket.off("connect", refreshHistory);
    };
  }, [socket, activeConversation, workspaceSlug]);

  return (
    <div className="flex h-full bg-slate-950 text-slate-100">
      {/* Sidebar: Direct Messages / Members List */}
      <div className="w-72 border-r border-slate-800 bg-slate-900/60 flex flex-col">
        <div className="p-4 border-b border-slate-800 flex items-center gap-2">
          <Users className="w-5 h-5 text-blue-400" />
          <h2 className="font-semibold text-sm tracking-wide text-slate-200">
            Direct Messages
          </h2>
        </div>
        <Link href={`/${workspaceSlug}/chat/groups`} className="block px-4 py-3 text-sm text-blue-300 hover:bg-slate-800">Group chats</Link>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {membersLoading ? (
            <p className="text-xs text-slate-500 p-3">Loading members...</p>
          ) : otherMembers.length === 0 ? (
            <p className="text-xs text-slate-500 p-3">No other members in workspace</p>
          ) : (
            otherMembers.map((member) => {
              const isSelected = activeRecipient?.userId === member.userId;
              const online = isOnline(member.userId);
              const unread = dmThreads.find((thread) => thread.otherMember?.id === member.userId)?.unreadCount ?? 0;

              return (
                <button
                  key={member.userId}
                  onClick={() => handleSelectMember(member)}
                  className={`w-full flex items-center gap-3 p-2.5 rounded-lg text-left transition-all duration-150 ${
                    isSelected
                      ? "bg-blue-600/20 text-blue-300 border border-blue-500/30"
                      : "hover:bg-slate-800/60 text-slate-300 hover:text-slate-100"
                  }`}
                >
                  <UserAvatar
                    name={member.name}
                    image={member.image}
                    isOnline={online}
                    showPresence={true}
                    size="sm"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{member.name}</p>
                    <p className="text-[11px] text-slate-400 truncate">
                      {online ? "Online" : "Offline"}
                    </p>
                  </div>
                  {unread > 0 && <span className="rounded-full bg-blue-600 px-2 text-xs text-white">{unread}</span>}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col h-full bg-slate-950">
        {activeRecipient ? (
          <>
            {/* Header */}
            <div className="h-16 border-b border-slate-800 px-6 flex items-center justify-between bg-slate-900/40">
              <div className="flex items-center gap-3">
                <UserAvatar
                  name={activeRecipient.name}
                  image={activeRecipient.image}
                  isOnline={isOnline(activeRecipient.userId)}
                  showPresence={true}
                  size="sm"
                />
                <div>
                  <h1 className="text-sm font-semibold text-slate-100">
                    {activeRecipient.name}
                  </h1>
                  <p className="text-xs text-slate-400">
                    {isOnline(activeRecipient.userId) ? "Active now" : "Offline"}
                  </p>
                </div>
              </div>
            </div>

            {/* Messages Feed */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {isLoadingMessages ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-sm text-slate-500">Loading conversation...</p>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mb-3">
                    <MessageCircle className="w-6 h-6 text-slate-500" />
                  </div>
                  <h3 className="text-sm font-medium text-slate-200">
                    This is the start of your direct message with {activeRecipient.name}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Send a message below to start chatting.
                  </p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isMe = msg.senderId === user?.id;
                  const time = new Date(msg.createdAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  });

                  return (
                    <div
                      key={msg.id}
                      className={`flex gap-3 items-end ${
                        isMe ? "justify-end" : "justify-start"
                      }`}
                    >
                      {!isMe && (
                        <UserAvatar
                          name={msg.sender.name}
                          image={msg.sender.imageUrl}
                          size="xs"
                        />
                      )}
                      <div
                        className={`max-w-[70%] rounded-2xl px-4 py-2.5 text-sm ${
                          isMe
                            ? "bg-blue-600 text-white rounded-br-xs"
                            : "bg-slate-800 text-slate-100 rounded-bl-xs border border-slate-700/50"
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                        <p
                          className={`text-[10px] mt-1 text-right ${
                            isMe ? "text-blue-200" : "text-slate-400"
                          }`}
                        >
                          {time}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Composer */}
            <div className="p-4 border-t border-slate-800 bg-slate-900/40">
              <form onSubmit={handleSendMessage} className="flex gap-2">
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder={`Message ${activeRecipient.name}...`}
                  className="flex-1 bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-500 px-4 py-2.5 rounded-xl outline-none focus:border-blue-500 transition-colors text-sm"
                />
                <button
                  type="submit"
                  disabled={!inputText.trim() || isSending}
                  className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:hover:bg-blue-600 text-white rounded-xl transition-all flex items-center justify-center cursor-pointer disabled:cursor-not-allowed"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <div className="w-16 h-16 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center mb-4">
              <MessageCircle className="w-8 h-8 text-blue-400" />
            </div>
            <h2 className="text-lg font-semibold text-slate-100 mb-1">
              Your Direct Messages
            </h2>
            <p className="text-sm text-slate-400 max-w-sm">
              Select a team member from the left to start a direct message conversation.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
