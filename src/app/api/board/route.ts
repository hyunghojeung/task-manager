export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase-admin";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = 20;
  const keyword = searchParams.get("keyword") || "";
  const supabase = getSupabase();
  const from = (page - 1) * limit;

  let query = supabase.from("board_posts").select("*", { count: "exact" }).order("created_at", { ascending: false });
  if (keyword) query = query.or(`title.ilike.%${keyword}%,content.ilike.%${keyword}%`);
  query = query.range(from, from + limit - 1);

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 각 게시글의 댓글 수 조회
  const result = [];
  for (const post of data || []) {
    const { count: commentCount } = await supabase.from("board_comments").select("*", { count: "exact", head: true }).eq("post_id", post.id);
    result.push({ ...post, comment_count: commentCount || 0 });
  }

  return NextResponse.json({ data: result, total: count, page, limit });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  if (!body.title || !body.author || !body.password) {
    return NextResponse.json({ error: "제목, 작성자, 비밀번호를 입력해주세요." }, { status: 400 });
  }
  const supabase = getSupabase();
  const { data, error } = await supabase.from("board_posts").insert({ title: body.title, content: body.content || "", author: body.author, password: body.password }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
