export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase-admin";
import { requireHub } from "@/lib/hub";

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireHub();
  if (!auth.ok) return auth.res;

  const { id } = await params;
  const supabase = getSupabase();
  const { error } = await supabase
    .from("hub_photos")
    .delete()
    .eq("id", id)
    .eq("user_id", auth.session.user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
