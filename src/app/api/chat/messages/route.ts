import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { bot } from "@/lib/chat/bot"; // Trigger initialization

export async function GET(request: Request) {
  console.log("[API] Messages requested. Bot initialized status:", !!bot);
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId") || "user-123";
  const threadId = searchParams.get("threadId") || `web:${userId}`;

  const { data, error } = await supabase
    .from("chat_messages")
    .select("*")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[API] Error fetching messages:", error);
    return NextResponse.json([], { status: 500 });
  }

  // Transform Supabase records to the format expected by the frontend
  const messages = (data || []).map(msg => ({
    id: msg.id,
    text: msg.text,
    userId: msg.user_id,
    role: msg.role,
    createdAt: msg.created_at,
  }));

  return NextResponse.json(messages);
}
