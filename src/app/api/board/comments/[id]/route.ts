import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase-admin";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const supabase = getSupabase();
  const { data: comment } = await supabase.from("board_comments").select("password").eq("id", id).single();
  if (!comment || comment.password !== body.password) return NextResponse.json({ error: "비밀번호가 일치하지 않습니다." }, { status: 403 });
  const { error } = await supabase.from("board_comments").update({ content: body.content }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const supabase = getSupabase();
  const { data: comment } = await supabase.from("board_comments").select("password").eq("id", id).single();
  if (!comment || comment.password !== body.password) return NextResponse.json({ error: "비밀번호가 일치하지 않습니다." }, { status: 403 });
  const { error } = await supabase.from("board_comments").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
