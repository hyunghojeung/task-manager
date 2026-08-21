import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { renderToBuffer } from "@react-pdf/renderer";
import { getApiSession, unauthorized } from "@/lib/api-helpers";
import { getSupabase } from "@/lib/supabase-admin";
import StatementPDF from "@/lib/pdf/StatementPDF";

export async function POST(request: NextRequest) {
  const session = await getApiSession();
  if (!session) return unauthorized();

  const { to, orderId, type, customSubject, customFrom, bankIdx, mailIdx, bankbookIdx, bizRegIdx } = await request.json();
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

  // 업체 정보 조회 (모든 컬럼 필요 - 이메일 계정 3개 + 첨부 파일 3세트)
  const { data: company } = await supabase
    .from("companies")
    .select("*")
    .eq("id", session.company.id)
    .single();

  if (!company) return NextResponse.json({ error: "업체 정보를 찾을 수 없습니다." }, { status: 404 });

  // 템플릿 컬럼 순서 조회 - template_name 우선, 없으면 키 매칭
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

  // PDF 생성
  const isEstimate = type === "estimate";
  const subject = isEstimate ? "견적서" : "거래명세서";

  try {
    const pdfBuffer = await renderToBuffer(
      <StatementPDF order={order} company={company} type={isEstimate ? "estimate" : "statement"} colOrder={colOrder} bankIdx={bankIdx || company.default_bank || 1} />
    );

    // 이메일 계정 선택 (mailIdx 1/2/3, 없으면 default_mail, 없으면 1)
    const chosenMail = parseInt(String(mailIdx || company.default_mail || 1));
    const mailSuffix = chosenMail === 1 ? "" : `_${chosenMail}`;
    const mailId = company[`mail_id${mailSuffix}`] || company.mail_id || "blackcopy2";
    const mailPassword = company[`mail_password${mailSuffix}`] || company.mail_password || process.env.NAVER_PASSWORD || "";
    const mailEmail = company[`mail_email${mailSuffix}`] || company.mail_email || "blackcopy2@naver.com";
    const mailService = company[`mail_service${mailSuffix}`] || company.mail_service || "naver";

    if (!mailPassword) {
      return NextResponse.json({ error: "선택한 이메일 계정의 비밀번호가 설정되지 않았습니다." }, { status: 400 });
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

    const fromName = customFrom || company.company_name;
    const emailSubject = customSubject || `[${company.company_name}] ${subject} - ${order.title || order.order_no}`;

    // 첨부 파일 배열 구성
    const attachments: Array<{filename: string; content: Buffer; contentType?: string}> = [{
      filename: `${subject}_${order.order_no}.pdf`,
      content: Buffer.from(pdfBuffer),
      contentType: "application/pdf",
    }];

    // 통장사본 첨부
    const bankbookSlot = parseInt(String(bankbookIdx || 0));
    if (bankbookSlot >= 1 && bankbookSlot <= 3) {
      const url = company[`bankbook_url_${bankbookSlot}`];
      const label = company[`bankbook_label_${bankbookSlot}`] || "통장사본";
      if (url) {
        try {
          const r = await fetch(url);
          if (r.ok) {
            const ext = url.split(".").pop()?.split("?")[0] || "pdf";
            const ct = r.headers.get("content-type") || "application/octet-stream";
            attachments.push({ filename: `${label}.${ext}`, content: Buffer.from(await r.arrayBuffer()), contentType: ct });
          }
        } catch { /* 첨부 실패는 무시 */ }
      }
    }

    // 사업자등록증 첨부
    const bizRegSlot = parseInt(String(bizRegIdx || 0));
    if (bizRegSlot >= 1 && bizRegSlot <= 3) {
      const url = company[`biz_reg_url_${bizRegSlot}`];
      const label = company[`biz_reg_label_${bizRegSlot}`] || "사업자등록증";
      if (url) {
        try {
          const r = await fetch(url);
          if (r.ok) {
            const ext = url.split(".").pop()?.split("?")[0] || "pdf";
            const ct = r.headers.get("content-type") || "application/octet-stream";
            attachments.push({ filename: `${label}.${ext}`, content: Buffer.from(await r.arrayBuffer()), contentType: ct });
          }
        } catch { /* 첨부 실패는 무시 */ }
      }
    }

    await transporter.sendMail({
      from: `"${fromName}" <${mailEmail}>`,
      to,
      subject: emailSubject,
      html: `<p>${fromName}에서 보낸 ${subject}입니다.</p><p>첨부된 파일을 확인해주세요.</p>`,
      attachments,
    });

    return NextResponse.json({ success: true, attached: attachments.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : "PDF 생성 또는 이메일 발송 실패";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
