import { streamText, convertToModelMessages } from "ai";
import { openai } from "@ai-sdk/openai";
import { supabase } from "@/lib/supabase";

export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const { messages, threadId: providedThreadId, model: requestedModel } = await req.json();
    const userId = "user-123";
    const modelId = requestedModel || "gpt-4o";

    const threadId = providedThreadId || `web:${userId}`;
    const platform = threadId.startsWith("telegram:") ? "telegram" : "web";

    // Extract user content and handle attachments
    const latestMessage = messages[messages.length - 1];
    let userContent = "";
    
    // Check for attachments (like voice notes)
    const attachments = latestMessage?.experimental_attachments || [];
    const audioAttachment = attachments.find((a: any) => a.contentType?.startsWith("audio/"));

    if (audioAttachment && audioAttachment.url) {
      console.log("[API] Audio attachment detected, transcribing...");
      try {
        const response = await fetch(audioAttachment.url);
        const blob = await response.blob();
        
        // Use OpenAI Whisper for transcription
        const formData = new FormData();
        formData.append("file", blob, "audio.webm");
        formData.append("model", "whisper-1");

        const whisperRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
          },
          body: formData,
        });

        const whisperData = await whisperRes.json();
        if (whisperData.text) {
          userContent = whisperData.text;
          console.log("[API] Transcription success:", userContent);
          
          // Inject transcription into the latest message for the LLM
          if (latestMessage.parts) {
            latestMessage.parts.push({ type: "text", text: `(Transcripción del audio): ${userContent}` });
          } else {
            latestMessage.content = userContent;
          }
        }
      } catch (err) {
        console.error("[API] Transcription error:", err);
      }
    }

    if (!userContent && latestMessage && latestMessage.role === "user") {
      userContent = typeof latestMessage.content === "string"
        ? latestMessage.content
        : (latestMessage.parts?.filter((p: any) => p.type === "text").map((p: any) => p.text).join("") || "");
    }

    // Save user message to DB
    if (userContent) {
      const descriptiveName = userContent.split(" ").slice(0, 5).join(" ") +
        (userContent.split(" ").length > 5 ? "..." : "");

      console.log(`[API] Saving user message to thread: ${threadId}`);
      
      const { error: convError } = await supabase.from("conversations").upsert({
        thread_id: threadId,
        platform,
        user_id: userId,
        user_name: descriptiveName,
        updated_at: new Date().toISOString(),
      }, { onConflict: "thread_id" });

      if (convError) console.error("[API] Error upserting conversation:", convError.message);

      const { error: msgError } = await supabase.from("chat_messages").insert([{
        thread_id: threadId,
        user_id: userId,
        text: userContent,
        role: "user",
      }]);

      if (msgError) console.error("[API] Error inserting user message:", msgError.message);
    }

    console.log(`[API] Using model: ${modelId} for thread: ${threadId} (${platform})`);
    
    const result = streamText({
      model: openai(modelId),
      messages: await convertToModelMessages(messages),
      system: "Eres un asistente de lujo 'Elite'. Responde de forma profesional, concisa y con un tono distinguido.",
      async onFinish({ text: botReply }) {
        console.log(`[API] onFinish called. Reply length: ${botReply?.length || 0}`);
        
        // Save bot reply to DB
        const { error: insertError } = await supabase.from("chat_messages").insert([{
          thread_id: threadId,
          user_id: "bot",
          text: botReply,
          role: "bot",
        }]);
        if (insertError) {
          console.error("[API] Error inserting bot message:", insertError.message);
        } else {
          console.log(`[API] Bot reply saved to DB for thread: ${threadId}`);
        }

        // If telegram thread, forward via Telegram Bot API
        if (platform === "telegram") {
          const chatId = threadId.replace("telegram:", "");
          const token = process.env.TELEGRAM_BOT_TOKEN;
          console.log(`[API] Attempting Telegram forward to chatId: ${chatId}`);
          if (token && chatId) {
            try {
              const teleRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ chat_id: chatId, text: botReply }),
              });
              const teleData = await teleRes.json();
              if (teleData.ok) {
                console.log(`[API] ✅ Telegram message sent to ${chatId}`);
              } else {
                console.error(`[API] ❌ Telegram API error:`, teleData);
              }
            } catch (teleError) {
              console.error("[API] Error forwarding to Telegram:", teleError);
            }
          } else {
            console.warn(`[API] Missing token or chatId. Token: ${token ? 'present' : 'missing'}, ChatId: ${chatId}`);
          }
        }
      },
    });

    // consumeStream ensures onFinish runs even if the client disconnects
    return result.toUIMessageStreamResponse();
  } catch (error: any) {
    console.error("[API] Error in chat/stream:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
