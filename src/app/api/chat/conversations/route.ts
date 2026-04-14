import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const { data, error } = await supabase
    .from("conversations")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("[API] Error fetching conversations:", error);
    return NextResponse.json([], { status: 500 });
  }

  return NextResponse.json(data || []);
}
