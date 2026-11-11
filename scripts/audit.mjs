// Consistency audit: run with "npm run audit". It only reports, it changes nothing.
// Checks: capital-to-capital trains listed in both directions with similar times, route guides
// against city pages, thin destination lists, and cities with no fine information.
import { readdir, readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = async (d) => Promise.all((await readdir(join(root, "data", d))).filter((f) => f.endsWith(".json")).map(async (f) => JSON.parse(await readFile(join(root, "data", d, f), "utf8"))));
const countries = await read("countries");
const routes = await read("routes").catch(() => []);
const mins = (t) => { const h = /(\d+)\s*h/.exec(t), m = /(\d+)\s*min/.exec(t) || /h\w*\s+(\d+)\b/.exec(t); return h || m ? (h ? +h[1] * 60 : 0) + (m ? +m[1] : 0) : null; };
const cap = (c) => c.capital.replace(" City", "").toLowerCase();

// fastest listed time between each pair of capitals
const best = new Map();
for (const c of countries) for (const d of c.modes.train.destinations || []) for (const o of countries) {
  if (o.id === c.id || !d.to.toLowerCase().startsWith(cap(o))) continue;
  const k = c.id + ">" + o.id, t = mins(d.time);
  if (t !== null && (!best.has(k) || t < best.get(k))) best.set(k, t);
}
let n = 0;
const say = (s) => { n++; console.log("- " + s); };
for (const [k, t] of best) {
  const [a, b] = k.split(">"), back = best.get(b + ">" + a);
  if (back === undefined) say(`${a} lists a train to ${b}, but ${b} has none back to ${a}`);
  else if (a < b && Math.abs(t - back) > Math.max(20, 0.12 * Math.max(t, back))) say(`${a}-${b}: fastest times differ (${t} min one way, ${back} min the other)`);
}
for (const r of routes) {
  const g = mins(r.stats[0].value);
  for (const [a, b] of [[r.from.country, r.to.country], [r.to.country, r.from.country]]) {
    const t = best.get(a + ">" + b);
    if (t === undefined) say(`route ${r.id}: ${a} page has no train to ${b}`);
    else if (g !== null && Math.abs(t - g) > 10) say(`route ${r.id}: guide says ${g} min, ${a} page says ${t} min`);
  }
}
for (const c of countries) {
  const dn = (c.modes.train.destinations || []).length;
  if (dn > 0 && dn < 12) say(`${c.id} ${c.capital}: only ${dn} train destinations`);
  if (!/\bfine[sd]?\b|penalt|control fee|surcharge for travelling without/i.test(JSON.stringify(c))) say(`${c.id} ${c.capital}: no fine amount anywhere`);
  const age = (Date.now() - new Date(c.verified)) / 864e5;
  if (age > 180) say(`${c.id} ${c.capital}: last checked ${Math.round(age)} days ago`);
}
console.log(n ? `\n${n} things to look at` : "No issues found");
