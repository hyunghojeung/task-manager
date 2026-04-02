import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase-admin";
import { getApiSession, unauthorized } from "@/lib/api-helpers";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getApiSession();
  if (!session) return unauthorized();
  const { id } = await params;
  const { items } = await request.json();
  const supabase = getSupabase();

  // 기존 품목 삭제
  await supabase.from("order_items").delete().eq("order_id", id);

  // 새 품목 저장
  if (items && items.length > 0) {
    const rows = items.map((item: {sort_order: number; data: Record<string,string>}) => ({
      order_id: id,
      sort_order: item.sort_order,
      data: item.data,
    }));
    await supabase.from("order_items").insert(rows);
  }

  return NextResponse.json({ success: true });
}
