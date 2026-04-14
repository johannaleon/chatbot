import { Adapter, Message } from "chat";
import { supabase } from "@/lib/supabase";

export class WebAdapter implements Adapter {
  name = "web";

  async postMessage(threadId: string, message: any): Promise<any> {
    // Determine the text content
    const text = typeof message === "string" ? message : (message.text || "Mensaje interactivo");
    
    // Determine the role
    const role = (message as any).role || "bot";
    const userId = (message as any).userId || "bot";

    // No longer inserting here as it's handled by bot.onMessage
    return { id: Math.random().toString(36).substring(7) };
  }

  async handleWebhook(request: Request): Promise<Response> {
    try {
      const data = await request.json();
      const { text, userId } = data;
      // No longer inserting here as it's handled by bot.onMessage
      return new Response(JSON.stringify({ status: "ok" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 });
    }
  }

  // Not used in this custom implementation but required by interface
  async initialize() { return; }
  async getMessages() { return []; }
  async getThread() { return null; }
}
