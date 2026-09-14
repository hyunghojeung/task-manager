import { createHash, randomBytes } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

// 쇼핑몰(blackcopy.co.kr) → Bcount 단방향 연동.
// 쇼핑몰이 보낸 주문을 기존 작업(orders) 한 건으로 만든다. 화면 칸은 그대로 두고 값만 채운다.

/* ===== API 키 ===== */

export function generateApiKey() {
  // bck_live_ + 40자. 평문은 발급 순간에만 보여주고 해시만 저장한다.
  const raw = randomBytes(30).toString("base64url").slice(0, 40);
  return `bck_live_${raw}`;
}

export function hashApiKey(key: string) {
  return createHash("sha256").update(key).digest("hex");
}

/** Authorization: Bearer <키> 로 업체를 찾는다. 없으면 null */
export async function findIntegrationByKey(supabase: SupabaseClient, authHeader: string | null) {
  const m = /^Bearer\s+(\S+)$/i.exec(authHeader || "");
  if (!m) return null;
  const { data } = await supabase
    .from("company_integrations")
    .select("id, company_id, category_name, template_name")
    .eq("kind", "shop")
    .eq("api_key_hash", hashApiKey(m[1]))
    .maybeSingle();
  return data;
}

/* ===== 쇼핑몰이 보내는 주문 ===== */

export interface ShopItem { title: string; spec?: string; size?: string; qty: number; supply?: number; vat?: number; amount: number }
export interface ShopOrderPayload {
  external_order_id: string;
  ordered_at?: string;
  customer: { name: string; phone?: string; email?: string; company?: string };
  product_type?: string;
  items: ShopItem[];
  price?: { cover?: number; inner?: number; bind?: number; finish?: number; ship?: number; sub?: number; vat?: number; total?: number };
  shipping?: { method?: string; recipient?: string; zip?: string; address1?: string; address2?: string; mobile?: string; tel?: string; memo?: string; boxes?: number };
  payment?: { method?: string; status?: "pending" | "paid"; depositor?: string; paid_at?: string };
  files?: { name: string; url: string }[];
  note?: string;
}

export function validatePayload(p: unknown): string | null {
  const b = p as Partial<ShopOrderPayload>;
  if (!b || typeof b !== "object") return "본문이 비어 있습니다";
  if (!b.external_order_id) return "external_order_id 가 없습니다";
  if (!b.customer?.name) return "customer.name 이 없습니다";
  if (!Array.isArray(b.items) || b.items.length === 0) return "items 가 비어 있습니다";
  for (const it of b.items) if (!it.title || typeof it.amount !== "number") return "items 에는 title 과 amount 가 있어야 합니다";
  return null;
}

const won = (n?: number) => (Math.round(n || 0)).toLocaleString("ko-KR");

function fmtKst(iso?: string) {
  const d = iso ? new Date(iso) : new Date();
  if (isNaN(d.getTime())) return iso || "";
  const s = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
  // "2026. 09. 14. 10:22" → "2026-09-14 10:22"
  return s.replace(/\.\s?/g, "-").replace(/-\s*(\d{2}:\d{2})$/, " $1").replace(/-$/, "");
}

function fmtMd(iso?: string) {
  const d = iso ? new Date(iso) : new Date();
  const s = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric" }).format(d);
  return s.replace(/\.\s?/g, "/").replace(/\/$/, "");
}

