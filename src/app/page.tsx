"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  MessageResponse,
} from "@/components/ai-elements/message";
import type { PromptInputMessage } from "@/components/ai-elements/prompt-input";
import {
  PromptInput,
  PromptInputBody,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import { ConversationSidebar } from "@/components/chat/ConversationSidebar";
import { VoiceRecorder } from "@/components/chat/VoiceRecorder";
import { cn } from "@/lib/utils";

// ─── Models ───────────────────────────────────────────────────────────────────
const MODELS = [
  { id: "gpt-4o", label: "GPT-4o", badge: "Latest" },
  { id: "gpt-4o-mini", label: "GPT-4o mini", badge: "Fast" },
  { id: "gpt-4.1", label: "GPT-4.1", badge: "Reasoning" },
];

// ─── Icons (inline SVG for zero deps) ─────────────────────────────────────────
const CopyIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);
const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);
const RefreshIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
  </svg>
);
const ChevronDown = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);
const SparkleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="currentColor" opacity="0.2" />
    <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
  </svg>
);

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getMessageText(msg: any): string {
  if (msg.parts && Array.isArray(msg.parts)) {
    return msg.parts
      .filter((p: any) => p.type === "text")
      .map((p: any) => p.text)
      .join("");
  }
  if (typeof msg.content === "string") return msg.content;
  return "";
}

// ─── CopyButton Component ────────────────────────────────────────────────────
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={handleCopy} className="p-1 rounded hover:bg-white/10 transition-colors text-white/30 hover:text-white/60" title="Copiar">
      {copied ? <CheckIcon /> : <CopyIcon />}
    </button>
  );
}

