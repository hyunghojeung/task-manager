import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { getApiSession, unauthorized } from "@/lib/api-helpers";
import { getSupabase } from "@/lib/supabase-admin";

export async function POST(request: NextRequest) {
  const session = await getApiSession();
  if (!session) return unauthorized();

  const { to, subject, html, image } = await request.json();

  if (!to || !subject) {
    return NextResponse.json({ error: "수신 이메일과 제목을 입력해주세요." }, { status: 400 });
  }

  // 업체의 이메일 설정 조회
  const supabase = getSupabase();
  const { data: company } = await supabase
    .from("companies")
    .select("mail_service, smtp_server, smtp_port, mail_email, mail_id, mail_password")
    .eq("id", session.company.id)
    .single();

  // DB 설정 또는 환경변수 사용
  const mailId = company?.mail_id || "blackcopy2";
  const mailPassword = company?.mail_password || process.env.NAVER_PASSWORD || "";
  const mailEmail = company?.mail_email || "blackcopy2@naver.com";
  const mailService = company?.mail_service || "naver";

  if (!mailPassword) {
    return NextResponse.json({ error: "이메일 발송 설정이 완료되지 않았습니다. 관리자 > 업체정보설정에서 설정해주세요." }, { status: 400 });
  }

  const smtpConfig = {
    naver: { host: "smtp.naver.com", port: 587, secure: false },
    daum: { host: "smtp.daum.net", port: 587, secure: false },
  };

  const config = smtpConfig[mailService as keyof typeof smtpConfig] || smtpConfig.naver;

  try {
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      requireTLS: true,
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 10000,
      auth: {
        user: mailId,
        pass: mailPassword,
      },
    });

    const mailOptions: Record<string, unknown> = { from: mailEmail, to, subject };
    if (image) {
      // base64 이미지를 인라인 첨부
      const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
      mailOptions.html = '<div style="font-family:sans-serif;"><img src="cid:document-image" style="max-width:100%;height:auto;" /></div>';
      mailOptions.attachments = [{
        filename: `${subject}.png`,
        content: base64Data,
        encoding: "base64",
        cid: "document-image",
      }];
    } else {
      mailOptions.html = html || "";
    }

    await transporter.sendMail(mailOptions);

    return NextResponse.json({ success: true, message: "이메일이 발송되었습니다." });
  } catch (err) {
    const message = err instanceof Error ? err.message : "이메일 발송에 실패했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
