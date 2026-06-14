// fetch-results.js — run by GitHub Actions on a schedule.
// Pulls World Cup group results from ESPN's public feed and writes results.json.
// The web page reads results.json (same-origin) and fills the leaderboard automatically.
// Node 20+ (built-in fetch). No API key required.

const fs = require("fs");

const GROUPS = {
  A:["Mexico","South Africa","South Korea","Czechia"],
  B:["Canada","Switzerland","Qatar","Bosnia & H."],
  C:["Brazil","Morocco","Haiti","Scotland"],
  D:["United States","Paraguay","Australia","Türkiye"],
  E:["Germany","Curaçao","Ivory Coast","Ecuador"],
  F:["Netherlands","Japan","Sweden","Tunisia"],
  G:["Belgium","Egypt","Iran","New Zealand"],
  H:["Spain","Cape Verde","Saudi Arabia","Uruguay"],
  I:["France","Senegal","Iraq","Norway"],
  J:["Argentina","Algeria","Austria","Jordan"],
  K:["Portugal","DR Congo","Uzbekistan","Colombia"],
  L:["England","Croatia","Ghana","Panama"]
};

const MATCHES = [];
for (const [g, t] of Object.entries(GROUPS))
  for (let i = 0; i < t.length; i++)
    for (let j = i + 1; j < t.length; j++) MATCHES.push({ g, a: t[i], b: t[j] });

const PAIR2K = {};
MATCHES.forEach((m, k) => { PAIR2K[m.a + "|" + m.b] = k; PAIR2K[m.b + "|" + m.a] = k; });

const ALIAS = { usa:"United States", unitedstates:"United States", korearepublic:"South Korea",
  korea:"South Korea", czechrepublic:"Czechia", turkey:"Türkiye", turkiye:"Türkiye",
  cotedivoire:"Ivory Coast", ivorycoast:"Ivory Coast", congodr:"DR Congo", drcongo:"DR Congo",
  democraticrepublicofthecongo:"DR Congo", bosniaandherzegovina:"Bosnia & H.",
  bosniaherzegovina:"Bosnia & H.", bosnia:"Bosnia & H.", caboverde:"Cape Verde",
  capeverde:"Cape Verde", curacao:"Curaçao" };
const norm = s => (s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]/g,"");
const NAME2OURS = {};
Object.values(GROUPS).flat().forEach(n => NAME2OURS[norm(n)] = n);
Object.entries(ALIAS).forEach(([k,v]) => NAME2OURS[norm(k)] = v);
const findTeam = n => NAME2OURS[norm(n)] || null;

const LEAGUE = "fifa.world";
const base = `https://site.api.espn.com/apis/site/v2/sports/soccer/${LEAGUE}/scoreboard?dates=`;

async function run(){
  const gres = new Array(MATCHES.length).fill(0);
  const start = new Date(Date.UTC(2026,5,11));
  const today = new Date();
  const dates = [];
  for (let d = new Date(start); d <= today; d.setUTCDate(d.getUTCDate()+1)){
    dates.push(`${d.getUTCFullYear()}${String(d.getUTCMonth()+1).padStart(2,"0")}${String(d.getUTCDate()).padStart(2,"0")}`);
  }

  for (const dt of dates){
    try{
      const r = await fetch(base + dt);
      if(!r.ok) continue;
      const j = await r.json();
      for (const ev of (j.events||[])){
        const comp = ev.competitions && ev.competitions[0];
        if(!comp) continue;
        if(!(ev.status && ev.status.type && ev.status.type.completed)) continue;
        const cs = comp.competitors;
        if(!cs || cs.length !== 2) continue;
        const n0 = findTeam(cs[0].team && (cs[0].team.displayName||cs[0].team.name));
        const n1 = findTeam(cs[1].team && (cs[1].team.displayName||cs[1].team.name));
        if(!n0 || !n1) continue;
        const k = PAIR2K[n0 + "|" + n1];
        if(k === undefined) continue; // group matches only
        const s0 = parseInt(cs[0].score,10), s1 = parseInt(cs[1].score,10);
        let winner = (!isNaN(s0)&&!isNaN(s1)) ? (s0>s1?n0 : s1>s0?n1 : null)
                                              : (cs[0].winner?n0 : cs[1].winner?n1 : null);
        gres[k] = winner===null ? 2 : (winner===MATCHES[k].a ? 1 : 3);
      }
    }catch(e){ /* skip a bad day, keep going */ }
  }

  const out = { group: gres.join(""), updated: new Date().toISOString() };
  fs.writeFileSync("results.json", JSON.stringify(out));
  const played = gres.filter(x=>x).length;
  console.log(`Wrote results.json — ${played}/${MATCHES.length} group matches recorded.`);
}

run();