// ─── ModelSelector Component ─────────────────────────────────────────────────
function ModelSelector({ model, onModelChange }: { model: string; onModelChange: (m: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const current = MODELS.find((m) => m.id === model) || MODELS[0];

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-sm font-semibold opacity-90 hover:opacity-100 transition-opacity"
      >
        {current.label}
        <ChevronDown />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-2 w-56 bg-[#1e1e1e] rounded-xl border border-white/10 shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
          {MODELS.map((m) => (
            <button
              key={m.id}
              onClick={() => { onModelChange(m.id); setOpen(false); }}
              className={cn(
                "w-full flex items-center justify-between px-4 py-3 text-sm hover:bg-white/5 transition-colors",
                model === m.id ? "text-white bg-white/5" : "text-white/60"
              )}
            >
              <span className="font-medium">{m.label}</span>
              <span className={cn(
                "text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase",
                model === m.id ? "bg-emerald-500/20 text-emerald-400" : "bg-white/5 text-white/30"
              )}>
                {m.badge}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function ChatbotPage() {
  const [activeThreadId, setActiveThreadId] = useState<string>("web:user-123");
  const [conversations, setConversations] = useState<any[]>([]);
  const [isConversationsLoading, setIsConversationsLoading] = useState(true);
  const [selectedModel, setSelectedModel] = useState("gpt-4o");

  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch("/api/chat/conversations?userId=user-123");
      const data = await res.json();
      setConversations(data);
      return data;
    } catch (error) {
      console.error("Error fetching conversations:", error);
      return [];
    } finally {
      setIsConversationsLoading(false);
    }
  }, []);

  const fetchHistory = useCallback(async (threadId: string) => {
    try {
      const res = await fetch(`/api/chat/messages?threadId=${threadId}`);
      const data = await res.json();
      return data.map((m: any) => ({
        id: m.id,
        role: m.role === "bot" ? "assistant" : "user",
        parts: [{ type: "text" as const, text: m.text }],
      }));
    } catch (error) {
      console.error("Error fetching history:", error);
      return [];
    }
  }, []);

  const { messages, sendMessage, status, setMessages, regenerate } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat/stream",
      body: { threadId: activeThreadId, model: selectedModel },
    }),
    onFinish: () => {
      fetchConversations();
    },
    onError: (error: any) => {
      toast.error("Error al conectar con el chat", {
        description: error.message,
      });
    },
  });

  const handleSelectConversation = useCallback(async (threadId: string) => {
    if (threadId === activeThreadId) return;
    setActiveThreadId(threadId);
    // Immediately load history for the selected conversation
    const history = await fetchHistory(threadId);
    setMessages(history);
  }, [activeThreadId, fetchHistory, setMessages]);

  // Load initial conversation on mount
  useEffect(() => {
    fetchConversations().then((data: any) => {
      if (data && data.length > 0 && activeThreadId === "web:user-123") {
        const firstThread = data[0].thread_id;
        setActiveThreadId(firstThread);
        fetchHistory(firstThread).then((history) => setMessages(history));
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Poll conversations list every 5s
  useEffect(() => {
    const id = setInterval(fetchConversations, 5000);
    return () => clearInterval(id);
  }, [fetchConversations]);

  // Poll messages for active thread every 4s (only when not streaming)
  useEffect(() => {
    if (status === "streaming") return;
    const id = setInterval(() => {
      fetchHistory(activeThreadId).then((history) => {
        setMessages(history);
      });
    }, 4000);
    return () => clearInterval(id);
  }, [activeThreadId, fetchHistory, setMessages, status]);

  const [text, setText] = useState("");

  const handleTextChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      setText(event.target.value);
    },
    []
  );

  const handleSubmit = useCallback(
    async (message: PromptInputMessage) => {
      const content = message.text?.trim();
      const files = message.files || [];
      
      if (!content && files.length === 0) return;

      setText("");
      
      // Standard AI SDK append payload for text + files
      sendMessage({
        role: "user",
        parts: [
          ...(content ? [{ type: "text" as const, text: content }] : [{ type: "text" as const, text: "Mensaje de voz" }]),
          ...files.map(f => ({
            type: "file" as const,
            url: f.url,
            mediaType: f.mediaType || "application/octet-stream",
            filename: f.filename
          }))
        ]
      });
      
      setTimeout(() => fetchConversations(), 1000);
    },
    [sendMessage, fetchConversations]
  );

  const handleVoiceComplete = useCallback((file: File) => {
    // Manually trigger a message with the voice file
    const url = URL.createObjectURL(file);
    sendMessage({
      role: "user",
      parts: [
        { type: "text" as const, text: "Mensaje de voz" },
        { 
          type: "file" as const, 
          url, 
          mediaType: file.type || "audio/webm", 
          filename: file.name 
        }
      ]
    });
    setTimeout(() => fetchConversations(), 1000);
  }, [sendMessage, fetchConversations]);

  const isSubmitDisabled = useMemo(
    () => !text.trim() || status === "streaming",
    [text, status]
  );

  const isStreaming = status === "streaming";

  return (
    <div className="relative flex h-screen w-full overflow-hidden bg-[#0d0d0d] text-[#ececec] font-sans">
      {/* Left Sidebar */}
      <ConversationSidebar
        conversations={conversations}
        activeThreadId={activeThreadId}
        onSelectConversation={handleSelectConversation}
        isLoading={isConversationsLoading}
      />

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 relative h-full">
        {/* Header with Model Selector */}
        <header className="flex h-12 shrink-0 items-center justify-between px-4 sticky top-0 z-10 bg-[#0d0d0d]/80 backdrop-blur-md border-b border-white/5">
          <ModelSelector model={selectedModel} onModelChange={setSelectedModel} />
          {isStreaming && (
            <div className="flex items-center gap-2 text-xs text-white/40">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
              Generando...
            </div>
          )}
        </header>

        {/* Conversation */}
        <div className="flex-1 overflow-hidden relative">
          <Conversation className="h-full">
            <div className="mx-auto w-full max-w-3xl">
              <ConversationContent>
                {messages.length === 0 && !isStreaming && (
                  <div className="flex h-full flex-col items-center justify-center text-center px-6 mt-32">
                    <div className="mb-6 text-white/10">
                      <SparkleIcon />
                    </div>
                    <h2 className="text-2xl font-semibold mb-3 text-white/90">¿En qué puedo ayudarte hoy?</h2>
                    <p className="text-sm text-white/30 max-w-md">Escribe un mensaje para comenzar una conversación con el asistente Elite AI.</p>
                  </div>
                )}
                <div className="space-y-6 py-8 px-2">
                  {messages.map((msg, index) => {
                    const msgText = getMessageText(msg);
                    if (!msgText && msg.role !== "assistant") return null;
                    const isLast = index === messages.length - 1;
                    const isAssistant = msg.role === "assistant";

                    return (
                      <div key={msg.id} className="group/msg">
                        <div className="flex items-start gap-4 max-w-3xl mx-auto">
                          {/* Avatar */}
                          <div className={cn(
                            "w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[11px] font-bold mt-0.5",
                            isAssistant
                              ? "bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/20"
                              : "bg-[#3a3a3a] text-white/70"
                          )}>
                            {isAssistant ? "✦" : "U"}
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            {/* Role label */}
                            <p className={cn(
                              "text-xs font-semibold mb-1.5",
                              isAssistant ? "text-emerald-400/70" : "text-white/40"
                            )}>
                              {isAssistant ? "Elite AI" : "Tú"}
                            </p>

                            {isAssistant ? (
                              <div className={cn(
                                "text-[15px] leading-7 select-text",
                                isLast && isStreaming ? "streaming-text" : ""
                              )}>
                                <MessageResponse>
                                  {msgText}
                                </MessageResponse>
                              </div>
                            ) : (
                              <p className="text-[15px] leading-7 select-text whitespace-pre-wrap text-white/90">
                                {msgText}
                              </p>
                            )}

                            {/* Action buttons for assistant messages */}
                            {isAssistant && msgText && !isStreaming && (
                              <div className="flex items-center gap-1 mt-3 opacity-0 group-hover/msg:opacity-100 transition-opacity duration-200">
                                <CopyButton text={msgText} />
                                {isLast && (
                                  <button
                                    onClick={() => regenerate()}
                                    className="p-1 rounded hover:bg-white/10 transition-colors text-white/30 hover:text-white/60"
                                    title="Regenerar respuesta"
                                  >
                                    <RefreshIcon />
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* Streaming indicator at the bottom */}
                  {isStreaming && messages.length > 0 && getMessageText(messages[messages.length - 1]) === "" && (
                    <div className="flex items-start gap-4 max-w-3xl mx-auto">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-[11px] text-white font-bold mt-0.5">✦</div>
                      <div className="pt-2">
                        <div className="flex gap-1.5">
                          <span className="w-2 h-2 bg-white/20 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                          <span className="w-2 h-2 bg-white/20 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                          <span className="w-2 h-2 bg-white/20 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </ConversationContent>
            </div>
            <ConversationScrollButton />
          </Conversation>
        </div>

        {/* Floating Input Area */}
        <div className="shrink-0 pb-6 pt-2">
          <div className="mx-auto w-full max-w-3xl px-4 lg:px-0">
            <div className="relative bg-[#2f2f2f] rounded-2xl p-1.5 shadow-2xl ring-1 ring-white/10 focus-within:ring-white/20 transition-all">
              <PromptInput onSubmit={handleSubmit}>
                <PromptInputBody>
                  <PromptInputTextarea
                    onChange={handleTextChange}
                    value={text}
                    placeholder="Pregúntame cualquier cosa..."
                    className="min-h-[44px] max-h-[200px] bg-transparent border-none focus:ring-0 text-[15px] px-3 pt-2.5 pb-2 placeholder:text-white/25"
                  />
                </PromptInputBody>
                <div className="flex items-center justify-between px-3 pb-1.5">
                  <div className="flex items-center gap-1">
                    <button className="p-1.5 hover:bg-white/5 rounded-lg transition-colors text-white/30 hover:text-white/50" title="Adjuntar archivo">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                      </svg>
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-white/15 hidden sm:inline">
                      {selectedModel}
                    </span>
                    <PromptInputSubmit
                      disabled={isSubmitDisabled}
                      status={status as any}
                      className="rounded-full h-8 w-8 p-0 flex items-center justify-center bg-white text-black hover:bg-white/90 transition-all disabled:bg-white/10 disabled:text-white/10"
                    />
                    <VoiceRecorder 
                       onRecordingComplete={handleVoiceComplete}
                       isRecordingDisabled={status === "streaming"}
                    />
                  </div>
                </div>
              </PromptInput>
            </div>
            <p className="text-[11px] text-center mt-3 text-white/15">
              Elite AI puede cometer errores. Considera verificar la información importante.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
