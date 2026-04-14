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
  const bankIdx = parseInt(searchParams.get("bankIdx") || "0") || undefined;

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
    .select("company_name, business_number, representative, address, business_type, business_category, phone, email, seal_image, bank_name, bank_account, bank_holder, bank_name_2, bank_account_2, bank_holder_2, bank_name_3, bank_account_3, bank_holder_3, default_bank")
    .eq("id", session.company.id)
    .single();

  if (!company) return NextResponse.json({ error: "업체 정보를 찾을 수 없습니다." }, { status: 404 });

  const { data: templates } = await supabase.from("form_templates").select("name, columns").eq("company_id", session.company.id).order("sort_order");
  let matchedTmpl = order.template_name ? templates?.find((t: {name:string}) => t.name === order.template_name) : null;
  if (!matchedTmpl && (order.order_items || []).length > 0) {
    const itemKeys = new Set(Object.keys((order.order_items || []).sort((a: {sort_order:number}, b: {sort_order:number}) => a.sort_order - b.sort_order)[0]?.data || {}));
    let bestMatch = 0;
    for (const t of templates || []) {
      const colNames = (t.columns || []).filter((c: {type:string}) => c.type !== "auto").map((c: {name:string}) => c.name);
      const match = colNames.filter((n: string) => itemKeys.has(n)).length;
      if (match > bestMatch) { bestMatch = match; matchedTmpl = t; }
    }
  }
  if (!matchedTmpl) matchedTmpl = templates?.[0];
  const colOrder = matchedTmpl?.columns?.filter((c: {type:string}) => c.type !== "auto").map((c: {name:string}) => c.name) || [];

  try {
    const isEstimate = type === "estimate";
    const subject = isEstimate ? "견적서" : "거래명세서";

    const pdfBuffer = await renderToBuffer(
      <StatementPDF order={order} company={company} type={isEstimate ? "estimate" : "statement"} colOrder={colOrder} bankIdx={bankIdx || company.default_bank || 1} />
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
