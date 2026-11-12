/* Euro Transit Guide - front end.
   Data: data/countries.json (built from data/countries/*.json), data/affiliates.json.
   Map: data/world.topo.json (downloaded at build time), with a CDN fallback.
   News: /api/news?country=XXX (Netlify function). */
(function(){
"use strict";

/* Base path of the site (so static pages such as /paris/ can load data from the root) */
var ROOT=(function(){try{var u=document.currentScript&&document.currentScript.src;return u?u.replace(/js\/app\.js[^\/]*$/,""):""}catch(e){return ""}})();
var BASE_DESC="Public transport guides for European capitals: trains, trams, metro, buses and airport links, with ticket prices, tips, apps and live transport news.";

/* ---------- helpers ---------- */
function $(id){return document.getElementById(id)}
function esc(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})}
function slugify(t){return t.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")}
function li(t){return "<li>"+esc(t)+"</li>"}
function safeUrl(u){return /^https?:\/\//i.test(u||"")?u:"#"}
function setMeta(title,desc){
  document.title=title;
  var m=document.querySelector('meta[name="description"]');
  if(!m){m=document.createElement("meta");m.setAttribute("name","description");document.head.appendChild(m)}
  m.setAttribute("content",desc||BASE_DESC);
}
function setLd(obj){
  var old=document.getElementById("ld");if(old)old.parentNode.removeChild(old);
  if(!obj)return;
  var t=document.createElement("script");t.type="application/ld+json";t.id="ld";t.text=JSON.stringify(obj);document.head.appendChild(t);
}
function fmtDate(d){return new Date(d).toLocaleDateString(undefined,{day:"numeric",month:"short",year:"numeric"})}
var COPY_TEXT="";
function toolsHTML(){
  return '<button type="button" class="tool" data-copy>Copy trip summary</button>'+(window.top===window?'<button type="button" class="tool" data-print>Print or save as PDF</button>':"");
}
function copyText(text,btn){
  var label=btn.textContent;
  function done(ok){btn.textContent=ok?"Copied":"Copy failed";setTimeout(function(){btn.textContent=label},1800)}
  function fallback(){
    try{var ta=document.createElement("textarea");ta.value=text;ta.setAttribute("readonly","");ta.style.position="fixed";ta.style.opacity="0";document.body.appendChild(ta);ta.select();var ok=document.execCommand("copy");document.body.removeChild(ta);done(ok)}catch(e){done(false)}
  }
  try{
    if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(text).then(function(){done(true)},fallback);
    else fallback();
  }catch(e){fallback()}
}
function getJSON(url){return fetch(url,{cache:"no-cache"}).then(function(r){if(!r.ok)throw new Error(url+" "+r.status);return r.json()})}

/* ---------- flags ---------- */
function flagDef(spec){
  if(spec==="gbr")return{vb:"0 0 60 30",inner:'<rect width="60" height="30" fill="#012169"/><path d="M0,0L60,30M60,0L0,30" stroke="#fff" stroke-width="6"/><path d="M0,0L60,30M60,0L0,30" stroke="#c8102e" stroke-width="2"/><path d="M30,0V30M0,15H60" stroke="#fff" stroke-width="10"/><path d="M30,0V30M0,15H60" stroke="#c8102e" stroke-width="6"/>'};
  if(spec==="prt")return{vb:"0 0 60 40",inner:'<rect width="24" height="40" fill="#006600"/><rect x="24" width="36" height="40" fill="#ff0000"/><circle cx="24" cy="20" r="8" fill="#ffe000"/><circle cx="24" cy="20" r="4.5" fill="#ff0000"/><circle cx="24" cy="20" r="2" fill="#fff"/>'};
  if(spec==="grc")return{vb:"0 0 27 18",inner:'<rect width="27" height="18" fill="#0d5eaf"/><g fill="#fff"><rect y="2" width="27" height="2"/><rect y="6" width="27" height="2"/><rect y="10" width="27" height="2"/><rect y="14" width="27" height="2"/></g><rect width="10" height="10" fill="#0d5eaf"/><g fill="#fff"><rect x="4" width="2" height="10"/><rect y="4" width="10" height="2"/></g>'};
  if(spec==="dnk")return{vb:"0 0 37 28",inner:'<rect width="37" height="28" fill="#c8102e"/><rect x="12" width="4" height="28" fill="#fff"/><rect y="12" width="37" height="4" fill="#fff"/>'};
  if(spec==="nor")return{vb:"0 0 22 16",inner:'<rect width="22" height="16" fill="#ba0c2f"/><rect x="6" width="4" height="16" fill="#fff"/><rect y="6" width="22" height="4" fill="#fff"/><rect x="7" width="2" height="16" fill="#00205b"/><rect y="7" width="22" height="2" fill="#00205b"/>'};
  if(spec==="swe")return{vb:"0 0 16 10",inner:'<rect width="16" height="10" fill="#006aa7"/><rect x="5" width="2" height="10" fill="#fecc02"/><rect y="4" width="16" height="2" fill="#fecc02"/>'};
  if(spec==="fin")return{vb:"0 0 18 11",inner:'<rect width="18" height="11" fill="#fff"/><rect x="5" width="3" height="11" fill="#003580"/><rect y="4" width="18" height="3" fill="#003580"/>'};
  if(spec==="hrv"){var q="";for(var r=0;r<4;r++)for(var c=0;c<3;c++)q+='<rect x="'+(25.5+c*3)+'" y="'+(8+r*3)+'" width="3" height="3" fill="'+((r+c)%2?"#fff":"#ee2737")+'"/>';
    return{vb:"0 0 60 30",inner:'<rect width="60" height="10" fill="#ee2737"/><rect y="10" width="60" height="10" fill="#fff"/><rect y="20" width="60" height="10" fill="#171796"/><rect x="25" y="7.5" width="10" height="13" fill="#ee2737" stroke="#fff" stroke-width=".6"/>'+q}}
  if(spec==="cyp")return{vb:"0 0 60 40",inner:'<rect width="60" height="40" fill="#fff"/><path d="M17,19 L24,16 L30,17 L36,13 L43,15 L40,19 L33,21 L27,24 L21,23 Z" fill="#d57800"/><path d="M22,29 Q30,34 38,29" fill="none" stroke="#4e5b31" stroke-width="1.6"/><path d="M24,27.5 Q30,32 36,27.5" fill="none" stroke="#4e5b31" stroke-width="1.6"/>'};
  if(spec==="mlt")return{vb:"0 0 3 2",inner:'<rect width="3" height="2" fill="#cf142b"/><rect width="1.5" height="2" fill="#fff"/><path d="M.55,.28h.4v.28h.28v.4h-.28v.28h-.4v-.28h-.28v-.4h.28z" fill="none" stroke="#9a9a9a" stroke-width=".07" transform="translate(-.05 .02)"/>'};
  if(spec==="cze")return{vb:"0 0 3 2",inner:'<rect width="3" height="2" fill="#fff"/><rect y="1" width="3" height="1" fill="#d7141a"/><polygon points="0,0 1.5,1 0,2" fill="#11457e"/>'};
  var p=String(spec).split(":"),dir=p[0],cols=(p[1]||"#ccc").split(","),n=cols.length,out="";
  cols.forEach(function(c,i){
    out+= dir==="h"
      ? '<rect y="'+(20/n*i)+'" width="30" height="'+(20/n+0.15)+'" fill="'+c+'"/>'
      : '<rect x="'+(30/n*i)+'" width="'+(30/n+0.15)+'" height="20" fill="'+c+'"/>';
  });
  return{vb:"0 0 30 20",inner:out};
}
function flagSVG(spec){var f=flagDef(spec);return '<svg viewBox="'+f.vb+'" preserveAspectRatio="xMidYMid slice" aria-hidden="true">'+f.inner+'</svg>'}

/* ---------- state ---------- */
var COUNTRIES={},IDS=[],GENERAL_TIPS=[],AFF={partners:[]},ROUTES=[];

/* ---------- map projection (Mercator cropped to Europe) ---------- */
var W=1000,H=800,BOX={lon0:-14,lon1:38,lat0:34.5,lat1:61.5};
function mx(lon){return lon*Math.PI/180}
function my(lat){return Math.log(Math.tan(Math.PI/4+lat*Math.PI/360))}
var X0=mx(BOX.lon0),X1=mx(BOX.lon1),Y0=my(BOX.lat0),Y1=my(BOX.lat1);
var S=Math.min(W/(X1-X0),H/(Y1-Y0)),OX=(W-(X1-X0)*S)/2,OY=(H-(Y1-Y0)*S)/2;
function P(pt){return[OX+(mx(pt[0])-X0)*S,OY+(Y1-my(pt[1]))*S]}

/* Decode a TopoJSON topology into rings keyed by geometry id. */
function decode(topo){
  var t=topo.transform;
  var arcs=topo.arcs.map(function(a){var x=0,y=0;return a.map(function(p){
    if(t){x+=p[0];y+=p[1];return[x*t.scale[0]+t.translate[0],y*t.scale[1]+t.translate[1]]}
    return[p[0],p[1]]})});
  function ring(ix){var out=[];ix.forEach(function(i){var a=i<0?arcs[~i].slice().reverse():arcs[i];for(var k=out.length?1:0;k<a.length;k++)out.push(a[k])});return out}
  var key=topo.objects.countries?"countries":topo.objects.world?"world":Object.keys(topo.objects)[0],res={};
  topo.objects[key].geometries.forEach(function(g,i){
    var id=g.id!=null&&g.id!==""?String(g.id):"_"+i;
    var polys=g.type==="Polygon"?[g.arcs]:g.type==="MultiPolygon"?g.arcs:[];
    if(!res[id])res[id]=[];
    polys.forEach(function(p){p.forEach(function(r){res[id].push(ring(r))})});
  });
  return res;
}

function project(rings){
  var d="",bb=[1e9,1e9,-1e9,-1e9],best=null,bestA=-1;
  rings.forEach(function(r){
    var lo0=1e9,lo1=-1e9,la0=1e9,la1=-1e9;
    r.forEach(function(p){if(p[0]<lo0)lo0=p[0];if(p[0]>lo1)lo1=p[0];if(p[1]<la0)la0=p[1];if(p[1]>la1)la1=p[1]});
    /* A ring that crosses the date line (Russia, Fiji) jumps from +180 to -180 and would be drawn as a band
       across the whole map. Move its western-hemisphere points east by 360 so the outline stays in one piece. */
    if(lo1-lo0>180){
      r=r.map(function(p){return [p[0]<0?p[0]+360:p[0],p[1]]});
      lo0=1e9;lo1=-1e9;
      r.forEach(function(p){if(p[0]<lo0)lo0=p[0];if(p[0]>lo1)lo1=p[0]});
    }
    if(lo1<BOX.lon0-6||lo0>BOX.lon1+6||la1<BOX.lat0-6||la0>BOX.lat1+6)return;
    var last=null,seg="",x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
    r.forEach(function(p,i){
      var q=P(p);
      if(last&&Math.abs(q[0]-last[0])<0.35&&Math.abs(q[1]-last[1])<0.35&&i<r.length-1)return;
      seg+=(last?"L":"M")+q[0].toFixed(1)+","+q[1].toFixed(1);last=q;
      if(q[0]<x0)x0=q[0];if(q[0]>x1)x1=q[0];if(q[1]<y0)y0=q[1];if(q[1]>y1)y1=q[1];
    });
    d+=seg+"Z";
    var cx0=Math.max(x0,0),cx1=Math.min(x1,W),cy0=Math.max(y0,0),cy1=Math.min(y1,H);
    if(cx1<=cx0||cy1<=cy0)return;
    if(cx0<bb[0])bb[0]=cx0;if(cy0<bb[1])bb[1]=cy0;if(cx1>bb[2])bb[2]=cx1;if(cy1>bb[3])bb[3]=cy1;
    var a=(cx1-cx0)*(cy1-cy0);
    if(a>bestA){bestA=a;best=[(cx0+cx1)/2,(cy0+cy1)/2]}
  });
  return d?{d:d,bb:bb,c:best||[(bb[0]+bb[2])/2,(bb[1]+bb[3])/2]}:null;
}

var geo={},active=null,svg=$("map"),card=$("card"),stage=$("stage");

function drawMap(topo){
  var all=decode(topo),land="",has="",used={};
  IDS.forEach(function(id){var c=COUNTRIES[id];used[id]=1;if(c.isoNumeric)used[c.isoNumeric]=1});
  Object.keys(all).forEach(function(k){
    if(used[k])return;
    var g=project(all[k]);
    if(g)land+='<path class="land" d="'+g.d+'"/>';
  });
  IDS.forEach(function(id){
    var c=COUNTRIES[id],rings=all[id]||all[c.isoNumeric],g=rings?project(rings):null;
    var label='aria-label="Open '+esc(c.capital)+', '+esc(c.name)+' transport guide" tabindex="0" role="link" data-id="'+id+'"';
    if(g){geo[id]=g;has+='<path class="has" '+label+' d="'+g.d+'"/>'}
    else{var q=P(c.lonLat);geo[id]={d:"M"+(q[0]-9)+","+q[1]+"a9,9 0 1,0 18,0a9,9 0 1,0 -18,0Z",bb:[q[0]-9,q[1]-9,q[0]+9,q[1]+9],c:q};has+='<circle class="has" '+label+' cx="'+q[0].toFixed(1)+'" cy="'+q[1].toFixed(1)+'" r="8"/>'}
  });
  svg.setAttribute("viewBox","0 0 "+W+" "+H);
  svg.innerHTML='<g>'+land+'</g><g id="hasg">'+has+'</g><g id="hlg"></g>';
  $("mapmsg").hidden=true;svg.removeAttribute("hidden");$("hint").hidden=false;
  wire();
}

function show(id){
  if(!geo[id])return;
  active=id;
  var c=COUNTRIES[id],g=geo[id],f=flagDef(c.flag);
  var bw=g.bb[2]-g.bb[0],bh=g.bb[3]-g.bb[1];
  $("hlg").innerHTML='<g class="hl" style="transform-origin:'+g.c[0].toFixed(1)+'px '+g.c[1].toFixed(1)+'px"><clipPath id="hlc"><path d="'+g.d+'"/></clipPath><g clip-path="url(#hlc)"><svg x="'+g.bb[0]+'" y="'+g.bb[1]+'" width="'+bw+'" height="'+bh+'" viewBox="'+f.vb+'" preserveAspectRatio="xMidYMid slice">'+f.inner+'</svg></g><path class="edge" d="'+g.d+'"/></g>';
  var hl=svg.querySelector(".hl");
  requestAnimationFrame(function(){if(hl)hl.classList.add("on")});
  card.innerHTML=flagSVG(c.flag)+'<div><b>'+esc(c.name)+'</b><span>'+esc(c.capital)+' transport</span><em>Click to explore &rarr;</em></div>';
  place(g);
  card.classList.add("show");
}
function place(g){
  var m=svg.getScreenCTM();if(!m)return;
  var pt=svg.createSVGPoint(),sr=stage.getBoundingClientRect();
  pt.x=g.c[0];pt.y=g.bb[1];var top=pt.matrixTransform(m);
  var cw=card.offsetWidth,ch=card.offsetHeight;
  var left=Math.min(Math.max(top.x-sr.left,cw/2+8),sr.width-cw/2-8);
  var y=top.y-sr.top-10;
  if(y-ch<6){pt.y=g.bb[3];var b=pt.matrixTransform(m);y=Math.min(b.y-sr.top+10+ch,sr.height-6)}
  card.style.left=left+"px";card.style.top=y+"px";
}
function hide(){active=null;card.classList.remove("show");var h=$("hlg");if(h)h.innerHTML=""}
function go(id){location.hash=id.toLowerCase()}

function wire(){
  var lastType="mouse",wasActive=false;
  svg.addEventListener("pointerdown",function(e){lastType=e.pointerType;var t=e.target.closest&&e.target.closest(".has");wasActive=!!t&&active===t.getAttribute("data-id")});
  svg.querySelectorAll(".has").forEach(function(el){
    var id=el.getAttribute("data-id");
    el.addEventListener("mouseenter",function(){show(id)});
    el.addEventListener("mouseleave",function(){if(active===id)hide()});
    el.addEventListener("focus",function(){show(id)});
    el.addEventListener("blur",function(){if(active===id)hide()});
    el.addEventListener("keydown",function(e){if(e.key==="Enter"||e.key===" "){e.preventDefault();go(id)}});
    el.addEventListener("click",function(e){
      e.stopPropagation();
      if(lastType==="touch"&&!wasActive){show(id);return}
      go(id);
    });
  });
  svg.addEventListener("click",hide);
  window.addEventListener("resize",function(){if(active)place(geo[active])});
}

/* Map data: local file from the build, else the Datamaps topology on cdnjs. */
function loadScript(src){return new Promise(function(ok,fail){var s=document.createElement("script");s.src=src;s.onload=ok;s.onerror=fail;document.head.appendChild(s)})}
function mapFailed(){$("mapmsg").textContent="The map could not be loaded. Choose a country from the list below."}
function loadMap(){
  (location.protocol==="file:"?Promise.reject(new Error("file")):getJSON(ROOT+"data/world.topo.json")).then(drawMap).catch(function(){
    var cdn="https://cdnjs.cloudflare.com/ajax/libs/";
    return loadScript(cdn+"d3/3.5.17/d3.min.js")
      .then(function(){return loadScript(cdn+"datamaps/0.5.9/datamaps.world.hires.min.js")})
      .then(function(){var t=window.Datamap&&Datamap.prototype.worldTopo;if(!t)throw new Error("no topology");drawMap(t)});
  }).catch(function(err){console.error(err);mapFailed()});
}

/* ---------- country pages ---------- */
var MODES=[["train","Train","--train"],["tram","Tram & Metro","--tram"],["bus","Bus","--bus"],["airport","Airport","--air"],["tips","Tips & Apps","--tips"],["news","News","--news"]];

function bookingBox(id,mode){
  var links=(AFF.partners||[]).filter(function(p){
    return (p.modes||[]).indexOf(mode)>=0 && ((p.cityLinks&&p.cityLinks[id])||p.link);
  });
  if(!links.length)return "";
  var head={tips:"Stay connected",tram:"City passes and tickets"}[mode]||"Book tickets";
  return '<div class="book"><b>'+head+'</b><div class="partners">'+links.map(function(p){
    var url=(p.cityLinks&&p.cityLinks[id])||p.link;
    return '<a class="partner" href="'+esc(safeUrl(url))+'" target="_blank" rel="sponsored noopener">'+esc(p.name)+' &nearr;</a>';
  }).join("")+'</div><small>Affiliate links. We may earn a commission at no extra cost to you.</small></div>';
}

function metroBox(c){
  var m=c.metro||{};
  if(!m.note&&!(m.lines||[]).length)return "";
  var link=m.mapUrl?'<a href="'+esc(safeUrl(m.mapUrl))+'" target="_blank" rel="noopener">'+esc(m.mapLabel||"Official network map")+' &nearr;</a>':"";
  var strips=(m.lineStrips||[]).length?'<div class="mlines">'+m.lineStrips.map(function(l){
    return '<div class="mline" style="--lc:'+esc(l.color)+';--li:'+esc(l.ink||"#fff")+'"><span class="lbadge'+(String(l.id).length>2?' long':'')+'" aria-hidden="true">'+esc(l.id)+'</span><div><b>'+esc(l.label||("Line "+l.id))+': '+(l.loop?esc(l.loop):esc(l.ends[0])+' &harr; '+esc(l.ends[1]))+'</b><ul class="lstops">'+l.stops.map(function(x){return "<li>"+esc(x[0])+(x[1]?" <small>"+esc(x[1])+"</small>":"")+"</li>"}).join("")+'</ul></div></div>';
  }).join("")+'</div>'+((m.hubs||[]).length?'<p class="k">Where the lines meet</p><ul class="lhubs">'+m.hubs.map(function(h){return "<li><b>"+esc(h[0])+"</b> "+esc(h[1])+"</li>"}).join("")+'</ul>':""):"";
  return '<div class="mapbox full"><b>Metro network map</b><p>'+esc(m.note)+'</p>'+strips+(strips?"":((m.lines||[]).length?'<ul>'+m.lines.map(li).join("")+'</ul>':""))+link+'</div>';
}

var newsCache={};
function loadNews(id){
  var box=$("newslist");if(!box)return;
  function render(items){
    if(!$("newslist"))return;
    if(!items.length){$("newslist").innerHTML='<p class="muted">No recent transport news found for this city.</p>';return}
    $("newslist").innerHTML=items.map(function(n){
      var d=n.date?new Date(n.date):null,ds=d&&!isNaN(d)?d.toLocaleDateString(undefined,{day:"numeric",month:"short"}):"";
      return '<div class="news-item"><span class="t">'+esc(ds||"News")+'</span><div><a href="'+esc(safeUrl(n.link))+'" target="_blank" rel="noopener">'+esc(n.title)+'</a>'+(n.source?'<small>'+esc(n.source)+'</small>':"")+'</div></div>';
    }).join("");
  }
  if(newsCache[id]){render(newsCache[id]);return}
  fetch("/api/news?country="+encodeURIComponent(id)).then(function(r){if(!r.ok)throw new Error(r.status);return r.json()})
    .then(function(j){newsCache[id]=j.items||[];render(newsCache[id])})
    .catch(function(){if($("newslist"))$("newslist").innerHTML='<p class="muted">Live news is not available right now. Check the official operator links on the other tabs for service alerts.</p>'});
}

function sheet(id,mode){
  var c=COUNTRIES[id],m=MODES.filter(function(x){return x[0]===mode})[0],el=$("sheet");
  el.style.setProperty("--c","var("+m[2]+")");
  if(mode==="news"){
    el.innerHTML='<div class="full"><h3>News affecting transport in '+esc(c.capital)+'</h3><p class="k">Recent headlines about strikes, works, events and fares. Updated every 15 minutes.</p><div id="newslist"><p class="muted">Loading news...</p></div></div>';
    loadNews(id);
    return;
  }
  if(mode==="tips"){
    el.innerHTML='<div><h3>Tips for '+esc(c.capital)+'</h3><ul>'+(c.tips||[]).map(li).join("")+'</ul><p class="k" style="margin-top:20px">For any city</p><ul>'+GENERAL_TIPS.map(li).join("")+'</ul></div>'+
      '<div><h3>Apps to download</h3><ul class="apps">'+(c.apps||[]).map(function(a){return '<li><div><b>'+esc(a.name)+'</b><span>'+esc(a.what)+'</span></div></li>'}).join("")+'</ul>'+
      bookingBox(id,"tips")+'<div class="book"><b>Before you go</b>Availability can differ by country store, and some apps need a local phone number or bank card.</div></div>';
    return;
  }
  var d=c.modes[mode];
  var heading=mode==="airport"?"Airports and transfers in "+c.capital:m[1]+" in "+c.capital;
  el.innerHTML='<div><h3>'+esc(heading)+'</h3><p>'+esc(d.sum)+'</p>'+
    '<p class="k">Schedules</p><p>'+esc(d.sched)+'</p>'+
    '<div class="tip"><span class="k">Good to know</span>'+esc(d.tip)+'</div>'+
    (d.link?'<a class="official" href="'+esc(safeUrl(d.link[1]))+'" target="_blank" rel="noopener">'+esc(d.link[0])+' (official site) &nearr;</a>':"")+
    (mode==="airport"?'<p><a href="/'+slugify(c.capital)+'/airport-to-city-centre/">Airport to city centre: full guide &rarr;</a></p>':"")+'</div>'+
    '<div><p class="k">Tickets and prices</p><ul>'+(d.tickets||[]).map(li).join("")+'</ul>'+
    buyBox(d)+bookingBox(id,mode)+'</div>'+
    (mode==="tram"?metroBox(c):"")+
    (mode==="train"?destinations(c):"");
  if(mode==="train")wireDestinations();
}

function buyBox(d){
  if(!(d.buy||[]).length)return "";
  return '<div class="buybox"><p class="k">Where to buy tickets</p><ul>'+d.buy.map(li).join("")+'</ul></div>';
}

var CURRENT_CITY="";
function guideLink(x){
  var r=CURRENT_CITY&&routeBetween(CURRENT_CITY,x.to);
  return r?'<a class="dguide" href="#route-'+esc(r.id)+'">Route guide &rarr;</a>':"";
}
function destRows(list){
  return list.map(function(x){
    return '<tr data-q="'+esc((x.to+" "+(x.country||"")+" "+(x.operator||"")+" "+(x.note||"")).toLowerCase())+'">'+
      '<th scope="row">'+esc(x.to)+(x.type==="international"&&x.country?' <small>'+esc(x.country)+'</small>':"")+(x.note?'<span class="dnote">'+esc(x.note)+'</span>':"")+(guideLink(x)||"")+'</th>'+
      '<td class="num">'+esc(x.time)+'</td><td>'+esc(x.station||"")+'</td><td>'+esc(x.operator||"")+'</td></tr>';
  }).join("");
}
function destinations(c){
  CURRENT_CITY=c.capital;
  var all=c.modes.train.destinations||[];
  if(!all.length)return "";
  var dom=all.filter(function(x){return x.type!=="international"}),intl=all.filter(function(x){return x.type==="international"});
  function table(title,list){
    if(!list.length)return "";
    return '<div class="dgroup"><h4>'+title+' <span>'+list.length+'</span></h4><div class="dscroll"><table class="dest"><thead><tr><th scope="col">Destination</th><th scope="col">Fastest</th><th scope="col">From</th><th scope="col">Trains</th></tr></thead><tbody>'+destRows(list)+'</tbody></table></div></div>';
  }
  return '<div class="full destwrap"><div class="desthead"><h3>Direct trains from '+esc(c.capital)+'</h3>'+
    '<label class="dsearch"><span class="k">Find a destination</span><input type="search" id="destq" placeholder="City, country or train" autocomplete="off"></label></div>'+
    '<p class="muted">All destinations you can reach without changing trains. Times are the fastest typical journey and some are approximate. Check the operator app for today\'s timetable.</p>'+
    table("In "+esc(c.name),dom)+table("Abroad",intl)+'<p class="muted" id="destnone" hidden>No direct train found. Try a nearby city, or plan a route with a change in the operator app.</p></div>';
}
function wireDestinations(){
  var q=$("destq");if(!q)return;
  q.addEventListener("input",function(){
    var v=q.value.trim().toLowerCase(),shown=0;
    document.querySelectorAll(".dest tbody tr").forEach(function(r){var ok=!v||r.getAttribute("data-q").indexOf(v)>=0;r.hidden=!ok;if(ok)shown++});
    document.querySelectorAll(".dgroup").forEach(function(g){g.hidden=!g.querySelector("tbody tr:not([hidden])")});
    $("destnone").hidden=shown>0;
  });
}



/* ---------- route hub guides ---------- */
function routeById(id){return ROUTES.filter(function(r){return r.id===id})[0]}
function routesFor(cid){return ROUTES.filter(function(r){return r.from.country===cid||r.to.country===cid})}
function routeBetween(fromCity,toCity){
  return ROUTES.filter(function(r){return (r.from.city===fromCity&&r.to.city===toCity)||(r.from.city===toCity&&r.to.city===fromCity)})[0]
}
function routeCard(r){
  var f=COUNTRIES[r.from.country],t=COUNTRIES[r.to.country];
  return '<a class="routecard" href="#route-'+esc(r.id)+'"><span class="rflags">'+(f?flagSVG(f.flag):"")+(t?flagSVG(t.flag):"")+'</span>'+
    '<span class="rtxt"><b>'+esc(r.from.city)+' to '+esc(r.to.city)+'</b><small>'+esc(r.stats[0]?r.stats[0].label+": "+String(r.stats[0].value).split(" (")[0]:"Route guide")+'</small></span><span class="rgo">Guide &rarr;</span></a>';
}
function renderRouteList(){
  if(!ROUTES.length)return;
  $("routelist").innerHTML=ROUTES.map(function(r){return "<li>"+routeCard(r)+"</li>"}).join("");
  $("routecount").textContent=ROUTES.length+(ROUTES.length===1?" guide":" guides");
  $("routesbox").hidden=false;
}
function slotButtons(r,kinds){
  var slots=((AFF.routes||{})[r.id]||[]).filter(function(x){return x.link&&(!kinds||!kinds.length||kinds.indexOf(x.kind)>-1)});
  return slots.map(function(x){return '<a class="partner" href="'+esc(safeUrl(x.link))+'" target="_blank" rel="sponsored noopener">'+esc(x.label)+' &nearr;</a>'}).join("");
}
function renderBlock(b,r){
  if(b.type==="book"){
    var btns=r?slotButtons(r,b.kinds):"";
    if(!btns)return "";
    return '<div class="rbook"><b>'+esc(b.title||"Ready to book?")+'</b>'+(b.text?'<span class="rbooktxt">'+esc(b.text)+'</span>':"")+'<div class="rbookbtns">'+btns+'</div><small>Affiliate links. We may earn a commission at no extra cost to you.</small></div>';
  }
  if(b.type==="places")return '<div class="places">'+(b.items||[]).map(function(p){
    var meta=[["Time",p.time],["Cost",p.cost],["From the station",p.getting]].filter(function(x){return x[1]}).map(function(x){return "<li><b>"+x[0]+":</b> "+esc(x[1])+"</li>"}).join("");
    return '<article class="place"><h3>'+esc(p.name)+'</h3><p>'+esc(p.why)+'</p>'+(meta?'<ul class="pmeta">'+meta+"</ul>":"")+"</article>";
  }).join("")+"</div>";
  if(b.type==="p")return "<p>"+esc(b.text)+"</p>";
  if(b.type==="list")return '<ul class="rlist">'+(b.items||[]).map(li).join("")+"</ul>";
  if(b.type==="tip")return '<div class="tip rtip"><span class="k">Good to know</span>'+esc(b.text)+"</div>";
  if(b.type==="steps")return '<ol class="rsteps">'+(b.items||[]).map(function(x){return "<li><b>"+esc(x.title)+"</b><span>"+esc(x.text)+"</span></li>"}).join("")+"</ol>";
  if(b.type==="table")return '<div class="dscroll"><table class="rtable"><thead><tr>'+(b.head||[]).map(function(h){return '<th scope="col">'+esc(h)+"</th>"}).join("")+"</tr></thead><tbody>"+
    (b.rows||[]).map(function(r){return "<tr>"+r.map(function(c,i){return i===0?'<th scope="row">'+esc(c)+"</th>":"<td>"+esc(c)+"</td>"}).join("")+"</tr>"}).join("")+"</tbody></table></div>";
  return "";
}
function partnerButtons(r){
  var slots=((AFF.routes||{})[r.id]||[]).filter(function(x){return x.link});
  return slots.map(function(x){return '<a class="partner" href="'+esc(safeUrl(x.link))+'" target="_blank" rel="sponsored noopener">'+esc(x.label)+' &nearr;</a>'}).join("");
}
function renderRoute(r){
  var f=COUNTRIES[r.from.country],t=COUNTRIES[r.to.country];
  setMeta(r.title+" · Euro Transit Guide",r.summary||r.short);
  setLd((r.faq||[]).length?{"@context":"https://schema.org","@type":"FAQPage",mainEntity:r.faq.map(function(x){return {"@type":"Question",name:x.q,acceptedAnswer:{"@type":"Answer",text:x.a}}})}:null);
  COPY_TEXT=[r.title,(r.from.station||r.from.city)+" to "+(r.to.station||r.to.city),""].concat(r.stats.map(function(x){return x.label+": "+x.value}),[""],(r.official||[]).map(function(o){return o.label+": "+o.url}),["","Full guide: "+location.href.split("#")[0]+"#route-"+r.id]).join("\n");
  var partners=partnerButtons(r);
  var official=(r.official||[]).map(function(o){return '<a class="official" href="'+esc(safeUrl(o.url))+'" target="_blank" rel="noopener">'+esc(o.label)+' &nearr;</a>'}).join("");
  var nav=(r.sections||[]).map(function(sc){return '<a href="#route-'+esc(r.id)+'" data-jump="'+esc(sc.id)+'">'+esc(sc.title)+'</a>'}).join("");
  var secs=(r.sections||[]).map(function(sc){
    var extra="";
    var useOptions=sc.id==="alternatives"&&(r.options||[]).length>0;
    var blocks=useOptions?(sc.blocks||[]).filter(function(b){return b.type!=="table"}):(sc.blocks||[]);
    if(useOptions){
      extra='<div class="dscroll"><table class="rtable"><thead><tr><th scope="col">Option</th><th scope="col">Door to door</th><th scope="col">From and to</th><th scope="col">Typical price</th><th scope="col">Best for</th></tr></thead><tbody>'+
        r.options.map(function(o){return '<tr><th scope="row">'+esc(o.mode)+'</th><td>'+esc(o.time)+'</td><td>'+esc(o.from)+'</td><td>'+esc(o.price)+'</td><td>'+esc(o.best)+'</td></tr>'}).join("")+"</tbody></table></div>";
    }
    return '<section class="rsec'+(sc.id==="things"?" things":"")+'" id="rs-'+esc(sc.id)+'"><h2>'+esc(sc.title)+'</h2>'+extra+blocks.map(function(b){return renderBlock(b,r)}).join("")+"</section>";
  }).join("");
  var faq=(r.faq||[]).length?'<section class="rsec" id="rs-faq"><h2>Frequently asked questions</h2>'+r.faq.map(function(x){return '<details class="faq"><summary>'+esc(x.q)+"</summary><p>"+esc(x.a)+"</p></details>"}).join("")+"</section>":"";
  var src=(r.sources||[]).length?'<details class="rsources"><summary>Sources</summary><ul>'+r.sources.map(function(x){return '<li><a href="'+esc(safeUrl(x.url))+'" target="_blank" rel="noopener">'+esc(x.title||x.url)+"</a></li>"}).join("")+"</ul></details>":"";
  var verified=r.verified?'<p class="verified">Checked against official sources on '+esc(new Date(r.verified).toLocaleDateString(undefined,{day:"numeric",month:"long",year:"numeric"}))+". Fares, times and rules change, so confirm them with the operator before you book.</p>":"";
  var cityLinks=arrivalBox(r)+relatedRoutes(r);
  $("routepage").innerHTML=
    '<header class="rhead"><p class="k">Route guide</p><h1>'+esc(r.title)+'</h1>'+
    '<p class="rline"><span class="rflag">'+(f?flagSVG(f.flag):"")+'</span><b>'+esc(r.from.station||r.from.city)+'</b> <span aria-hidden="true">&rarr;</span><span class="rflag">'+(t?flagSVG(t.flag):"")+'</span><b>'+esc(r.to.station||r.to.city)+'</b></p>'+
    (r.summary?'<p class="rsum">'+esc(r.summary)+"</p>":"")+
    '<p class="rmeta">'+(r.verified?'<span class="checked">Checked '+esc(fmtDate(r.verified))+'</span>':"")+'<span class="tools">'+toolsHTML()+"</span></p></header>"+
    '<div class="rstats">'+r.stats.map(function(x){return "<div><span>"+esc(x.label)+"</span><b>"+esc(x.value)+"</b></div>"}).join("")+"</div>"+
    '<div class="rquick"><h2>Quick booking and essential links</h2><div class="rquicklinks">'+official+partners+"</div>"+
    (partners?'<p class="muted">Some of these are affiliate links. We may earn a commission at no extra cost to you.</p>':"")+"</div>"+
    '<nav class="rnav" aria-label="On this page">'+nav+(faq?'<a href="#route-'+esc(r.id)+'" data-jump="faq">Frequently asked questions</a>':"")+"</nav>"+
    secs+faq+verified+src+cityLinks;
  $("routepage").querySelectorAll("[data-jump]").forEach(function(a){
    a.addEventListener("click",function(e){e.preventDefault();var t=document.getElementById("rs-"+a.getAttribute("data-jump"));if(t)t.scrollIntoView({behavior:"smooth",block:"start"})});
  });
}
function arrivalBox(r){
  function city(side){
    var c=COUNTRIES[side.country];if(!c)return "";var h=side.country.toLowerCase();
    return '<li><b>'+esc(c.capital)+'</b><a href="#'+h+'-tram">Metro and tram</a><a href="#'+h+'-airport">Airport links</a><a href="#'+h+'-train">All trains</a><a href="#'+h+'-news">Transport news</a></li>';
  }
  return '<section class="rsec related"><h2>Getting around at each end</h2><ul class="golinks">'+city(r.from)+city(r.to)+"</ul></section>";
}
function relatedRoutes(r){
  var shares=function(x){return [r.from.country,r.to.country].some(function(c){return x.from.country===c||x.to.country===c})};
  var rel=ROUTES.filter(function(x){return x.id!==r.id&&shares(x)});
  if(!rel.length)rel=ROUTES.filter(function(x){return x.id!==r.id});
  if(!rel.length)return "";
  return '<section class="rsec related"><h2>More route guides</h2><ul class="routelist">'+rel.slice(0,4).map(function(x){return "<li>"+routeCard(x)+"</li>"}).join("")+"</ul></section>";
}
function countryCopy(c){
  var L=[c.capital+" public transport guide ("+c.name+")"];
  ["train","tram","bus","airport"].forEach(function(k){
    var d=c.modes[k],nm=MODES.filter(function(m){return m[0]===k})[0][1];
    L.push("",nm+": "+d.sum);(d.tickets||[]).slice(0,4).forEach(function(t){L.push("- "+t)});
    if(d.link)L.push("Official site: "+d.link[1]);
  });
  L.push("","Full guide: "+location.href.split("#")[0]+"#"+c.id.toLowerCase());
  return L.join("\n");
}
function renderRouteLinks(cid){
  var rs=routesFor(cid),box=$("routelinks");
  box.innerHTML=rs.length?'<div class="routebanner"><span class="k">Route guides</span>'+rs.map(routeCard).join("")+"</div>":"";
}

function country(id,mode){
  var c=COUNTRIES[id],f=flagDef(c.flag);
  setMeta(c.capital+" transport guide · Euro Transit Guide",c.capital+" public transport guide for visitors: train, tram and metro, bus and airport links, ticket prices, tips, apps and news.");
  setLd(null);
  COPY_TEXT=countryCopy(c);
  $("ctools").innerHTML=toolsHTML();
  $("cflag").setAttribute("viewBox",f.vb);
  $("cflag").setAttribute("preserveAspectRatio","xMidYMid slice");
  $("cflag").innerHTML=f.inner;
  $("cname").textContent=c.capital;
  $("ccap").innerHTML="Capital of "+esc(c.name)+" · public transport for visitors"+(c.verified?' <span class="checked">Prices checked '+esc(fmtDate(c.verified))+"</span>":"");
  $("tabs").innerHTML=MODES.map(function(m){
    return '<button class="tab" role="tab" id="tab-'+m[0]+'" aria-selected="'+(m[0]===mode)+'" style="--c:var('+m[2]+')" data-m="'+m[0]+'">'+esc(m[1])+'</button>'}).join("");
  $("tabs").querySelectorAll(".tab").forEach(function(b){
    b.addEventListener("click",function(){location.hash=id.toLowerCase()+"-"+b.getAttribute("data-m")});
  });
  renderRouteLinks(id);
  var selTab=$("tab-"+mode);
  if(selTab&&selTab.scrollIntoView)selTab.scrollIntoView({block:"nearest",inline:"center"});
  $("sheet").setAttribute("aria-labelledby","tab-"+mode);
  sheet(id,mode);
  var v=$("verified");
  if(c.verified){
    v.innerHTML='Fares checked against official sources on '+esc(new Date(c.verified).toLocaleDateString(undefined,{day:"numeric",month:"long",year:"numeric"}))+'.'+
      ((c.sources||[]).length?' <details><summary>Sources</summary><ul>'+c.sources.map(function(s){return '<li><a href="'+esc(safeUrl(s.url))+'" target="_blank" rel="noopener">'+esc(s.title||s.url)+'</a></li>'}).join("")+'</ul></details>':"");
    v.hidden=false;
  }else v.hidden=true;
}

function route(){
  var raw=(location.hash||"").replace(/^#/,"").toLowerCase();
  if(raw.indexOf("route-")===0){
    var rt=routeById(raw.slice(6));
    if(rt){
      $("home").hidden=true;$("country").hidden=true;$("route").hidden=false;
      renderRoute(rt);hide();window.scrollTo(0,0);return;
    }
  }
  $("route").hidden=true;
  var h=raw.split("-"),id=(h[0]||"").toUpperCase();
  var mode=MODES.some(function(m){return m[0]===h[1]})?h[1]:"train";
  if(COUNTRIES[id]){
    $("home").hidden=true;$("country").hidden=false;
    country(id,mode);hide();
    window.scrollTo(0,0);
  }else{
    setMeta("Euro Transit Guide",BASE_DESC);setLd(null);
    $("country").hidden=true;$("home").hidden=false;
  }
}

/* ---------- boot ---------- */
(window.ETG_DATA
  ? Promise.resolve([window.ETG_DATA,window.ETG_DATA.affiliates||{partners:[]}])
  : Promise.all([getJSON(ROOT+"data/countries.json"),getJSON(ROOT+"data/affiliates.json").catch(function(){return {partners:[]}})]))
.then(function(r){
  var data=r[0];AFF=r[1]||{partners:[]};
  var sc=document.getElementById("static-content");if(sc&&sc.parentNode)sc.parentNode.removeChild(sc);
  GENERAL_TIPS=data.generalTips||[];
  ROUTES=data.routes||[];
  (data.countries||[]).forEach(function(c){COUNTRIES[c.id]=c});
  IDS=Object.keys(COUNTRIES).sort(function(a,b){return COUNTRIES[a].name.localeCompare(COUNTRIES[b].name)});
  $("count").textContent=IDS.length+" capitals";
  $("pickcount").textContent=IDS.length+" countries";
  $("chips").innerHTML=IDS.map(function(id){var c=COUNTRIES[id];
    return '<li><a href="#'+id.toLowerCase()+'">'+flagSVG(c.flag)+'<span>'+esc(c.name)+' <small>'+esc(c.capital)+'</small></span></a></li>'}).join("");
  var hasAff=(AFF.partners||[]).some(function(p){return p.link||(p.cityLinks&&Object.keys(p.cityLinks).length)})||Object.keys(AFF.routes||{}).some(function(k){return (AFF.routes[k]||[]).some(function(x){return x.link})});
  if(hasAff&&AFF.disclosure){$("disclosure").textContent=AFF.disclosure;$("disclosure").hidden=false}
  renderRouteList();
  document.addEventListener("click",function(e){
    var b=e.target.closest&&e.target.closest("[data-copy],[data-print]");if(!b)return;
    if(b.hasAttribute("data-copy"))copyText(COPY_TEXT,b);else window.print();
  });
  if("serviceWorker" in navigator&&/^https?:$/.test(location.protocol)){try{navigator.serviceWorker.register(ROOT+"sw.js").catch(function(){})}catch(e){}}
  window.addEventListener("hashchange",route);
  route();
  loadMap();
}).catch(function(err){
  console.error(err);
  $("mapmsg").textContent="The guide data could not be loaded. Please refresh the page.";
});
})();
