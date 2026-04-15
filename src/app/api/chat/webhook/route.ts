import { bot, handleBotLogic, adapter } from "@/lib/chat/bot";

// Desactivar el body-parser de Vercel/Next.js
export const config = {
  api: {
    bodyParser: false,
    externalResolver: true,
  },
};

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    // Leer el cuerpo sin que Next.js lo haya parseado (bodyParser está desactivado).
    const rawBody = await request.text();

    // Intentar determinar si es un update de Telegram sin parsear JSON completo.
    const isTelegramUpdate =
      rawBody.includes('update_id') ||
      rawBody.includes('message_id') ||
      rawBody.includes('"chat"') ||
      rawBody.includes('"text"');

    // Si parece un update de Telegram, delegamos al adaptador.
    if (isTelegramUpdate) {
      // Creamos una solicitud que conserva el cuerpo crudo.
      const sdkRequest = new Request(request.url, {
        method: request.method,
        headers: new Headers(request.headers),
        body: rawBody,
      });

      try {
        const result = await bot.webhooks.telegram(sdkRequest);
        return result;
      } catch (error) {
        console.error("[Webhook] Error processing Telegram update:", error);
        return new Response(JSON.stringify({ error: "Invalid Telegram update" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    // Caso de uso web (no Telegram). Intentamos parsear JSON para extraer "text".
    let body: any = null;
    if (rawBody.length > 0) {
      try {
        body = JSON.parse(rawBody);
      } catch (e) {
        console.error("[Webhook] Invalid JSON payload", e);
        return new Response(JSON.stringify({ error: "Invalid JSON" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    const sdkRequest = new Request(request.url, {
      method: request.method,
      headers: new Headers(request.headers),
      body: rawBody,
    });

    const sdkResponse = await bot.webhooks.web(sdkRequest);

    if (sdkResponse.ok && body && typeof body.text === "string") {
      const userId = typeof body.userId === "string" && body.userId.trim().length > 0 ? body.userId : "user";
      const threadId = typeof body.threadId === "string" && body.threadId.trim().length > 0 ? body.threadId : `web:${userId || "default"}`;

      const threadMock: any = {
        id: threadId,
        channelId: "web-channel",
        subscribe: async () => Promise.resolve(),
        post: async (message: any) => adapter.postMessage(threadId, message),
      };

      await handleBotLogic(threadMock, { text: body.text, userId, createdAt: new Date() });
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
