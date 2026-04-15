import { bot, handleBotLogic, adapter } from "@/lib/chat/bot";

// Desactivar el body-parser de Vercel/Next.js
// Es necesario para que Telegram envíe los updates en su formato original
export const config = {
  api: {
    bodyParser: false,
    externalResolver: true,
  },
};

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const bodyText = await request.text();
    let body: any = null;

    if (bodyText.length > 0) {
      try {
        body = JSON.parse(bodyText);
      } catch (parseError) {
        console.error("[Webhook] Invalid JSON payload", parseError);
        return new Response(JSON.stringify({ error: "Invalid JSON" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    const sdkRequest = new Request(request.url, {
      method: request.method,
      headers: new Headers(request.headers),
      body: bodyText,
    });

    const isTelegramUpdate = Boolean(
      body && (
        typeof body.update_id !== "undefined" ||
        body.message ||
        body.edited_message ||
        body.channel_post ||
        body.callback_query ||
        body.my_chat_member ||
        body.chat_member
      )
    );

    if (isTelegramUpdate) {
      return bot.webhooks.telegram(sdkRequest);
    }

    const sdkResponse = await bot.webhooks.web(sdkRequest);

    if (sdkResponse.ok && body && typeof body.text === "string") {
      const userId = typeof body.userId === "string" && body.userId.trim().length > 0
        ? body.userId
        : "user";
      const threadId = typeof body.threadId === "string" && body.threadId.trim().length > 0
        ? body.threadId
        : `web:${userId || "default"}`;

      const threadMock: any = {
        id: threadId,
        channelId: "web-channel",
        subscribe: async () => Promise.resolve(),
        post: async (message: any) => adapter.postMessage(threadId, message),
      };

      await handleBotLogic(threadMock, {
        text: body.text,
        userId,
        createdAt: new Date(),
      });
    }

    return sdkResponse;
  } catch (err) {
    console.error("[Webhook] Crash in POST:", err);
    return new Response(JSON.stringify({ error: "Internal Error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
