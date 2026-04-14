import { Chat, Thread, Message, Channel } from "chat";
import { createTelegramAdapter } from "@chat-adapter/telegram";
import { WebAdapter } from "./web-adapter";
import OpenAI from "openai";
import { supabase } from "@/lib/supabase";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// In-memory state store — implements every method the Chat SDK may call
const memStore: Record<string, any> = {};
const memLocks: Record<string, string> = {};
const memLists: Record<string, any[]> = {};
const memQueues: Record<string, any[]> = {};
const memSubscriptions: Set<string> = new Set();

const stateAdapter = {
  // Key-value
  get: async (key: string) => memStore[key] ?? null,
  set: async (key: string, value: any) => { memStore[key] = value; },
  setIfNotExists: async (key: string, value: any) => {
    if (memStore[key] !== undefined) return false;
    memStore[key] = value;
    return true;
  },
  delete: async (key: string) => { delete memStore[key]; },

  // Lists
  appendToList: async (key: string, value: any) => {
    if (!memLists[key]) memLists[key] = [];
    memLists[key].push(value);
  },
  getListNewest: async (key: string, limit = 20) =>
    (memLists[key] ?? []).slice(-limit).reverse(),
  getListOldest: async (key: string, limit = 20) =>
    (memLists[key] ?? []).slice(0, limit),

  // Queues
  enqueue: async (key: string, value: any) => {
    if (!memQueues[key]) memQueues[key] = [];
    memQueues[key].push(value);
  },
  dequeue: async (key: string) => (memQueues[key] ?? []).shift() ?? null,
  queueDepth: async (key: string) => (memQueues[key] ?? []).length,

  // Subscriptions
  subscribe: async (key: string) => { memSubscriptions.add(key); },
  unsubscribe: async (key: string) => { memSubscriptions.delete(key); },
  isSubscribed: async (key: string) => memSubscriptions.has(key),

  // Locks
  acquireLock: async (key: string) => {
    const token = `lock-${Date.now()}`;
    memLocks[key] = token;
    return token;
  },
  releaseLock: async (key: string, _token: string) => { delete memLocks[key]; },
  extendLock: async (key: string, _token: string, _ttl: number) => true,
  forceReleaseLock: async (key: string) => { delete memLocks[key]; },

  // Connection lifecycle
  connect: async () => {},
  disconnect: async () => {},
};

export const adapter = new WebAdapter();

export const bot = new Chat({
  userName: "AI Concierge",
  state: stateAdapter as any,
  adapters: {
    web: adapter,
    telegram: createTelegramAdapter(),
  },
});

// ─── Helpers ────────────────────────────────────────────────────────────────

async function upsertConversation(threadId: string, userId: string, userName: string, platform: string) {
  console.log(`[Bot] Upserting conversation: ${threadId} for user: ${userName} (${userId})`);
  const { error } = await supabase.from("conversations").upsert(
    { 
      thread_id: threadId, 
      platform, 
      user_id: String(userId), 
      user_name: userName, 
      updated_at: new Date().toISOString() 
    },
    { onConflict: "thread_id" }
  );
  if (error) {
    console.error(`[Bot] upsertConversation error for ${threadId}:`, error.message, error.details);
  } else {
    console.log(`[Bot] Conversation ${threadId} upserted successfully.`);
  }
}

async function saveMessage(threadId: string, userId: string, text: string, role: "user" | "bot") {
  console.log(`[Bot] Saving message to ${threadId} from ${userId} (${role})`);
  const { error } = await supabase
    .from("chat_messages")
    .insert([{ 
      thread_id: threadId, 
      user_id: String(userId), 
      text, 
      role 
    }]);
  if (error) {
    console.error(`[Bot] saveMessage error for ${threadId}:`, error.message, error.details);
  } else {
    console.log(`[Bot] Message saved to ${threadId}.`);
  }
}

async function getHistory(threadId: string, limit = 20) {
  const { data, error } = await supabase
    .from("chat_messages")
    .select("role, text")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) console.error("[Bot] getHistory error:", error.message);
  return data ?? [];
}

