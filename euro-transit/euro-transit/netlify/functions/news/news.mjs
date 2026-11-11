// GET /api/news?country=FRA
// Returns recent transport headlines for the country's capital, from the Google News RSS search feed.
// Responses are cached at Netlify's edge for 15 minutes.
import cities from "./cities.mjs";

const TOPICS = '(metro OR train OR tram OR bus OR airport OR strike OR "public transport" OR railway)';

export function feedUrl(city) {
  const q = `"${city}" ${TOPICS} when:7d`;
  return "https://news.google.com/rss/search?" + new URLSearchParams({ q, hl: "en-GB", gl: "GB", ceid: "GB:en" });
}

function decodeEntities(s) {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, "&")
    .trim();
}
function tag(xml, name) {
  const m = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"));
  return m ? decodeEntities(m[1]) : "";
}

export function parseFeed(xml, limit = 8) {
  const items = [];
  const re = /<item>([\s\S]*?)<\/item>/gi;
  let m;
  while ((m = re.exec(xml)) && items.length < limit) {
    const block = m[1];
    const source = tag(block, "source");
    let title = tag(block, "title");
    if (source && title.endsWith(" - " + source)) title = title.slice(0, -(source.length + 3));
    const link = tag(block, "link");
    if (!title || !/^https?:\/\//.test(link)) continue;
    const date = tag(block, "pubDate");
    items.push({ title, link, source, date: date ? new Date(date).toISOString() : null });
  }
  return items;
}

function json(body, status = 200, cache = true) {
  const headers = { "content-type": "application/json; charset=utf-8" };
  if (cache) {
    headers["cache-control"] = "public, max-age=300";
    headers["netlify-cdn-cache-control"] = "public, s-maxage=900, stale-while-revalidate=3600";
  }
  return new Response(JSON.stringify(body), { status, headers });
}

export default async (req) => {
  const id = (new URL(req.url).searchParams.get("country") || "").toUpperCase();
  const entry = cities[id];
  if (!entry) return json({ error: "Unknown country code" }, 400, false);
  try {
    const res = await fetch(feedUrl(entry.city), { headers: { "user-agent": "EuroTransitGuide/1.0" } });
    if (!res.ok) throw new Error(`feed HTTP ${res.status}`);
    const items = parseFeed(await res.text());
    return json({ city: entry.city, items, updated: new Date().toISOString() });
  } catch (err) {
    console.error(err);
    return json({ error: "News is not available right now" }, 502, false);
  }
};

export const config = { path: "/api/news" };
