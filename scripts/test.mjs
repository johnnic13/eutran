// Basic checks: data files are valid and complete, and the news parser handles a sample feed.
import { readdir, readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { parseFeed, feedUrl } from "../netlify/functions/news/news.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, "data", "countries");
let n = 0;
for (const f of await readdir(dir)) {
  if (!f.endsWith(".json")) continue;
  const c = JSON.parse(await readFile(join(dir, f), "utf8"));
  assert.equal(c.id + ".json", f, `${f}: id does not match file name`);
  for (const m of ["train", "tram", "bus", "airport"]) {
    const d = c.modes[m];
    assert.ok(d && d.sum && d.sched && Array.isArray(d.tickets) && d.tickets.length, `${f}: incomplete ${m}`);
    if (d.link) assert.match(d.link[1], /^https:\/\//, `${f}: ${m} link must be https`);
  }
  for (const x of c.modes.train.destinations || []) {
    assert.ok(x.to && x.time && x.station && x.operator && /^(domestic|international)$/.test(x.type), `${f}: bad destination ${JSON.stringify(x)}`);
  }
  for (const m of ["train", "tram", "bus", "airport"]) assert.ok((c.modes[m].buy || []).length, `${f}: no "buy" info for ${m}`);
  assert.ok(Array.isArray(c.tips) && Array.isArray(c.apps), `${f}: tips/apps missing`);
  n++;
}
console.log(`ok - ${n} country files valid`);

// route hub guides
const rdir = join(root, "data", "routes");
const ids = new Set((await readdir(dir)).map((f) => f.replace(".json", "")));
let rn = 0;
for (const f of await readdir(rdir).catch(() => [])) {
  if (!f.endsWith(".json")) continue;
  const r = JSON.parse(await readFile(join(rdir, f), "utf8"));
  assert.equal(r.id + ".json", f, `${f}: id does not match file name`);
  assert.ok(ids.has(r.from.country) && ids.has(r.to.country), `${f}: unknown country code`);
  assert.ok(r.stats.length >= 3 && r.sections.length >= 4, `${f}: too little content`);
  for (const sc of r.sections) {
    assert.ok(sc.id && sc.title && Array.isArray(sc.blocks) && sc.blocks.length, `${f}: bad section ${sc.id}`);
    for (const b of sc.blocks) assert.ok(["p", "table", "list", "steps", "tip"].includes(b.type), `${f}: unknown block ${b.type}`);
  }
  for (const o of r.official || []) assert.match(o.url, /^https:\/\//, `${f}: official link must be https`);
  for (const o of r.options || []) assert.ok(o.mode && o.time && o.from && o.price && o.best, `${f}: incomplete option ${o.mode}`);
  for (const q of r.faq || []) assert.ok(q.q && q.a, `${f}: bad faq entry`);
  for (const x of r.sources || []) assert.match(x.url, /^https:\/\//, `${f}: source link must be https`);
  assert.match(r.verified || "", /^\d{4}-\d{2}-\d{2}$/, `${f}: verified date missing`);
  rn++;
}
console.log(`ok - ${rn} route guides valid`);

const sample = `<rss><channel>
<item><title>Paris metro strike disrupts commuters - Le Monde</title><link>https://news.google.com/a/1</link><pubDate>Tue, 10 Nov 2026 08:00:00 GMT</pubDate><source url="https://lemonde.fr">Le Monde</source></item>
<item><title><![CDATA[RER B works &amp; closures]]></title><link>https://news.google.com/a/2</link><pubDate>Mon, 09 Nov 2026 10:00:00 GMT</pubDate></item>
<item><title>Bad link</title><link>javascript:alert(1)</link></item>
</channel></rss>`;
const items = parseFeed(sample);
assert.equal(items.length, 2);
assert.equal(items[0].title, "Paris metro strike disrupts commuters");
assert.equal(items[0].source, "Le Monde");
assert.equal(items[1].title, "RER B works & closures");
assert.ok(feedUrl("Paris").startsWith("https://news.google.com/rss/search?"));
console.log("ok - news parser");
