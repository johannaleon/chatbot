import { bot, handleBotLogic, adapter } from "@/lib/chat/bot";

export async function POST(request: Request) {
  try {
    const bodyText = await request.text();
    const body = JSON.parse(bodyText);

    // Re-create request for Chat SDK
    const sdkRequest = new Request(request.url, {
      method: request.method,
      headers: request.headers,
      body: bodyText,
    });

    const sdkResponse = await bot.webhooks.web(sdkRequest);

    if (sdkResponse.ok) {
      const { text, userId } = body;
      const threadId = `web:${userId || "default"}`;
      const threadMock: any = {
        id: threadId,
        channelId: "web-channel",
        subscribe: async () => Promise.resolve(),
        post: async (message: any) => {
          return adapter.postMessage(threadId, message);
        },
      };

      await handleBotLogic(threadMock, {
        text,
        userId: userId || "user",
        createdAt: new Date(),
      });
    }

    return sdkResponse;
  } catch (err) {
    console.error("[Webhook] Crash in POST:", err);
    return new Response(JSON.stringify({ error: "Internal Error" }), { 
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