/** 세부사양 칸에 들어갈 텍스트 — 주문 내용 전체. 애매한 항목도 전부 여기에 남긴다 */
export function buildDetailSpec(p: ShopOrderPayload) {
  const lines: string[] = [];
  lines.push(`[쇼핑몰 주문 ${p.external_order_id}] ${fmtKst(p.ordered_at)}`);

  lines.push("■ 품목");
  for (const it of p.items) {
    lines.push(`${it.title}${it.qty ? ` × ${it.qty}` : ""}`);
    if (it.spec) lines.push(it.spec);
  }

  if (p.price) {
    const pr = p.price;
    lines.push("", "■ 금액");
    const parts: string[] = [];
    if (pr.cover != null) parts.push(`표지인쇄비 ${won(pr.cover)}`);
    if (pr.inner != null) parts.push(`내지인쇄비 ${won(pr.inner)}`);
    if (pr.bind != null) parts.push(`제본비 ${won(pr.bind)}`);
    if (pr.finish != null) parts.push(`후가공비 ${won(pr.finish)}`);
    if (pr.ship != null) parts.push(`배송비 ${won(pr.ship)}`);
    if (parts.length) lines.push(parts.join(" / "));
    lines.push(`소계 ${won(pr.sub)} / VAT ${won(pr.vat)} / 최종금액 ${won(pr.total)}`);
  }

  const pay = p.payment;
  lines.push("", "■ 결제");
  lines.push(`${pay?.method || "무통장입금"}${pay?.depositor ? ` (입금자 ${pay.depositor})` : ""} — ${pay?.status === "paid" ? `입금완료 ${fmtKst(pay.paid_at)}` : "입금대기"}`);

  const s = p.shipping;
  if (s) {
    lines.push("", "■ 배송");
    lines.push([s.method, [s.recipient, s.mobile].filter(Boolean).join(" "), s.tel].filter(Boolean).join(" / "));
    lines.push(`${s.zip ? `[${s.zip}] ` : ""}${[s.address1, s.address2].filter(Boolean).join(" ")}`);
    if (s.boxes && s.boxes > 1) lines.push(`박스 ${s.boxes}개`);
    if (s.memo) lines.push(`메모: ${s.memo}`);
  }

  lines.push("", "■ 파일");
  if (p.files && p.files.length) for (const f of p.files) lines.push(`${f.name} (${f.url})`);
  else lines.push("아직 없음 — 고객이 올리면 자동 추가");

  if (p.note) lines.push("", "■ 요청사항", p.note);
  return lines.join("\n");
}

/** 품목 표양식 "단가계산없이 공급가액만 입력" 행 — 제품별 1행 + 배송비 1행 */
export function buildItems(p: ShopOrderPayload) {
  const rows: Record<string, string>[] = [];
  for (const it of p.items) {
    const supply = it.supply ?? Math.round(it.amount / 1.1);
    const vat = it.vat ?? it.amount - supply;
    rows.push({ 품목명: it.title, 규격: it.size || "", 수량: String(it.qty || ""), 공급가액: String(supply), 부가세: String(vat), 합계금액: String(it.amount) });
  }
  const ship = p.price?.ship || 0;
  if (ship > 0) {
    const supply = Math.round(ship / 1.1);
    rows.push({ 품목명: `배송비 (${p.shipping?.method || "택배"})`, 규격: "", 수량: "1", 공급가액: String(supply), 부가세: String(ship - supply), 합계금액: String(ship) });
  }
  return rows;
}

/** 오늘 날짜 기준 다음 주문번호 (기존 작업등록과 같은 규칙: YYYYMMDD-n) */
export async function nextOrderNo(supabase: SupabaseClient, companyId: string) {
  const d = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  const dateStr = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const { data: last } = await supabase
    .from("orders").select("order_no").eq("company_id", companyId)
    .like("order_no", `${dateStr}%`).order("order_no", { ascending: false }).limit(1).maybeSingle();
  let n = 1;
  if (last?.order_no) {
    const num = parseInt(last.order_no.split("-").pop() || "");
    if (!isNaN(num)) n = num + 1;
  }
  return `${dateStr}-${n}`;
}

export function paymentMemo(p: ShopOrderPayload) {
  const method = p.payment?.method || "무통장";
  const short = method.replace("입금", "");
  return p.payment?.status === "paid" ? `${short} · 입금완료 ${fmtMd(p.payment.paid_at)}` : `${short} · 입금대기`;
}

export function paidMemo(paidAt?: string) {
  return `무통장 · 입금완료 ${fmtMd(paidAt)}`;
}

export function paidLine(paidAt?: string, depositor?: string) {
  return `\n\n■ 입금 확인 ${fmtKst(paidAt)}${depositor ? ` (입금자 ${depositor})` : ""}`;
}

