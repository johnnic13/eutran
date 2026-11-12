// GET /api/news?country=FRA
// Returns recent transport headlines for the country's capital, from the Google News RSS search feed.
// Responses are cached at Netlify's edge for 15 minutes.
import cities from "./cities.mjs";

// Search terms: specific transport phrases, not bare words like "train" or "airport" that match sport and crime stories.
const TOPICS = '(metro OR subway OR underground OR tram OR "public transport" OR "public transit" OR "rail strike" OR "train strike" OR "bus strike" OR "transport strike" OR "train services" OR "rail services" OR "railway" OR "bus network" OR "bus lines" OR "ticket prices" OR "fares" OR "airport train" OR "airport rail" OR "airport transfer" OR "S-Bahn" OR "U-Bahn" OR "RER")';

export function feedUrl(city, window = "7d") {
  const q = `"${city}" ${TOPICS} when:${window}`;
  return "https://news.google.com/rss/search?" + new URLSearchParams({ q, hl: "en-GB", gl: "GB", ceid: "GB:en" });
}

// Second pass on the headline itself: it must be about getting around, and not about sport, showbiz or markets.
const ABOUT_TRANSPORT = /\b(metro|subway|underground|tube|tram|trams|bus|buses|coach|train|trains|rail|railway|railways|rail link|transit|transport|commuters?|station|stations|timetable|timetables|fares?|\w*tickets?\w*|ticketing|day pass|travel card|strike|strikes|walkout|disruption|delays?|cancell?ed|cancellations?|signal(?:ling)?|S-Bahn|U-Bahn|RER|Eurostar|Interrail|Eurail|Flixbus|line closure|service)\b/i;
const NOT_TRAVEL = /\b(football|soccer|rugby|tennis|basketball|league|fixtures?|transfer window|striker|goal|concert|album|film|movie|series|celebrity|stocks?|shares|investors?|earnings|real estate|property prices|obituary|killed|murder|stabbed|stabbing|shooting|arrested|court|trial)\b/i;

export function isRelevant(title) {
  return ABOUT_TRANSPORT.test(title) && !NOT_TRAVEL.test(title);
}

// Drops repeats of the same story from different outlets (compares the first words of the headline).
export function dedupe(items) {
  const seen = new Set();
  return items.filter((i) => {
    const key = i.title.toLowerCase().replace(/[^a-z0-9 ]/g, "").split(/\s+/).slice(0, 7).join(" ");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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
    const load = async (window) => {
      const res = await fetch(feedUrl(entry.city, window), { headers: { "user-agent": "EuroTransitGuide/1.0" } });
      if (!res.ok) throw new Error(`feed HTTP ${res.status}`);
      return dedupe(parseFeed(await res.text(), 40).filter((i) => isRelevant(i.title)));
    };
    let items = await load("7d");
    if (items.length < 3) items = await load("30d"); // quiet week: look back a month
    items = items.slice(0, 8);
    return json({ city: entry.city, items, updated: new Date().toISOString() });
  } catch (err) {
    console.error(err);
    return json({ error: "News is not available right now" }, 502, false);
  }
};

export const config = { path: "/api/news" };
