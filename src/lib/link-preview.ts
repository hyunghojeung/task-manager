import { lookup } from "node:dns/promises";

/** 메모에 적은 URL 의 미리보기 — 카톡 링크 카드와 같은 정보 */
export interface LinkPreview {
  url: string;
  title: string;
  description: string;
  image: string;
  site: string;
}

const CACHE = new Map<string, { at: number; data: LinkPreview | null }>();
const CACHE_TTL = 60 * 60 * 1000; // 1시간
const MAX_BYTES = 512 * 1024; // 앞부분 512KB 만 읽는다 (메타 태그는 head 에 있다)
const TIMEOUT = 5000;

/** 본문에서 URL 을 뽑는다. 순서 유지, 중복 제거, 최대 5개 */
export function extractUrls(text: string): string[] {
  const out: string[] = [];
  const re = /https?:\/\/[^\s<>"'`]+/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text || "")) !== null) {
    const u = m[0].replace(/[.,;:!?)\]}>]+$/, ""); // 문장 끝 구두점 제거
    if (!out.includes(u)) out.push(u);
    if (out.length >= 5) break;
  }
  return out;
}

/** 사내망·내 컴퓨터 주소로 요청이 나가지 않게 막는다 */
function isPrivateIp(ip: string) {
  if (ip.includes(":")) {
    return ip === "::1" || ip.startsWith("fc") || ip.startsWith("fd") || ip.startsWith("fe80") || ip.startsWith("::ffff:");
  }
  const p = ip.split(".").map(Number);
  return (
    p[0] === 10 ||
    p[0] === 127 ||
    p[0] === 0 ||
    (p[0] === 169 && p[1] === 254) ||
    (p[0] === 172 && p[1] >= 16 && p[1] <= 31) ||
    (p[0] === 192 && p[1] === 168)
  );
}

async function isSafeUrl(raw: string): Promise<URL | null> {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  const host = u.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) return null;
  try {
    const { address } = await lookup(host);
    if (isPrivateIp(address)) return null;
  } catch {
    return null;
  }
  return u;
}

function decodeEntities(s: string) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .trim();
}

/** <meta ...> 태그들에서 property/name → content 로 정리한다 */
function parseMeta(html: string) {
  const meta: Record<string, string> = {};
  const tagRe = /<meta\b[^>]*>/gi;
  const attrRe = /([a-zA-Z_:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g;
  let t: RegExpExecArray | null;
  while ((t = tagRe.exec(html)) !== null) {
    const attrs: Record<string, string> = {};
    let a: RegExpExecArray | null;
    attrRe.lastIndex = 0;
    while ((a = attrRe.exec(t[0])) !== null) {
      attrs[a[1].toLowerCase()] = a[2] ?? a[3] ?? a[4] ?? "";
    }
    const key = (attrs.property || attrs.name || "").toLowerCase();
    if (key && attrs.content && !meta[key]) meta[key] = decodeEntities(attrs.content);
  }
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (title) meta["__title"] = decodeEntities(title[1].replace(/\s+/g, " "));
  return meta;
}

export async function fetchLinkPreview(raw: string): Promise<LinkPreview | null> {
  const hit = CACHE.get(raw);
  if (hit && Date.now() - hit.at < CACHE_TTL) return hit.data;

  const u = await isSafeUrl(raw);
  if (!u) return null;

  let data: LinkPreview | null = null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT);
  try {
    const res = await fetch(u.toString(), {
      signal: ctrl.signal,
      redirect: "follow",
      headers: {
        // 일부 사이트는 브라우저처럼 보이지 않으면 메타를 안 준다
        "User-Agent": "Mozilla/5.0 (compatible; BcountLinkPreview/1.0; +https://blackcopy.kr)",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "ko,en;q=0.8",
      },
    });
    const type = res.headers.get("content-type") || "";
    if (res.ok && type.includes("html") && res.body) {
      // 앞부분만 읽는다
      const reader = res.body.getReader();
      const chunks: Uint8Array[] = [];
      let total = 0;
      while (total < MAX_BYTES) {
        const { done, value } = await reader.read();
        if (done || !value) break;
        chunks.push(value);
        total += value.length;
      }
      reader.cancel().catch(() => {});
      const html = Buffer.concat(chunks).toString("utf8");
      const meta = parseMeta(html);

      const finalUrl = res.url || u.toString();
      let image = meta["og:image"] || meta["og:image:url"] || meta["twitter:image"] || "";
      if (image && !/^https?:\/\//i.test(image)) {
        try {
          image = new URL(image, finalUrl).toString();
        } catch {
          image = "";
        }
      }
      const title = meta["og:title"] || meta["twitter:title"] || meta["__title"] || "";
      const description = meta["og:description"] || meta["twitter:description"] || meta["description"] || "";
      const site = meta["og:site_name"] || new URL(finalUrl).hostname.replace(/^www\./, "");

      if (title || description || image) {
        data = {
          url: raw,
          title: title.slice(0, 200),
          description: description.slice(0, 300),
          image: image.slice(0, 1000),
          site: site.slice(0, 100),
        };
      }
    }
  } catch {
    data = null;
  } finally {
    clearTimeout(timer);
  }

  // 실패한 주소도 잠시 기억해서 계속 두드리지 않게 한다
  CACHE.set(raw, { at: Date.now(), data });
  if (CACHE.size > 500) {
    const oldest = [...CACHE.entries()].sort((a, b) => a[1].at - b[1].at).slice(0, 100);
    oldest.forEach(([k]) => CACHE.delete(k));
  }
  return data;
}

/** 저장 요청으로 들어온 미리보기 목록을 검증한다 — 본문에 있는 주소만, 최대 5개 */
export function sanitizePreviews(input: unknown, content: string): LinkPreview[] {
  if (!Array.isArray(input)) return [];
  const allowed = new Set(extractUrls(content));
  const out: LinkPreview[] = [];
  for (const p of input) {
    if (!p || typeof p !== "object") continue;
    const o = p as Record<string, unknown>;
    const url = String(o.url || "");
    if (!allowed.has(url) || out.some((x) => x.url === url)) continue;
    out.push({
      url,
      title: String(o.title || "").slice(0, 200),
      description: String(o.description || "").slice(0, 300),
      image: /^https?:\/\//i.test(String(o.image || "")) ? String(o.image).slice(0, 1000) : "",
      site: String(o.site || "").slice(0, 100),
    });
    if (out.length >= 5) break;
  }
  return out;
}