async function replyWithAI(thread: any, threadId: string, userText: string) {
  console.log(`[Bot] Generating AI reply for thread ${threadId}...`);
  const history = await getHistory(threadId);

  const openAIMsgs: { role: "system" | "user" | "assistant"; content: string }[] = [
    { role: "system", content: "Eres un asistente de lujo 'Elite'. Responde de forma profesional y concisa." },
    ...history.map((row: any) => ({
      role: (row.role === "bot" ? "assistant" : "user") as "user" | "assistant",
      content: row.text,
    })),
  ];

  // Avoid duplicating the last user message if already in history
  const lastMsg = openAIMsgs[openAIMsgs.length - 1];
  if (!lastMsg || !(lastMsg.role === "user" && lastMsg.content === userText)) {
    openAIMsgs.push({ role: "user", content: userText });
  }

  try {
    const result = await openai.chat.completions.create({ model: "gpt-4o", messages: openAIMsgs });
    const reply = result.choices[0].message.content ?? "Lo siento, no pude procesar tu solicitud.";

    console.log(`[Bot] Posting reply to ${threadId}`);
    await thread.post(reply);
    
    // Save bot message
    await saveMessage(threadId, "bot", reply, "bot");
    console.log(`[Bot] Replied and registered message for thread ${threadId}`);
  } catch (err: any) {
    console.error(`[Bot] Error in replyWithAI for ${threadId}:`, err.message);
    await thread.post("Lo siento, tuve un problema técnico.");
  }
}

// ─── Handlers ────────────────────────────────────────────────────────────────

// First message in a DM / mention (not yet subscribed)
async function handleFirstMessage(thread: any, message: any) {
  const threadId: string = thread.id;
  const userId = String(message.userId ?? "unknown");
  const platform = threadId.startsWith("telegram:") ? "telegram" : "web";
  const userName: string = message.userName ?? message.from?.username ?? message.from?.first_name ?? (platform === "telegram" ? "Usuario de Telegram" : userId);
  const text: string = message.text ?? "";

  console.log(`[Bot] First message | thread: ${threadId} | user: ${userName} | text: ${text}`);

  // 1. Create/update conversation record
  await upsertConversation(threadId, userId, userName, platform);

  // 2. Save user message
  await saveMessage(threadId, userId, text, "user");

  // 3. Subscribe so subsequent messages go to onSubscribedMessage
  await thread.subscribe();

  // 4. Reply
  await replyWithAI(thread, threadId, text);
}

// Follow-up messages in an already-subscribed thread
async function handleFollowUp(thread: any, message: any) {
  const threadId: string = thread.id;
  const userId = String(message.userId ?? "unknown");
  const platform = threadId.startsWith("telegram:") ? "telegram" : "web";
  const userName: string = message.userName ?? message.from?.username ?? message.from?.first_name ?? (platform === "telegram" ? "Usuario de Telegram" : userId);
  const text: string = message.text ?? "";

  console.log(`[Bot] Follow-up | thread: ${threadId} | user: ${userName} | text: ${text}`);

  // Update conversation timestamp and ensure record exists
  await upsertConversation(threadId, userId, userName, platform);

  await saveMessage(threadId, userId, text, "user");
  await replyWithAI(thread, threadId, text);
}

// onNewMention: signature is (thread, message, context?)
bot.onNewMention(async (thread: any, message: any) => {
  await handleFirstMessage(thread, message);
});

// onDirectMessage: signature is (thread, message, channel, context?)
bot.onDirectMessage(async (thread: any, message: any) => {
  await handleFirstMessage(thread, message);
});

// onSubscribedMessage: fired for all messages in subscribed threads
bot.onSubscribedMessage(async (thread: any, message: any) => {
  await handleFollowUp(thread, message);
});

// ─── Initialize once ─────────────────────────────────────────────────────────

if (!(global as any).botInstance) {
  (global as any).botInstance = bot;
  console.log("[Bot] Initializing Chat SDK...");
  bot
    .initialize()
    .then(() => console.log("[Bot] Ready. Adapters: web + telegram"))
    .catch((err: any) => console.error("[Bot] Init failed:", err?.message ?? err));
}
