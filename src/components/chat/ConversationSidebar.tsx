"use client";

import React from "react";
import { MessageSquare, Calendar, ChevronRight, Search } from "lucide-react";
import { cn } from "@/lib/utils";

interface Conversation {
  id: string;
  thread_id: string;
  user_name: string;
  platform: string;
  updated_at: string;
}

interface ConversationSidebarProps {
  conversations: Conversation[];
  activeThreadId?: string;
  onSelectConversation: (threadId: string) => void;
  isLoading?: boolean;
}

export function ConversationSidebar({
  conversations,
  activeThreadId,
  onSelectConversation,
  isLoading,
}: ConversationSidebarProps) {
  return (
    <aside className="w-64 flex flex-col h-full bg-[#171717] text-[#ececec]">
      {/* Sidebar Header */}
      <div className="p-3">
        <button 
          onClick={() => onSelectConversation(`web:new-${Date.now()}`)}
          className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-[#2f2f2f] transition-all group"
        >
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-full bg-white flex items-center justify-center">
              <MessageSquare className="w-4 h-4 text-black" />
            </div>
            <span className="text-sm font-medium">Nuevo chat</span>
          </div>
          <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
      </div>

      {/* Navigation Icons Placeholder */}
      <div className="px-3 space-y-1 mb-4">
        <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-[#2f2f2f] cursor-pointer text-sm opacity-80">
          <Search className="w-4 h-4" />
          <span>Buscar</span>
        </div>
        <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-[#2f2f2f] cursor-pointer text-sm opacity-80">
          <Calendar className="w-4 h-4" />
          <span>Hoy</span>
        </div>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto px-2 space-y-0.5 custom-scrollbar">
        {isLoading ? (
          <div className="space-y-2 p-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-9 rounded-lg bg-[#2f2f2f]/50 animate-pulse" />
            ))}
          </div>
        ) : (
          conversations.map((conv) => (
            <button
              key={conv.thread_id}
              onClick={() => onSelectConversation(conv.thread_id)}
              className={cn(
                "w-full text-left px-3 py-2 rounded-lg transition-colors group relative flex items-center gap-2",
                activeThreadId === conv.thread_id
                  ? "bg-[#2f2f2f]"
                  : "hover:bg-[#2f2f2f]/50"
              )}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate">
                  {conv.user_name || conv.thread_id.split(':').pop() || 'Chat sin título'}
                </p>
              </div>
              <div className={cn(
                "px-1.5 py-0.5 rounded-[4px] text-[9px] font-bold uppercase shrink-0",
                conv.platform === 'telegram' ? "bg-blue-500/10 text-blue-400" : "bg-white/10 text-white/50"
              )}>
                {conv.platform === 'telegram' ? 'TG' : 'Web'}
              </div>
            </button>
          ))
        )}
      </div>

      {/* Sidebar Footer */}
      <div className="p-3 mt-auto border-t border-white/5">
        <div className="flex items-center gap-2 p-2 rounded-lg hover:bg-[#2f2f2f] cursor-pointer">
          <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex-shrink-0" />
          <span className="text-sm font-medium truncate">Elite Systems</span>
        </div>
      </div>
    </aside>
  );
}
