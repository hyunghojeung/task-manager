"use client";

import { useCallback, useEffect, useState } from "react";

// 송장변환기 위에 얹는 "쇼핑몰 주문 불러오기" 띠.
// 변환기(public/tools/taekbae.html)는 손대지 않고, 고른 주문의 배송지를 탭 구분 텍스트로 만들어
// iframe 안 붙여넣기 칸(#paste)에 넣어준다. 그다음은 변환기가 지금처럼 파싱한다.

interface Row {
  shipment_id: string; order_id: string; order_no: string; orderer: string; title: string; payment: string; paid: boolean;
  product_type: string; status: string; recipient: string; zip: string; address1: string; address2: string;
  mobile: string; tel: string; method: string; memo: string; box_count: number; exported_at: string | null;
}

export default function ShopOrdersBar({ frameId }: { frameId: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [unpaid, setUnpaid] = useState(false);
  const [exported, setExported] = useState(false);
  const [open, setOpen] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/shop-shipments?unpaid=${unpaid ? 1 : 0}&exported=${exported ? 1 : 0}&_=${Date.now()}`);
    if (res.ok) { const d = await res.json(); setRows(d.data || []); }
    setPicked({});
  }, [unpaid, exported]);
  useEffect(() => { load(); }, [load]);

  const pickedRows = rows.filter((r) => picked[r.shipment_id]);

  // 변환기 parseCells 가 칸을 알아보는 순서: 수화인명, 우편번호, 주소, 전화, 휴대폰, 수량, 상품명, 비고, 정산구분
  function lineOf(r: Row, k: number) {
    const box = r.box_count > 1 ? ` (${k + 1}/${r.box_count})` : "";
    return [r.recipient, r.zip, `${r.address1} ${r.address2}`.trim(), r.tel, r.mobile, "1", r.product_type || "", (r.memo || "") + box, r.method === "택배착불" ? "착불" : "선불"].join("\t");
  }

  async function pushToConverter() {
    if (!pickedRows.length) { alert("주문을 먼저 선택하세요."); return; }
    const frame = document.getElementById(frameId) as HTMLIFrameElement | null;
    const paste = frame?.contentDocument?.getElementById("paste") as HTMLTextAreaElement | null;
    if (!paste) { alert("변환기가 아직 열리지 않았습니다. 잠시 후 다시 눌러주세요."); return; }

    const lines: string[] = [];
    for (const r of pickedRows) for (let k = 0; k < r.box_count; k++) lines.push(lineOf(r, k));
    paste.value = (paste.value ? paste.value + "\n" : "") + lines.join("\n");
    paste.dispatchEvent(new Event("input", { bubbles: true }));
    paste.focus();

    setBusy(true);
    await fetch("/api/shop-shipments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ shipment_ids: pickedRows.map((r) => r.shipment_id) }) });
    setBusy(false);
    await load();
    frame?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // 오프라인으로 보낸 주문 등: 변환기에 넣지 않고 목록에서만 뺀다
  async function markSent() {
    if (!pickedRows.length) { alert("주문을 먼저 선택하세요."); return; }
    if (!confirm(`${pickedRows.length}건을 발송 완료로 표시해 목록에서 뺄까요?\n("이미 내보낸 것·완료된 작업도 보기"를 켜면 다시 보입니다)`)) return;
    setBusy(true);
    await fetch("/api/shop-shipments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ shipment_ids: pickedRows.map((r) => r.shipment_id) }) });
    setBusy(false);
    await load();
  }

  const fmt = (iso: string | null) => iso ? new Date(iso).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }) : "";

  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 md:px-6 py-3 print:hidden">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 text-sm font-bold text-gray-800">
          <span>{open ? "▼" : "▶"}</span> 쇼핑몰 주문 불러오기
          <span className="text-xs font-normal text-gray-500">{rows.length}건</span>
        </button>
        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-600">
          <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={!unpaid} onChange={(e) => setUnpaid(!e.target.checked)} /> 입금대기 건 제외</label>
          <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={exported} onChange={(e) => setExported(e.target.checked)} /> 이미 내보낸 것·완료된 작업도 보기 (최근 15건)</label>
          <button onClick={load} className="px-2 py-1 border border-gray-300 rounded bg-white">새로고침</button>
        </div>
      </div>

      {open && (
        <div className="mt-2">
          {rows.length === 0 ? (
            <p className="text-xs text-gray-500 py-2">내보낼 쇼핑몰 주문이 없습니다.</p>
          ) : (
            <div className="overflow-x-auto bg-white border border-gray-200 rounded">
              <table className="w-full text-xs border-collapse">
                <thead><tr className="bg-gray-100 text-gray-700">
                  <th className="border-b border-gray-200 px-2 py-1.5"><input type="checkbox" aria-label="전체 선택" checked={rows.length > 0 && pickedRows.length === rows.length} onChange={(e) => { const all: Record<string, boolean> = {}; if (e.target.checked) rows.forEach((r) => { all[r.shipment_id] = true; }); setPicked(all); }} /></th>
                  <th className="border-b border-gray-200 px-2 py-1.5 text-left whitespace-nowrap">순번</th>
                  <th className="border-b border-gray-200 px-2 py-1.5 text-left whitespace-nowrap">주문자</th>
                  <th className="border-b border-gray-200 px-2 py-1.5 text-left whitespace-nowrap">제목</th>
                  <th className="border-b border-gray-200 px-2 py-1.5 text-left whitespace-nowrap">MEMO</th>
                  <th className="border-b border-gray-200 px-2 py-1.5 text-left whitespace-nowrap">수령인 / 연락처</th>
                  <th className="border-b border-gray-200 px-2 py-1.5 text-left">배송지</th>
                  <th className="border-b border-gray-200 px-2 py-1.5 text-left whitespace-nowrap">방법</th>
                  <th className="border-b border-gray-200 px-2 py-1.5 text-center whitespace-nowrap">박스</th>
                  <th className="border-b border-gray-200 px-2 py-1.5 text-left whitespace-nowrap">내보냄</th>
                </tr></thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.shipment_id} className={picked[r.shipment_id] ? "bg-amber-50" : "hover:bg-gray-50"}>
                      <td className="border-b border-gray-100 px-2 py-1.5 text-center"><input type="checkbox" aria-label="선택" checked={!!picked[r.shipment_id]} onChange={(e) => setPicked((p) => ({ ...p, [r.shipment_id]: e.target.checked }))} /></td>
                      <td className="border-b border-gray-100 px-2 py-1.5 whitespace-nowrap"><a href={`/dashboard/write?id=${r.order_id}`} className="hover:text-blue-600 hover:underline">{r.order_no}</a></td>
                      <td className="border-b border-gray-100 px-2 py-1.5 whitespace-nowrap">{r.orderer}</td>
                      <td className="border-b border-gray-100 px-2 py-1.5 max-w-[240px] truncate" title={r.title}>{r.title}</td>
                      <td className={`border-b border-gray-100 px-2 py-1.5 whitespace-nowrap ${r.paid ? "text-gray-600" : "text-red-600 font-semibold"}`}>{r.payment}</td>
                      <td className="border-b border-gray-100 px-2 py-1.5 whitespace-nowrap">{r.recipient} {r.mobile}</td>
                      <td className="border-b border-gray-100 px-2 py-1.5 min-w-[260px]">[{r.zip}] {r.address1} {r.address2}{r.memo && <span className="text-gray-400"> · {r.memo}</span>}</td>
                      <td className="border-b border-gray-100 px-2 py-1.5 whitespace-nowrap">{r.method}</td>
                      <td className="border-b border-gray-100 px-2 py-1.5 text-center">{r.box_count}</td>
                      <td className="border-b border-gray-100 px-2 py-1.5 whitespace-nowrap text-gray-400">{fmt(r.exported_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <button onClick={pushToConverter} disabled={busy || pickedRows.length === 0} className="px-4 py-2 bg-gray-700 text-white rounded text-sm font-medium disabled:opacity-50">
              선택한 주문을 변환기에 넣기{pickedRows.length ? ` (${pickedRows.length}건)` : ""}
            </button>
            <button onClick={markSent} disabled={busy || pickedRows.length === 0} className="px-3 py-2 border border-gray-300 rounded text-sm bg-white text-gray-700 disabled:opacity-50">
              발송 완료로 표시 (목록에서 빼기)
            </button>
            <span className="text-xs text-gray-500">아래 변환기의 붙여넣기 칸에 들어갑니다. 그다음 &quot;표에 넣기&quot; → &quot;엑셀 파일 받기&quot;. 박스가 여러 개면 그 수만큼 줄이 늘어납니다.</span>
          </div>
        </div>
      )}
    </div>
  );
}