/** 쇼핑몰 주문 한 건을 작업으로 등록한다. 같은 주문번호가 있으면 기존 것을 돌려준다 */
export async function registerShopOrder(
  supabase: SupabaseClient,
  integ: { company_id: string; category_name: string | null; template_name: string | null },
  p: ShopOrderPayload,
): Promise<{ order_no: string; duplicate: boolean; error?: string }> {
  const companyId = integ.company_id;

  const { data: existing } = await supabase
    .from("orders").select("order_no").eq("company_id", companyId).eq("external_order_id", p.external_order_id).maybeSingle();
  if (existing) return { order_no: existing.order_no, duplicate: true };

  // 카테고리: 설정된 이름(기본 '블랙카피')과 같은 것. 없으면 비움
  const { data: cat } = await supabase.from("categories").select("id").eq("company_id", companyId).eq("name", integ.category_name || "블랙카피").maybeSingle();

  // 표양식: 설정된 이름 → '단가계산…'으로 시작하는 것 → 업체 기본
  let templateName = integ.template_name || null;
  if (!templateName) {
    const { data: t } = await supabase.from("form_templates").select("name").eq("company_id", companyId).like("name", "단가계산%").limit(1).maybeSingle();
    templateName = t?.name || null;
  }
  if (!templateName) {
    const { data: t } = await supabase.from("form_templates").select("name").eq("company_id", companyId).eq("is_default", true).limit(1).maybeSingle();
    templateName = t?.name || null;
  }

  const items = buildItems(p);
  const sum = (k: string) => items.reduce((a, r) => a + (parseInt(r[k]) || 0), 0);
  const totalSupply = p.price?.sub ?? sum("공급가액");
  const totalVat = p.price?.vat ?? sum("부가세");
  const totalAmount = p.price?.total ?? sum("합계금액");

  const orderNo = await nextOrderNo(supabase, companyId);
  const orderDate = p.ordered_at ? fmtKst(p.ordered_at).slice(0, 10) : undefined;

  const { data: order, error } = await supabase.from("orders").insert({
    company_id: companyId,
    order_no: orderNo,
    ...(orderDate ? { order_date: orderDate } : {}),
    client_name: p.customer.company || "",          // 거래처는 비워두고 직접 입력한다
    orderer: p.customer.name,
    contact: p.customer.phone || "",
    email: p.customer.email || "",
    product_type: p.product_type || "",
    title: `[몰] ${p.external_order_id}`,           // 임시 제목 — 비면 리스트에 안 보이므로
    category_id: cat?.id || null,
    trade_type: "vat",
    tax_invoice: "",
    payment: paymentMemo(p),
    detail_spec: buildDetailSpec(p),
    status: "progress",
    total_supply: totalSupply,
    total_vat: totalVat,
    total_amount: totalAmount,
    template_name: templateName,
    source: "shop",
    external_order_id: p.external_order_id,
    paid_at: p.payment?.status === "paid" ? (p.payment.paid_at || new Date().toISOString()) : null,
  }).select("id, order_no").single();

  if (error || !order) return { order_no: "", duplicate: false, error: error?.message || "작업 등록 실패" };

  if (items.length) await supabase.from("order_items").insert(items.map((data, i) => ({ order_id: order.id, sort_order: i, data })));

  if (p.files?.length) {
    await supabase.from("attachments").insert(p.files.map((f) => ({ order_id: order.id, file_name: f.name, dropbox_url: f.url })));
  }

  const s = p.shipping;
  if (s) {
    await supabase.from("shipments").insert({
      order_id: order.id,
      recipient: s.recipient || p.customer.name,
      zip: s.zip || "",
      address1: s.address1 || "",
      address2: s.address2 || "",
      mobile: s.mobile || p.customer.phone || "",
      tel: s.tel || "",
      method: s.method || "택배선불",
      memo: s.memo || "",
      box_count: s.boxes && s.boxes > 0 ? s.boxes : 1,
    });
  }

  return { order_no: order.order_no, duplicate: false };
}
