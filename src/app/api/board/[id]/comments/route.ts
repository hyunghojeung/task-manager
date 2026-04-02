import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase-admin";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  if (!body.author || !body.password || !body.content) {
    return NextResponse.json({ error: "작성자, 비밀번호, 내용을 입력해주세요." }, { status: 400 });
  }
  const supabase = getSupabase();
  const { data, error } = await supabase.from("board_comments").insert({
    post_id: id, parent_id: body.parent_id || null, author: body.author, password: body.password, content: body.content
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
