import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { renderToBuffer } from "@react-pdf/renderer";
import { getApiSession, unauthorized } from "@/lib/api-helpers";
import { getSupabase } from "@/lib/supabase-admin";
import StatementPDF from "@/lib/pdf/StatementPDF";

export async function POST(request: NextRequest) {
  const session = await getApiSession();
  if (!session) return unauthorized();

  const { to, orderId, type } = await request.json();
  if (!to || !orderId) {
    return NextResponse.json({ error: "수신 이메일과 주문 ID를 입력해주세요." }, { status: 400 });
  }

  const supabase = getSupabase();

  // 주문 데이터 조회
  const { data: order } = await supabase
    .from("orders")
    .select("*, order_items(*)")
    .eq("id", orderId)
    .eq("company_id", session.company.id)
    .single();

  if (!order) return NextResponse.json({ error: "주문을 찾을 수 없습니다." }, { status: 404 });

  // 업체 정보 조회
  const { data: company } = await supabase
    .from("companies")
    .select("company_name, business_number, representative, address, business_type, business_category, phone, email, mail_service, mail_email, mail_id, mail_password")
    .eq("id", session.company.id)
    .single();

  if (!company) return NextResponse.json({ error: "업체 정보를 찾을 수 없습니다." }, { status: 404 });

  // 템플릿 컬럼 순서 조회 - 주문 항목과 가장 일치하는 템플릿 사용
  const { data: templates } = await supabase.from("form_templates").select("columns, is_default").eq("company_id", session.company.id).order("sort_order");
  const itemKeys = new Set(Object.keys((order.order_items || []).sort((a: {sort_order:number}, b: {sort_order:number}) => a.sort_order - b.sort_order)[0]?.data || {}));
  let bestTmpl = templates?.[0];
  let bestMatch = 0;
  for (const t of templates || []) {
    const colNames = (t.columns || []).filter((c: {type:string}) => c.type !== "auto").map((c: {name:string}) => c.name);
    const match = colNames.filter((n: string) => itemKeys.has(n)).length;
    if (match > bestMatch) { bestMatch = match; bestTmpl = t; }
  }
  const colOrder = bestTmpl?.columns?.filter((c: {type:string}) => c.type !== "auto").map((c: {name:string}) => c.name) || [];

  // PDF 생성
  const isEstimate = type === "estimate";
  const subject = isEstimate ? "견적서" : "거래명세서";

  try {
    const pdfBuffer = await renderToBuffer(
      <StatementPDF order={order} company={company} type={isEstimate ? "estimate" : "statement"} colOrder={colOrder} />
    );

    // 이메일 설정
    const mailId = company.mail_id || "blackcopy2";
    const mailPassword = company.mail_password || process.env.NAVER_PASSWORD || "";
    const mailEmail = company.mail_email || "blackcopy2@naver.com";
    const mailService = company.mail_service || "naver";

    if (!mailPassword) {
      return NextResponse.json({ error: "이메일 발송 설정이 완료되지 않았습니다." }, { status: 400 });
    }

    const smtpConfig: Record<string, { host: string; port: number; secure: boolean }> = {
      naver: { host: "smtp.naver.com", port: 587, secure: false },
      daum: { host: "smtp.daum.net", port: 587, secure: false },
    };
    const config = smtpConfig[mailService] || smtpConfig.naver;

    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      requireTLS: true,
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 10000,
      auth: { user: mailId, pass: mailPassword },
    });

    await transporter.sendMail({
      from: mailEmail,
      to,
      subject: `[${company.company_name}] ${subject} - ${order.title || order.order_no}`,
      html: `<p>${company.company_name}에서 보낸 ${subject}입니다.</p><p>첨부된 PDF 파일을 확인해주세요.</p>`,
      attachments: [{
        filename: `${subject}_${order.order_no}.pdf`,
        content: Buffer.from(pdfBuffer),
        contentType: "application/pdf",
      }],
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "PDF 생성 또는 이메일 발송 실패";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
