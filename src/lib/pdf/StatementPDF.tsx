import React from "react";
import { Document, Page, Text, View, StyleSheet, Font, Image } from "@react-pdf/renderer";

// 한글 폰트 등록 (Google Fonts - Noto Sans KR)
Font.register({
  family: "NotoSansKR",
  fonts: [
    { src: "https://cdn.jsdelivr.net/gh/spoqa/spoqa-han-sans@latest/Subset/SpoqaHanSansNeo/SpoqaHanSansNeo-Regular.woff", fontWeight: 400 },
    { src: "https://cdn.jsdelivr.net/gh/spoqa/spoqa-han-sans@latest/Subset/SpoqaHanSansNeo/SpoqaHanSansNeo-Bold.woff", fontWeight: 700 },
  ],
});

const s = StyleSheet.create({
  page: { fontFamily: "NotoSansKR", fontSize: 9, padding: 40, color: "#222" },
  header: { textAlign: "center", fontSize: 22, fontWeight: 700, letterSpacing: 15, paddingVertical: 8, borderTop: "2px solid #333", borderBottom: "2px solid #333", marginBottom: 16 },
  orderNo: { fontSize: 9, color: "#555", marginBottom: 12 },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 12 },
  leftInfo: { flex: 1 },
  bold: { fontWeight: 700 },
  infoTable: { width: 280 },
  infoRow: { flexDirection: "row", borderBottom: "1px solid #333" },
  infoTh: { backgroundColor: "#f5f5f5", padding: 4, fontWeight: 700, fontSize: 8, borderRight: "1px solid #333", borderLeft: "1px solid #333" },
  infoTd: { padding: 4, fontSize: 8, borderRight: "1px solid #333", flex: 1 },
  title: { fontSize: 13, fontWeight: 700, marginVertical: 10 },
  table: { width: "100%", marginBottom: 10 },
  tableHeader: { flexDirection: "row", backgroundColor: "#f0f0f0", borderTop: "1px solid #333", borderBottom: "1px solid #333" },
  tableRow: { flexDirection: "row", borderBottom: "1px solid #ccc" },
  th: { padding: 5, fontSize: 8, fontWeight: 700, textAlign: "center", borderRight: "1px solid #ccc", borderLeft: "1px solid #ccc" },
  td: { padding: 5, fontSize: 8, borderRight: "1px solid #ccc", borderLeft: "1px solid #ccc" },
  tdCenter: { textAlign: "center" },
  tdRight: { textAlign: "right" },
  summaryRow: { flexDirection: "row", justifyContent: "flex-end", marginTop: 4 },
  summaryTable: { flexDirection: "row", borderTop: "1px solid #333", borderBottom: "1px solid #333" },
  sumTh: { backgroundColor: "#f0f0f0", padding: 6, fontWeight: 700, fontSize: 9, borderRight: "1px solid #333", borderLeft: "1px solid #333" },
  sumTd: { padding: 6, fontSize: 9, textAlign: "right", borderRight: "1px solid #333", minWidth: 70 },
});

function fmt(n: number) { return (n || 0).toLocaleString(); }

export interface StatementPDFProps {
  order: { order_no: string; client_name: string; title: string; total_amount: number; total_supply: number; total_vat: number; discount: number; trade_type?: string; order_date?: string; created_at: string; order_items?: Array<{ sort_order: number; data: Record<string, string> }> };
  company: { company_name: string; business_number: string; representative: string; address: string; business_type: string; business_category: string; phone: string; email: string; seal_image?: string; bank_name?: string; bank_account?: string; bank_holder?: string; bank_name_2?: string; bank_account_2?: string; bank_holder_2?: string; bank_name_3?: string; bank_account_3?: string; bank_holder_3?: string };
  type?: "statement" | "estimate";
  colOrder?: string[];
  bankIdx?: number;
}

