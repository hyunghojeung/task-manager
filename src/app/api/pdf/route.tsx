import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { getApiSession, unauthorized } from "@/lib/api-helpers";
import { getSupabase } from "@/lib/supabase-admin";
import StatementPDF from "@/lib/pdf/StatementPDF";

export async function GET(request: NextRequest) {
  const session = await getApiSession();
  if (!session) return unauthorized();

  const { searchParams } = new URL(request.url);
  const orderId = searchParams.get("id");
  const type = searchParams.get("type") || "statement";

  if (!orderId) return NextResponse.json({ error: "주문 ID가 필요합니다." }, { status: 400 });

  const supabase = getSupabase();

  const { data: order } = await supabase
    .from("orders")
    .select("*, order_items(*)")
    .eq("id", orderId)
    .eq("company_id", session.company.id)
    .single();

  if (!order) return NextResponse.json({ error: "주문을 찾을 수 없습니다." }, { status: 404 });

  const { data: company } = await supabase
    .from("companies")
    .select("company_name, business_number, representative, address, business_type, business_category, phone, email")
    .eq("id", session.company.id)
    .single();

  if (!company) return NextResponse.json({ error: "업체 정보를 찾을 수 없습니다." }, { status: 404 });

  try {
    const isEstimate = type === "estimate";
    const subject = isEstimate ? "견적서" : "거래명세서";

    const pdfBuffer = await renderToBuffer(
      <StatementPDF order={order} company={company} type={isEstimate ? "estimate" : "statement"} />
    );

    return new NextResponse(Buffer.from(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(subject)}_${order.order_no}.pdf"`,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "PDF 생성 실패";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
