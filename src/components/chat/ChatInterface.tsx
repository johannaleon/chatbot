"use client";

import React, { useState, useEffect, useRef } from "react";
import { Send, Bot, User, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Message {
  id: string;
  text: string;
  userId: string;
  userName: string;
  createdAt: string;
}

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Poll for messages every 2 seconds for this demo
  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const res = await fetch("/api/chat/messages");
        const data = await res.json();
        setMessages(data);
      } catch (e) {
        console.error("Fetch error:", e);
      }
    };

    const interval = setInterval(fetchMessages, 2000);
    fetchMessages(); // initial fetch
    return () => clearInterval(interval);
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMsg = input.trim();
    setInput("");
    setIsLoading(true);

    try {
      await fetch("/api/chat/webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: userMsg, userId: "user-123" }),
      });
    } catch (e) {
      console.error("Send error:", e);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8 px-2">
        <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
          <Bot className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">AI Concierge</h1>
          <p className="text-sm text-zinc-400 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Sistemas Elite Activo
          </p>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 glass rounded-2xl mb-6 overflow-hidden flex flex-col relative">
        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth"
        >
          <AnimatePresence initial={false}>
            {messages.length === 0 && !isLoading && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="h-full flex flex-col items-center justify-center text-center p-8 text-zinc-500"
              >
                <div className="w-16 h-16 rounded-full bg-zinc-800/50 flex items-center justify-center mb-4">
                  <Bot className="w-8 h-8 opacity-20" />
                </div>
                <p className="text-lg font-medium text-white mb-2">Comienza la conversación</p>
                <p className="max-w-xs">Escribe algo para interactuar con el Asistente Elite de Factoria.</p>
              </motion.div>
            )}

            {messages.map((msg, index) => {
              const isBot = msg.userId === "bot";
              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  className={cn(
                    "flex gap-3 max-w-[85%]",
                    isBot ? "self-start" : "self-end flex-row-reverse"
                  )}
                >
                  <div className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-1",
                    isBot ? "bg-indigo-600/20 text-indigo-400" : "bg-zinc-700/50 text-zinc-300"
                  )}>
                    {isBot ? <Bot size={18} /> : <User size={18} />}
                  </div>
                  
                  <div className="space-y-1">
                    <div className={cn(
                      "px-4 py-3 rounded-2xl text-sm leading-relaxed",
                      isBot 
                        ? "bg-zinc-800/80 text-zinc-100 rounded-tl-none border border-zinc-700/50" 
                        : "bg-indigo-600 text-white rounded-tr-none shadow-lg shadow-indigo-600/10"
                    )}>
                      {msg.text}
                    </div>
                    <p className="text-[10px] text-zinc-500 px-1 pt-1 opacity-50">
                      {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </motion.div>
              );
            })}

            {isLoading && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex gap-3 self-start"
              >
                <div className="w-8 h-8 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center">
                  <Bot size={18} />
                </div>
                <div className="px-4 py-3 rounded-2xl bg-zinc-800/80 border border-zinc-700/50 rounded-tl-none flex items-center gap-2">
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce [animation-delay:-0.3s]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce [animation-delay:-0.15s]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce" />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Input Form */}
      <form 
        onSubmit={handleSend}
        className="relative group"
      >
        <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-sky-500 rounded-2xl blur opacity-25 group-focus-within:opacity-50 transition duration-500" />
        <div className="relative flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-2xl p-2 pl-4">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="¿En qué puedo ayudarte hoy?"
            className="flex-1 bg-transparent border-none focus:ring-0 text-white placeholder-zinc-500 text-sm py-2"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center transition-all",
              input.trim() && !isLoading 
                ? "bg-indigo-600 text-white hover:bg-indigo-500" 
                : "bg-zinc-800 text-zinc-500 cursor-not-allowed"
            )}
          >
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </button>
        </div>
      </form>
      
      <p className="text-center mt-6 text-zinc-600 text-[10px] tracking-widest uppercase">
        Powered by Factoria Chat SDK & OpenAI
      </p>
    </div>
  );
}
