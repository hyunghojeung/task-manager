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

export async function isSafeUrl(raw: string): Promise<URL | null> {
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

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/** 유튜브 영상 ID — youtu.be/ID, youtube.com/watch?v=ID, /shorts/ID, /live/ID, /embed/ID */
function youtubeId(u: URL): string | null {
  const host = u.hostname.replace(/^(www|m)\./, "");
  if (host === "youtu.be") return u.pathname.slice(1).split("/")[0] || null;
  if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (u.pathname === "/watch") return u.searchParams.get("v");
    const m = u.pathname.match(/^\/(shorts|live|embed|v)\/([^/?]+)/);
    if (m) return m[2];
  }
  return null;
}

/**
 * 유튜브는 일반 요청을 봇으로 보고 거절하므로 공식 미리보기 API(oEmbed)로 읽는다.
 * 제목·채널명·썸네일을 확실하게 준다.
 */
async function fetchYoutube(raw: string, id: string, signal: AbortSignal): Promise<LinkPreview | null> {
  const res = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}&format=json`, {
    signal,
    headers: { "User-Agent": BROWSER_UA, Accept: "application/json" },
  });
  if (!res.ok) return null;
  const j = (await res.json()) as { title?: string; author_name?: string; thumbnail_url?: string };
  if (!j.title) return null;
  return {
    url: raw,
    title: String(j.title).slice(0, 200),
    description: j.author_name ? `YouTube · ${j.author_name}` : "YouTube",
    // oEmbed 는 작은 썸네일을 주므로 큰 것으로 바꿔 쓴다 (없으면 브라우저가 못 불러와 숨겨진다)
    image: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    site: "YouTube",
  };
}

/** 네이버 블로그 PC 주소는 껍데기 페이지라 메타가 비어 있다. 모바일 주소로 읽는다. */
function fetchTarget(u: URL): string {
  const host = u.hostname.toLowerCase();
  if (host === "blog.naver.com") {
    const m = u.pathname.match(/^\/([^/]+)\/(\d+)/);
    if (m) return `https://m.blog.naver.com/${m[1]}/${m[2]}`;
    const id = u.searchParams.get("blogId");
    const no = u.searchParams.get("logNo");
    if (id && no) return `https://m.blog.naver.com/${id}/${no}`;
  }
  return u.toString();
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
    const yt = youtubeId(u);
    if (yt) {
      data = await fetchYoutube(raw, yt, ctrl.signal);
      if (data) {
        CACHE.set(raw, { at: Date.now(), data });
        return data;
      }
    }

    const res = await fetch(fetchTarget(u), {
      signal: ctrl.signal,
      redirect: "follow",
      headers: {
        // 브라우저처럼 보이지 않으면 메타를 안 주거나 거절하는 사이트가 많다
        "User-Agent": BROWSER_UA,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
      },
    });
    if (!res.ok) console.warn(`[link-preview] ${res.status} ${raw}`);
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
      // og:image 가 없으면 <link rel="image_src"> 도 본다
      const imageSrc = html.match(/<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["']/i)?.[1] || "";
      let image = meta["og:image"] || meta["og:image:url"] || meta["twitter:image"] || imageSrc || "";
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

/**
 * 저장 요청으로 들어온 링크 카드 목록을 검증한다 — 최대 5개.
 * 주소는 본문에서 빠져나와 카드로만 남으므로 본문과 대조하지 않는다.
 */
export function sanitizePreviews(input: unknown): LinkPreview[] {
  if (!Array.isArray(input)) return [];
  const out: LinkPreview[] = [];
  for (const p of input) {
    if (!p || typeof p !== "object") continue;
    const o = p as Record<string, unknown>;
    const url = String(o.url || "").slice(0, 2000);
    if (!/^https?:\/\//i.test(url) || out.some((x) => x.url === url)) continue;
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
