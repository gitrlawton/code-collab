import { supabase } from "@/lib/supabase";
import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const { roomId, content } = await request.json();

    if (!roomId || !content) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Update content in Supabase
    const { error } = await supabase
      .from("rooms")
      .update({ content })
      .eq("code", roomId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