export default function StatementPDF({ order, company, type = "statement", colOrder = [], bankIdx = 1 }: StatementPDFProps) {
  const rawItems = (order.order_items || []).sort((a, b) => a.sort_order - b.sort_order).map(it => it.data);
  let lastNonEmptyIdx = -1;
  rawItems.forEach((d, i) => {
    const hasContent = Object.entries(d).some(([k, v]) => k !== "_bold" && v);
    if (hasContent) lastNonEmptyIdx = i;
  });
  const items = rawItems.slice(0, lastNonEmptyIdx + 1);
  const rawKeys = items.length > 0 ? Object.keys(items[0]) : [];
  const allKeys = colOrder.length > 0 ? colOrder.filter(k => rawKeys.includes(k)) : rawKeys;
  const supplyKey = allKeys.find(k => k.includes("공급")) || "";
  const vatKey = allKeys.find(k => k.includes("부가")) || "";

  const supplyTotal = items.reduce((acc, d) => acc + (supplyKey && d[supplyKey] ? parseInt(d[supplyKey]) || 0 : 0), 0);
  const vatTotal = items.reduce((acc, d) => acc + (vatKey && d[vatKey] ? parseInt(d[vatKey]) || 0 : 0), 0);
  const colCount = allKeys.length;
  const discount = order.discount || 0;
  const grandTotal = (order.total_amount || 0) - discount;
  const orderDate = new Date(order.order_date || order.created_at);
  const dateStr = `${orderDate.getFullYear()}년 ${String(orderDate.getMonth() + 1).padStart(2, "0")}월 ${String(orderDate.getDate()).padStart(2, "0")}일`;
  const isEstimate = type === "estimate";
  const docTitle = isEstimate ? "견 적 서" : "거 래 명 세 서";
  const dateLabel = isEstimate ? "견적일" : "납품일";
  const desc = isEstimate ? "아래와 같이 견적드립니다." : "아래와 같이 납품합니다.";
  const emptyRows = Math.max(8 - items.length, 0);

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <Text style={s.orderNo}>No. {order.order_no}</Text>
        <Text style={s.header}>{docTitle}</Text>

        <View style={s.row}>
          <View style={s.leftInfo}>
            <Text style={[s.bold, { marginBottom: 3 }]}>{dateLabel}: {dateStr}</Text>
            <Text style={[s.bold, { marginBottom: 8 }]}>업체명: {order.client_name} 귀하</Text>
            <Text>{desc}</Text>
          </View>
          <View style={s.infoTable}>
            <View style={[s.infoRow, { borderTop: "1px solid #333" }]}>
              <Text style={[s.infoTh, { width: 65 }]}>등록번호</Text>
              <Text style={[s.infoTd]}>{company.business_number || "-"}</Text>
            </View>
            <View style={s.infoRow}>
              <Text style={[s.infoTh, { width: 65 }]}>상호</Text>
              <Text style={[s.infoTd, { width: 80 }]}>{company.company_name}</Text>
              <Text style={[s.infoTh, { width: 35 }]}>성명</Text>
              <View style={[s.infoTd, { flexDirection: "row", alignItems: "center" }]}>
                <Text>{company.representative || "-"}</Text>
                {company.seal_image && <Image src={company.seal_image} style={{ width: 30, height: 30, marginLeft: 4, objectFit: "contain" }} />}
              </View>
            </View>
            <View style={s.infoRow}>
              <Text style={[s.infoTh, { width: 65 }]}>주소</Text>
              <Text style={[s.infoTd]}>{company.address || "-"}</Text>
            </View>
            <View style={s.infoRow}>
              <Text style={[s.infoTh, { width: 65 }]}>업태</Text>
              <Text style={[s.infoTd, { width: 80 }]}>{company.business_type || "-"}</Text>
              <Text style={[s.infoTh, { width: 35 }]}>종목</Text>
              <Text style={[s.infoTd]}>{company.business_category || "-"}</Text>
            </View>
            <View style={s.infoRow}>
              <Text style={[s.infoTh, { width: 65 }]}>TEL/E-mail</Text>
              <Text style={[s.infoTd]}>{company.phone || "-"} / {company.email || "-"}</Text>
            </View>
          </View>
        </View>

        {isEstimate && (
          <View style={{ border: "2px solid #c00", padding: 8, marginBottom: 8, flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={[s.bold, { fontSize: 11 }]}>금 액</Text>
            <Text style={{ fontSize: 11, color: "#c00", fontWeight: 700 }}>공급가액(₩ {fmt(grandTotal)}원){order.trade_type !== "cash" ? " / VAT포함" : ""}</Text>
          </View>
        )}

        <Text style={s.title}>작업명: {order.title}</Text>

        <View style={s.table}>
          <View style={s.tableHeader}>
            <Text style={[s.th, { width: 25 }]}>순번</Text>
            {allKeys.map((k, i) => (
              <Text key={k} style={[s.th, i === 0 ? { flex: 1 } : { width: colCount > 7 ? 50 : 60 }]}>{k}</Text>
            ))}
          </View>
          {items.map((d, i) => {
            const isBold = d._bold === "1";
            const isEmpty = !Object.entries(d).some(([k, v]) => k !== "_bold" && v);
            return (
              <View key={i} style={s.tableRow}>
                <Text style={[s.td, s.tdCenter, { width: 25 }]}>{isEmpty ? " " : i + 1}</Text>
                {allKeys.map((k, j) => {
                  const val = d[k] || "";
                  const isNum = /^\d+$/.test(val);
                  const num = isNum ? parseInt(val) : NaN;
                  const displayVal = isNum ? (num === 0 ? "" : fmt(num)) : val;
                  const isNameCol = k.includes("품목") || k.includes("품명") || k.includes("작업");
                  return <Text key={k} style={[s.td, isNum ? s.tdRight : {}, j === 0 ? { flex: 1 } : { width: colCount > 7 ? 50 : 60 }, isNameCol ? { fontSize: 10 } : {}, isBold && isNameCol ? { fontWeight: 700 } : {}]}>{displayVal}</Text>;
                })}
              </View>
            );
          })}
          {Array.from({ length: emptyRows }, (_, i) => (
            <View key={`e${i}`} style={s.tableRow}>
              <Text style={[s.td, { width: 25 }]}> </Text>
              {allKeys.map((k, j) => (
                <Text key={k} style={[s.td, j === 0 ? { flex: 1 } : { width: colCount > 7 ? 50 : 60 }]}> </Text>
              ))}
            </View>
          ))}
        </View>

        <View style={s.summaryRow}>
          <View style={s.summaryTable}>
            <Text style={s.sumTh}>공급가액 합계</Text>
            <Text style={[s.sumTd, order.trade_type === "cash" ? { fontWeight: 700 } : {}]}>{fmt(supplyTotal)}</Text>
            {order.trade_type !== "cash" && <>
              <Text style={s.sumTh}>부가세 합계</Text>
              <Text style={s.sumTd}>{fmt(vatTotal)}</Text>
              {discount > 0 && <>
                <Text style={[s.sumTh, { color: "#c00" }]}>할인</Text>
                <Text style={[s.sumTd, { color: "#c00" }]}>-{fmt(discount)}</Text>
              </>}
              <Text style={s.sumTh}>총 합계</Text>
              <Text style={[s.sumTd, { fontWeight: 700 }]}>{fmt(grandTotal)}</Text>
            </>}
          </View>
        </View>

        {(() => {
          const suffix = bankIdx === 1 ? "" : `_${bankIdx}`;
          const name = (company as unknown as Record<string,string>)[`bank_name${suffix}`];
          const acc = (company as unknown as Record<string,string>)[`bank_account${suffix}`];
          const holder = (company as unknown as Record<string,string>)[`bank_holder${suffix}`];
          if (!name && !acc && !holder) return null;
          return (
            <View style={{ marginTop: 20, paddingTop: 8, borderTop: "1px solid #666", flexDirection: "row", fontSize: 9 }}>
              <Text style={{ fontWeight: 700, marginRight: 6 }}>※ 입금 계좌:</Text>
              {name && <Text style={{ marginRight: 8 }}>{name}</Text>}
              {acc && <Text style={{ marginRight: 8, fontWeight: 700 }}>{acc}</Text>}
              {holder && <Text>(예금주: {holder})</Text>}
            </View>
          );
        })()}
      </Page>
    </Document>
  );
}
