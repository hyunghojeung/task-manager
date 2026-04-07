import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase-admin";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getSupabase();
  // 조회수 증가
  const { data: post } = await supabase.from("board_posts").select("view_count").eq("id", id).single();
  if (post) await supabase.from("board_posts").update({ view_count: (post.view_count || 0) + 1 }).eq("id", id);
  const { data, error } = await supabase.from("board_posts").select("*").eq("id", id).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  // 댓글 조회
  const { data: comments } = await supabase.from("board_comments").select("*").eq("post_id", id).order("created_at", { ascending: true });
  return NextResponse.json({ ...data, comments: comments || [] });
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const supabase = getSupabase();
  // 비밀번호 확인
  const { data: post } = await supabase.from("board_posts").select("password").eq("id", id).single();
  if (!post || post.password !== body.password) return NextResponse.json({ error: "비밀번호가 일치하지 않습니다." }, { status: 403 });
  const { error } = await supabase.from("board_posts").update({ title: body.title, content: body.content, images: body.images || [], updated_at: new Date().toISOString() }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const supabase = getSupabase();
  const { data: post } = await supabase.from("board_posts").select("password").eq("id", id).single();
  if (!post || post.password !== body.password) return NextResponse.json({ error: "비밀번호가 일치하지 않습니다." }, { status: 403 });
  const { error } = await supabase.from("board_posts").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
