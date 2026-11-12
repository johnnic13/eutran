// Server-side HTML for the generated pages. No dependencies.
// - cityStatic / routeStatic: the full guide text, written into the page source so search engines
//   (and anyone without JavaScript) can read it. app.js removes it once the interactive guide loads.
// - airportPage: a standalone "airport to city centre" page for each capital.

export const h = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const safe = (u) => (/^https:\/\//i.test(u || "") ? u : "#");
const li = (t) => `<li>${h(t)}</li>`;
const ul = (a) => ((a || []).length ? `<ul>${a.map(li).join("")}</ul>` : "");
export const slug = (t) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
export const airportPath = (c) => `/${slug(c.capital)}/airport-to-city-centre/`;

const MODE_NAMES = { train: "Trains", tram: "Trams and metro", bus: "Buses", airport: "Airport links" };

function metroStatic(c) {
  const m = c.metro || {};
  if (!m.note && !(m.lines || []).length) return "";
  const strips = (m.lineStrips || [])
    .map((l) => {
      const title = l.label || `Line ${l.id}`;
      const route = l.loop ? l.loop : `${l.ends[0]} to ${l.ends[1]}`;
      return `<li><strong>${h(title)}</strong>: ${h(route)}. Stops: ${l.stops.map((s) => h(s[0]) + (s[1] ? ` (${h(s[1])})` : "")).join(", ")}.</li>`;
    })
    .join("");
  const hubs = (m.hubs || []).length ? `<p>Where lines meet: ${m.hubs.map((x) => `${h(x[0])} (${h(x[1])})`).join("; ")}.</p>` : "";
  return `<h3>${h(c.capital)} network</h3>${m.note ? `<p>${h(m.note)}</p>` : ""}${strips ? `<ul>${strips}</ul>` : ul(m.lines)}${hubs}`;
}

function destStatic(c) {
  const all = c.modes.train.destinations || [];
  if (!all.length) return "";
  const row = (x) => `<li>${h(x.to)}${x.type === "international" && x.country ? ` (${h(x.country)})` : ""}: ${h(x.time)} from ${h(x.station || c.capital)}, ${h(x.operator || "")}</li>`;
  return `<h3>Direct trains from ${h(c.capital)}</h3><ul>${all.map(row).join("")}</ul>`;
}

export function cityStatic(c, routes) {
  const modes = ["train", "tram", "bus", "airport"]
    .map((k) => {
      const d = c.modes[k];
      return `<section><h2>${h(MODE_NAMES[k])} in ${h(c.capital)}</h2><p>${h(d.sum)}</p><p>${h(d.sched)}</p>` +
        `<h3>Tickets and prices</h3>${ul(d.tickets)}` +
        ((d.buy || []).length ? `<h3>Where to buy tickets</h3>${ul(d.buy)}` : "") +
        (d.tip ? `<p><strong>Good to know:</strong> ${h(d.tip)}</p>` : "") +
        (d.link ? `<p><a href="${h(safe(d.link[1]))}">${h(d.link[0])} (official site)</a></p>` : "") +
        (k === "tram" ? metroStatic(c) : "") +
        (k === "train" ? destStatic(c) : "") +
        (k === "airport" ? `<p><a href="${airportPath(c)}">Airport to city centre: full guide</a></p>` : "") +
        `</section>`;
    })
    .join("");
  const rs = routes.filter((r) => r.from.country === c.id || r.to.country === c.id);
  const routeLinks = rs.length ? `<section><h2>Route guides</h2><ul>${rs.map((r) => `<li><a href="/routes/${h(r.id)}/">${h(r.title)}</a></li>`).join("")}</ul></section>` : "";
  const tips = `<section><h2>Tips for ${h(c.capital)}</h2>${ul(c.tips)}</section>`;
  const apps = (c.apps || []).length ? `<section><h2>Apps to download</h2><ul>${c.apps.map((a) => `<li><strong>${h(a.name)}</strong>: ${h(a.what)}</li>`).join("")}</ul></section>` : "";
  const ver = c.verified ? `<p>Fares checked against official sources on ${h(c.verified)}.</p>` : "";
  return `<section id="static-content" class="static-content"><h1>${h(c.capital)} public transport guide</h1><p>Capital of ${h(c.name)}. Trains, trams and metro, buses and airport links for visitors, with ticket prices, tips and apps.</p>` +
    modes + tips + apps + routeLinks + ver + `</section>`;
}

function blockStatic(b) {
  if (b.type === "p") return `<p>${h(b.text)}</p>`;
  if (b.type === "list") return ul(b.items);
  if (b.type === "tip") return `<p><strong>Good to know:</strong> ${h(b.text)}</p>`;
  if (b.type === "steps") return `<ol>${(b.items || []).map((x) => `<li><strong>${h(x.title)}</strong> ${h(x.text)}</li>`).join("")}</ol>`;
  if (b.type === "table")
    return `<table><thead><tr>${(b.head || []).map((x) => `<th>${h(x)}</th>`).join("")}</tr></thead><tbody>${(b.rows || []).map((r) => `<tr>${r.map((x) => `<td>${h(x)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  if (b.type === "places")
    return (b.items || []).map((p) => `<h3>${h(p.name)}</h3><p>${h(p.why)}</p>` + ul([p.time && `Time: ${p.time}`, p.cost && `Cost: ${p.cost}`, p.getting && `From the station: ${p.getting}`].filter(Boolean))).join("");
  return ""; // "book" blocks are affiliate buttons: shown only in the interactive guide
}

export function routeStatic(r) {
  const secs = (r.sections || []).map((sc) => {
    const useOptions = sc.id === "alternatives" && (r.options || []).length > 0;
    const blocks = useOptions ? sc.blocks.filter((b) => b.type !== "table") : sc.blocks;
    const opts = useOptions
      ? `<table><thead><tr><th>Option</th><th>Door to door</th><th>From and to</th><th>Typical price</th><th>Best for</th></tr></thead><tbody>${r.options.map((o) => `<tr><td>${h(o.mode)}</td><td>${h(o.time)}</td><td>${h(o.from)}</td><td>${h(o.price)}</td><td>${h(o.best)}</td></tr>`).join("")}</tbody></table>`
      : "";
    return `<section><h2>${h(sc.title)}</h2>${opts}${blocks.map(blockStatic).join("")}</section>`;
  }).join("");
  const faq = (r.faq || []).length ? `<section><h2>Frequently asked questions</h2>${r.faq.map((x) => `<h3>${h(x.q)}</h3><p>${h(x.a)}</p>`).join("")}</section>` : "";
  const off = (r.official || []).length ? `<p>Official sites: ${r.official.map((o) => `<a href="${h(safe(o.url))}">${h(o.label)}</a>`).join(", ")}</p>` : "";
  const src = (r.sources || []).length ? `<section><h2>Sources</h2><ul>${r.sources.map((x) => `<li><a href="${h(safe(x.url))}">${h(x.title || x.url)}</a></li>`).join("")}</ul></section>` : "";
  return `<section id="static-content" class="static-content"><h1>${h(r.title)}</h1><p>${h(r.summary || "")}</p>` +
    `<ul>${r.stats.map((x) => `<li>${h(x.label)}: ${h(x.value)}</li>`).join("")}</ul>${off}${secs}${faq}` +
    (r.verified ? `<p>Checked against official sources on ${h(r.verified)}. Fares, times and rules change, so confirm them with the operator before you book.</p>` : "") + src + `</section>`;
}

// ---- Airport to city centre pages ----
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export function airportData(c, aff, routes) {
  const d = c.modes.airport;
  const q = (question, answer) => ({ q: question, a: answer });
  const faq = [
    q(`How do I get from ${c.capital} airport to the city centre?`, `${d.sum} ${d.sched}`),
    q(`How much does it cost to get from ${c.capital} airport to the centre?`, `${(d.tickets || []).join(". ")}.`),
    ...((d.buy || []).length ? [q(`Where do I buy tickets at ${c.capital} airport?`, d.buy.join(" "))] : []),
    ...(d.tip ? [q(`Any tips for the airport transfer in ${c.capital}?`, d.tip)] : []),
  ];
  const title = `${c.capital} airport to city centre: train, bus and taxi · Euro Transit Guide`;
  const desc = `How to get from ${c.capital} airport to the city centre: options, journey times, ticket prices and where to buy tickets.`.slice(0, 200);
  const partners = (aff.partners || []).filter((p) => (p.modes || []).some((m) => m === "airport" || m === "tips") && ((p.cityLinks && p.cityLinks[c.id]) || p.link));
  const buttons = partners.map((p) => `<a class="partner" href="${h(safe((p.cityLinks && p.cityLinks[c.id]) || p.link))}" target="_blank" rel="sponsored noopener">${h(p.name)} &nearr;</a>`).join("");
  const rs = routes.filter((r) => r.from.country === c.id || r.to.country === c.id);
  const city = `/${slug(c.capital)}/`;
  const body = `<h1>${h(c.capital)} airport to city centre</h1>
<p class="muted">Prices and journey times checked ${h(c.verified || "recently")}. Always confirm with the operator before you travel.</p>
<p>${h(d.sum)}</p>
<h2>How long it takes and how often</h2>
<p>${h(d.sched)}</p>
<h2>Options and prices</h2>
${ul(d.tickets)}
${(d.buy || []).length ? `<h2>Where to buy tickets</h2>${ul(d.buy)}` : ""}
${d.tip ? `<div class="tip"><span class="k">Good to know</span>${h(d.tip)}</div>` : ""}
${d.link ? `<p><a class="official" href="${h(safe(d.link[1]))}" target="_blank" rel="noopener">${h(d.link[0])} (official site) &nearr;</a></p>` : ""}
${buttons ? `<div class="book"><b>Before you fly</b><div class="partners">${buttons}</div><small>Affiliate links. We may earn a commission at no extra cost to you.</small></div>` : ""}
<h2>Once you arrive</h2>
<ul>
<li><a href="${city}#${c.id.toLowerCase()}-tram">Metro and tram in ${h(c.capital)}</a></li>
<li><a href="${city}#${c.id.toLowerCase()}-train">Trains from ${h(c.capital)}</a></li>
<li><a href="${city}#${c.id.toLowerCase()}-tips">Tips and apps for ${h(c.capital)}</a></li>
${rs.map((r) => `<li><a href="/routes/${h(r.id)}/">${h(r.title)}</a></li>`).join("")}
</ul>
<h2>Frequently asked questions</h2>
${faq.map((x) => `<h3>${h(x.q)}</h3><p>${h(x.a)}</p>`).join("")}`;
  const ld = { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faq.map((x) => ({ "@type": "Question", name: x.q, acceptedAnswer: { "@type": "Answer", text: x.a } })) };
  return { title, desc, body, ld };
}
