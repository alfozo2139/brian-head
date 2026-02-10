import { useState, useEffect, useRef, useCallback } from "react";

// ─── Real resort data ───────────────────────────────────────────────────────
const RESORT_STATS = {
  base: 24, seasonTotal: 148, runsOpen: 68, runsTotal: 72,
  liftsOpen: 8, liftsTotal: 8, avgAnnual: 222,
};

const REAL_FORECAST = [
  { day:"Monday",    date:"Feb 9",  high:41.5, low:27, snowChance:10, condition:"Flurries Possible", wind:6,  real:true },
  { day:"Tuesday",  date:"Feb 10", high:39.2, low:25, snowChance:10, condition:"Flurries Possible", wind:5,  real:true },
  { day:"Wednesday",date:"Feb 11", high:33.7, low:22, snowChance:65, condition:"Heavy Snow",         wind:12, real:true },
  { day:"Thursday", date:"Feb 12", high:37.4, low:24, snowChance:35, condition:"Snow Showers",       wind:8,  real:true },
  { day:"Friday",   date:"Feb 13", high:33.9, low:21, snowChance:35, condition:"Snow Showers",       wind:9,  real:true },
];

// ─── Helpers ────────────────────────────────────────────────────────────────
function estimateSnow(chance, high) {
  if (chance >= 60) return high <= 34 ? { range:"5–9", mid:7 } : { range:"3–6", mid:4.5 };
  if (chance >= 30) return high <= 34 ? { range:"2–4", mid:3 } : { range:"1–3", mid:2 };
  if (chance >= 10) return { range:"0–1", mid:0.5 };
  return { range:"0", mid:0 };
}
function getIntensity(chance) {
  if (chance >= 60) return "heavy";
  if (chance >= 30) return "moderate";
  return "light";
}
function getPowderRating(chance, high) {
  if (chance >= 60 && high <= 34) return { stars:5, label:"Epic Powder" };
  if (chance >= 60) return { stars:4, label:"Great Powder" };
  if (chance >= 35) return { stars:3, label:"Good Skiing" };
  if (chance >= 10) return { stars:2, label:"Groomed Runs" };
  return { stars:1, label:"Packed Base" };
}

// ─── Snowflake canvas ────────────────────────────────────────────────────────
function SnowCanvas({ dark }) {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let W = canvas.width = canvas.offsetWidth;
    let H = canvas.height = canvas.offsetHeight;
    const flakes = Array.from({length: dark ? 130 : 60}, () => ({
      x: Math.random()*W, y: Math.random()*H,
      r: Math.random()*2.2+0.4, speed: Math.random()*0.6+0.15,
      drift: (Math.random()-0.5)*0.35, opacity: Math.random()*0.4+0.1,
    }));
    let raf;
    const draw = () => {
      ctx.clearRect(0,0,W,H);
      flakes.forEach(f => {
        ctx.beginPath(); ctx.arc(f.x,f.y,f.r,0,Math.PI*2);
        ctx.fillStyle = dark
          ? `rgba(180,215,255,${f.opacity})`
          : `rgba(100,150,210,${f.opacity * 0.6})`;
        ctx.fill();
        f.y += f.speed; f.x += f.drift;
        if (f.y > H) { f.y=-4; f.x=Math.random()*W; }
        if (f.x > W) f.x=0; if (f.x < 0) f.x=W;
      });
      raf = requestAnimationFrame(draw);
    };
    draw();
    const onResize = () => { W=canvas.width=canvas.offsetWidth; H=canvas.height=canvas.offsetHeight; };
    window.addEventListener("resize", onResize);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", onResize); };
  }, [dark]);
  return <canvas ref={ref} style={{position:"absolute",inset:0,width:"100%",height:"100%",pointerEvents:"none",zIndex:0}} />;
}

// ─── Snowflake icon ───────────────────────────────────────────────────────────
function SnowIcon({ size=22, color="#a8d8ff", opacity=0.9 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{opacity,flexShrink:0}}>
      {[["12","2","12","22"],["2","12","22","12"],["4.93","4.93","19.07","19.07"],["19.07","4.93","4.93","19.07"]].map((p,i)=>(
        <line key={i} x1={p[0]} y1={p[1]} x2={p[2]} y2={p[3]} stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      ))}
      {[["12","2","9","5"],["12","2","15","5"],["12","22","9","19"],["12","22","15","19"],
        ["2","12","5","9"],["2","12","5","15"],["22","12","19","9"],["22","12","19","15"]].map((p,i)=>(
        <line key={i+10} x1={p[0]} y1={p[1]} x2={p[2]} y2={p[3]} stroke={color} strokeWidth="1" strokeLinecap="round"/>
      ))}
    </svg>
  );
}

// ─── Star rating ──────────────────────────────────────────────────────────────
function Stars({ count, dark }) {
  return (
    <span style={{letterSpacing:"1px"}}>
      {[1,2,3,4,5].map(i => (
        <span key={i} style={{color: i<=count ? "#4facfe" : (dark?"rgba(255,255,255,0.15)":"rgba(0,0,0,0.12)"),fontSize:"13px"}}>★</span>
      ))}
    </span>
  );
}

// ─── Hourly bar chart ────────────────────────────────────────────────────────
function HourlyChart({ hours, dark }) {
  const maxSnow = Math.max(...hours.map(h=>h.snow), 0.1);
  const t = dark;
  return (
    <div style={{marginTop:"4px"}}>
      <div style={{display:"flex",alignItems:"flex-end",gap:"3px",height:"50px"}}>
        {hours.map((h,i) => (
          <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:"2px"}}>
            <div style={{
              width:"100%", borderRadius:"3px 3px 0 0",
              height: `${Math.max((h.snow/maxSnow)*40,h.snow>0?4:0)}px`,
              background: h.snow > 0
                ? "linear-gradient(to top,#4facfe,#00f2fe)"
                : (t?"rgba(255,255,255,0.05)":"rgba(0,0,0,0.05)"),
              transition:"height 0.5s ease",
              minHeight: h.snow > 0 ? "4px" : "0",
            }}/>
          </div>
        ))}
      </div>
      <div style={{display:"flex",gap:"3px",marginTop:"4px"}}>
        {hours.map((h,i) => (
          <div key={i} style={{flex:1,textAlign:"center",fontSize:"7px",
            color: t?"rgba(140,180,255,0.45)":"rgba(50,80,140,0.5)",
            fontFamily:"'DM Mono',monospace",letterSpacing:"0.02em"}}>
            {h.label}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Detail Modal ─────────────────────────────────────────────────────────────
function DetailModal({ day, dark, onClose }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const t = dark;
  const intensity = getIntensity(day.snowChance);
  const snow = estimateSnow(day.snowChance, day.high);
  const powder = getPowderRating(day.snowChance, day.high);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method:"POST", headers:{"Content-Type":"application/json"},
          body: JSON.stringify({
            model:"claude-sonnet-4-20250514", max_tokens:900,
            messages:[{role:"user", content:`Generate realistic hourly forecast data for Brian Head, Utah ski resort (9,700 ft elevation) for ${day.day} ${day.date} 2026.
Conditions: high ${day.high}°F, low ${day.low || day.high-14}°F, ${day.snowChance}% snow chance, ${day.condition}.

Return ONLY raw JSON (no markdown/backticks):
{
  "peakSnowHour": "e.g. 2PM",
  "snowWindow": "e.g. 10AM–4PM or 'No significant snow'",
  "humidity": 65,
  "visibility": "e.g. 10 miles or Limited",
  "windDir": "e.g. NW",
  "newSnowByMorning": "e.g. 3 inches or Trace",
  "surfaceCondition": "e.g. Packed Powder / Wind Slab / Spring Corn",
  "liftRecommendation": "1-sentence tip for skiers",
  "hours": [
    {"label":"6A","temp":27,"snow":0.0},
    {"label":"9A","temp":29,"snow":0.1},
    {"label":"12P","temp":32,"snow":0.4},
    {"label":"3P","temp":33,"snow":0.6},
    {"label":"6P","temp":30,"snow":0.2},
    {"label":"9P","temp":26,"snow":0.0}
  ]
}

Make temp values realistic (range between low ${day.low || day.high-14} and high ${day.high}°F). Snow amounts per 3hr block in inches. Total across all hours should approximate ${snow.mid}" inches.`}]
          })
        });
        const data = await res.json();
        const text = data.content.map(b=>b.text||"").join("").replace(/```json|```/g,"").trim();
        setDetail(JSON.parse(text));
      } catch(e) {
        setDetail({
          peakSnowHour: day.snowChance >= 60 ? "2PM" : "Midday",
          snowWindow: day.snowChance >= 30 ? "Morning through afternoon" : "Brief flurries only",
          humidity: 68, visibility: day.snowChance >= 60 ? "Limited" : "10 miles",
          windDir: "NW", newSnowByMorning: snow.range + '"',
          surfaceCondition: day.snowChance >= 60 ? "Powder" : "Packed Powder",
          liftRecommendation: "Check resort conditions before heading out.",
          hours: [
            {label:"6A",temp:day.low||26,snow:0},
            {label:"9A",temp:Math.round((day.low||26+day.high)/2)-2, snow: day.snowChance>=60?0.5:day.snowChance>=30?0.2:0},
            {label:"12P",temp:day.high-4, snow: day.snowChance>=60?1.2:day.snowChance>=30?0.5:0.1},
            {label:"3P",temp:day.high,   snow: day.snowChance>=60?1.5:day.snowChance>=30?0.6:0.1},
            {label:"6P",temp:day.high-6, snow: day.snowChance>=60?0.8:day.snowChance>=30?0.3:0},
            {label:"9P",temp:day.low||23,snow:0},
          ]
        });
      } finally { setLoading(false); }
    }
    load();
  }, []);

  const overlay = t ? "rgba(0,0,0,0.7)" : "rgba(50,80,140,0.4)";
  const bg      = t ? "linear-gradient(160deg,#050f28,#020b1c)" : "linear-gradient(160deg,#eaf3ff,#f0f7ff)";
  const cardBg  = t ? "rgba(10,25,60,0.9)" : "rgba(255,255,255,0.95)";
  const border  = t ? "rgba(79,172,254,0.25)" : "rgba(79,172,254,0.3)";
  const txt     = t ? "#daeeff" : "#0a1f4a";
  const sub     = t ? "rgba(140,180,255,0.55)" : "rgba(40,80,160,0.6)";
  const divider = t ? "rgba(255,255,255,0.06)" : "rgba(0,0,100,0.08)";
  const rowBg   = t ? "rgba(255,255,255,0.04)" : "rgba(0,50,160,0.05)";
  const accentColor = intensity === "heavy" ? "#4facfe" : intensity === "moderate" ? "#74b9ff" : "#90afc5";

  return (
    <div onClick={onClose} style={{
      position:"fixed",inset:0,zIndex:100,display:"flex",alignItems:"center",justifyContent:"center",
      background:overlay,backdropFilter:"blur(6px)",padding:"16px",
    }}>
      <div onClick={e=>e.stopPropagation()} style={{
        background:cardBg,border:`1px solid ${border}`,borderRadius:"24px",
        maxWidth:"480px",width:"100%",maxHeight:"90vh",overflowY:"auto",
        boxShadow: t ? "0 24px 60px rgba(0,0,0,0.6),0 0 40px rgba(79,172,254,0.1)" : "0 24px 60px rgba(30,60,160,0.25)",
        animation:"modalIn 0.3s cubic-bezier(0.34,1.4,0.64,1)",
      }}>
        <style>{`@keyframes modalIn{from{opacity:0;transform:translateY(16px) scale(0.97)}to{opacity:1;transform:none}}`}</style>

        {/* Modal header */}
        <div style={{padding:"24px 24px 0",display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
          <div>
            <div style={{fontFamily:"'Playfair Display',serif",fontSize:"28px",fontWeight:900,color:txt,lineHeight:1}}>
              {day.day}
            </div>
            <div style={{fontFamily:"'DM Mono',monospace",fontSize:"10px",letterSpacing:"0.15em",color:sub,marginTop:"4px",textTransform:"uppercase"}}>
              {day.date} · Brian Head, Utah
            </div>
          </div>
          <button onClick={onClose} style={{
            background:"transparent",border:`1px solid ${t?"rgba(255,255,255,0.12)":"rgba(0,0,0,0.12)"}`,
            borderRadius:"8px",padding:"6px 10px",cursor:"pointer",
            fontFamily:"'DM Mono',monospace",fontSize:"11px",color:sub,
          }}>✕ close</button>
        </div>

        {/* Powder rating */}
        <div style={{padding:"16px 24px 0",display:"flex",alignItems:"center",gap:"10px"}}>
          <Stars count={powder.stars} dark={t}/>
          <span style={{fontFamily:"'DM Mono',monospace",fontSize:"11px",color:accentColor,letterSpacing:"0.08em"}}>{powder.label}</span>
        </div>

        {loading ? (
          <div style={{padding:"40px",textAlign:"center"}}>
            <SnowIcon size={32} color={accentColor} opacity={0.5}/>
            <div style={{fontFamily:"'DM Mono',monospace",fontSize:"10px",letterSpacing:"0.15em",color:sub,marginTop:"12px",textTransform:"uppercase"}}>Loading details…</div>
          </div>
        ) : (
          <div style={{padding:"16px 24px 24px",display:"flex",flexDirection:"column",gap:"16px"}}>

            {/* Temp + snow stats */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"10px"}}>
              {[
                {label:"HIGH", value:`${day.high}°F`, color:intensity==="heavy"?"#ff7eb3":"#ff9a4d"},
                {label:"LOW",  value:`${day.low||Math.round(day.high-14)}°F`, color:"#74b9ff"},
                {label:"SNOW", value:snow.range+'"', color:accentColor},
              ].map((s,i)=>(
                <div key={i} style={{background:rowBg,border:`1px solid ${divider}`,borderRadius:"12px",padding:"12px",textAlign:"center"}}>
                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:"8px",letterSpacing:"0.18em",color:sub,textTransform:"uppercase",marginBottom:"4px"}}>{s.label}</div>
                  <div style={{fontFamily:"'Playfair Display',serif",fontSize:"22px",fontWeight:700,color:s.color}}>{s.value}</div>
                </div>
              ))}
            </div>

            {/* Hourly snow chart */}
            <div style={{background:rowBg,border:`1px solid ${divider}`,borderRadius:"14px",padding:"14px"}}>
              <div style={{fontFamily:"'DM Mono',monospace",fontSize:"9px",letterSpacing:"0.15em",color:sub,textTransform:"uppercase",marginBottom:"8px"}}>
                Hourly Snowfall Estimate
              </div>
              <HourlyChart hours={detail.hours} dark={t}/>
              {/* Temp line */}
              <div style={{display:"flex",gap:"3px",marginTop:"10px"}}>
                {detail.hours.map((h,i)=>(
                  <div key={i} style={{flex:1,textAlign:"center",fontFamily:"'DM Mono',monospace",fontSize:"8px",
                    color: t?"rgba(255,160,100,0.7)":"rgba(200,80,40,0.7)"}}>
                    {h.temp}°
                  </div>
                ))}
              </div>
              <div style={{fontFamily:"'DM Mono',monospace",fontSize:"8px",color:sub,marginTop:"2px",textAlign:"center",letterSpacing:"0.05em"}}>
                ↑ Snow inches per period · ↑ Temperature °F
              </div>
            </div>

            {/* Details grid */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px"}}>
              {[
                {label:"Snow Window",   value: detail.snowWindow},
                {label:"Peak Snow",     value: detail.peakSnowHour},
                {label:"Wind",          value: `${day.wind||8} mph ${detail.windDir||"NW"}`},
                {label:"Visibility",    value: detail.visibility},
                {label:"Humidity",      value: `${detail.humidity}%`},
                {label:"Surface",       value: detail.surfaceCondition},
              ].map((item,i)=>(
                <div key={i} style={{background:rowBg,border:`1px solid ${divider}`,borderRadius:"12px",padding:"12px"}}>
                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:"8px",letterSpacing:"0.14em",color:sub,textTransform:"uppercase",marginBottom:"4px"}}>{item.label}</div>
                  <div style={{fontFamily:"'Playfair Display',serif",fontSize:"14px",fontWeight:700,color:txt,lineHeight:1.3}}>{item.value}</div>
                </div>
              ))}
            </div>

            {/* Lift tip */}
            {detail.liftRecommendation && (
              <div style={{
                background: t?"rgba(79,172,254,0.08)":"rgba(79,172,254,0.07)",
                border:`1px solid ${t?"rgba(79,172,254,0.2)":"rgba(79,172,254,0.25)"}`,
                borderRadius:"12px",padding:"14px 16px",
                display:"flex",gap:"10px",alignItems:"flex-start",
              }}>
                <span style={{fontSize:"16px",marginTop:"1px"}}>🎿</span>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:"10px",lineHeight:1.6,color:t?"rgba(150,200,255,0.8)":"rgba(30,70,160,0.75)",letterSpacing:"0.04em"}}>
                  {detail.liftRecommendation}
                </div>
              </div>
            )}

            {/* Resort base stats */}
            <div style={{borderTop:`1px solid ${divider}`,paddingTop:"14px",
              display:"flex",justifyContent:"space-around",gap:"8px",flexWrap:"wrap"}}>
              {[
                {label:"Base Depth",   value:`${RESORT_STATS.base}"`},
                {label:"Season Total", value:`${RESORT_STATS.seasonTotal}"`},
                {label:"Runs Open",    value:`${RESORT_STATS.runsOpen}/${RESORT_STATS.runsTotal}`},
              ].map((s,i)=>(
                <div key={i} style={{textAlign:"center"}}>
                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:"8px",letterSpacing:"0.15em",color:sub,textTransform:"uppercase",marginBottom:"2px"}}>{s.label}</div>
                  <div style={{fontFamily:"'Playfair Display',serif",fontSize:"18px",fontWeight:700,color:accentColor}}>{s.value}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Day card ────────────────────────────────────────────────────────────────
function DayCard({ day, dark, index, visible, onClick }) {
  const [hovered, setHovered] = useState(false);
  const t = dark;
  const intensity = getIntensity(day.snowChance);
  const snow = estimateSnow(day.snowChance, day.high);

  const barColor = intensity==="heavy"
    ? "linear-gradient(90deg,#4facfe,#00f2fe)"
    : intensity==="moderate"
    ? "linear-gradient(90deg,#74b9ff,#a29bfe)"
    : "linear-gradient(90deg,#b2bec3,#74b9ff)";

  const glowColor = intensity==="heavy"
    ? t?"rgba(79,172,254,0.28)":"rgba(79,172,254,0.18)"
    : intensity==="moderate"
    ? t?"rgba(116,185,255,0.14)":"rgba(116,185,255,0.1)"
    : "rgba(178,190,195,0.06)";

  const borderColor = intensity==="heavy"
    ? t?"rgba(79,172,254,0.4)":"rgba(79,172,254,0.35)"
    : intensity==="moderate"
    ? t?"rgba(116,185,255,0.22)":"rgba(116,185,255,0.3)"
    : t?"rgba(255,255,255,0.09)":"rgba(0,50,150,0.12)";

  const bg = day.real
    ? t ? "linear-gradient(135deg,rgba(10,25,60,0.82),rgba(5,15,40,0.92))"
        : "rgba(255,255,255,0.88)"
    : t ? "linear-gradient(135deg,rgba(8,18,45,0.65),rgba(4,10,28,0.78))"
        : "rgba(240,248,255,0.82)";

  const txt  = t ? "#e8f4ff" : "#0a1f4a";
  const sub  = t ? "rgba(140,180,255,0.5)" : "rgba(40,80,160,0.55)";

  return (
    <div
      onClick={onClick}
      onMouseEnter={()=>setHovered(true)}
      onMouseLeave={()=>setHovered(false)}
      style={{
        background:bg,
        border:`1px solid ${borderColor}`,
        borderRadius:"18px", padding:"18px 14px",
        boxShadow: hovered
          ? `0 10px 36px rgba(0,0,0,${t?0.5:0.18}),0 0 24px ${glowColor}`
          : `0 4px 20px rgba(0,0,0,${t?0.35:0.1}),0 0 14px ${glowColor}`,
        backdropFilter:"blur(14px)",
        transform: visible
          ? hovered ? "translateY(-3px) scale(1.02)" : "translateY(0) scale(1)"
          : "translateY(18px) scale(0.96)",
        opacity: visible ? 1 : 0,
        transition:`all 0.4s cubic-bezier(0.34,1.4,0.64,1) ${index*0.055}s`,
        display:"flex", flexDirection:"column", gap:"11px",
        position:"relative", overflow:"hidden",
        cursor:"pointer",
      }}
    >
      {/* Click hint */}
      {hovered && (
        <div style={{
          position:"absolute",top:"8px",left:"50%",transform:"translateX(-50%)",
          background: t?"rgba(79,172,254,0.18)":"rgba(79,172,254,0.12)",
          border:`1px solid ${t?"rgba(79,172,254,0.3)":"rgba(79,172,254,0.25)"}`,
          borderRadius:"6px", padding:"2px 8px",
          fontFamily:"'DM Mono',monospace", fontSize:"7px", letterSpacing:"0.12em",
          color: t?"rgba(150,210,255,0.9)":"rgba(30,90,200,0.8)", textTransform:"uppercase",
          whiteSpace:"nowrap",
        }}>tap for details</div>
      )}

      {!day.real && (
        <div style={{
          position:"absolute",top:"8px",right:"8px",
          background:"rgba(160,130,255,0.14)",border:"1px solid rgba(160,130,255,0.22)",
          borderRadius:"5px",padding:"2px 5px",
          fontFamily:"'DM Mono',monospace",fontSize:"7px",letterSpacing:"0.1em",
          color:"rgba(160,130,255,0.75)",textTransform:"uppercase",
        }}>AI</div>
      )}

      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginTop:"16px"}}>
        <div>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:"16px",fontWeight:700,color:day.real?txt:"rgba(100,140,200,0.85)",letterSpacing:"0.01em"}}>{day.day}</div>
          <div style={{fontFamily:"'DM Mono',monospace",fontSize:"9px",color:sub,marginTop:"1px",letterSpacing:"0.1em",textTransform:"uppercase"}}>{day.date}</div>
        </div>
        <SnowIcon
          size={intensity==="heavy"?24:intensity==="moderate"?20:15}
          color={t?"#a8d8ff":"#4a8ece"}
          opacity={intensity==="heavy"?0.95:intensity==="moderate"?0.65:0.35}
        />
      </div>

      <div style={{textAlign:"center",padding:"2px 0"}}>
        <div style={{
          fontFamily:"'Playfair Display',serif",fontSize:"30px",fontWeight:700,
          background:day.real?barColor:"linear-gradient(90deg,rgba(116,185,255,0.7),rgba(162,155,254,0.7))",
          WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",lineHeight:1,
        }}>{snow.range}"</div>
        <div style={{fontFamily:"'DM Mono',monospace",fontSize:"8px",color:sub,letterSpacing:"0.12em",textTransform:"uppercase",marginTop:"2px"}}>est. snowfall</div>
      </div>

      <div style={{
        background:intensity==="heavy"?t?"rgba(79,172,254,0.13)":"rgba(79,172,254,0.08)"
          :intensity==="moderate"?t?"rgba(116,185,255,0.09)":"rgba(116,185,255,0.07)"
          :t?"rgba(255,255,255,0.04)":"rgba(0,0,0,0.03)",
        border:`1px solid ${day.real?borderColor:t?"rgba(255,255,255,0.05)":"rgba(0,0,100,0.06)"}`,
        borderRadius:"7px",padding:"4px 8px",textAlign:"center",
        fontFamily:"'DM Mono',monospace",fontSize:"8px",letterSpacing:"0.09em",
        color:intensity==="heavy"?"#4facfe":intensity==="moderate"?t?"#9ac4f8":"#3a7fc1":t?"#5f7a96":"#6b8dad",
        textTransform:"uppercase",
      }}>{day.condition}</div>

      <div>
        <div style={{display:"flex",justifyContent:"space-between",fontFamily:"'DM Mono',monospace",fontSize:"8px",color:sub,letterSpacing:"0.07em",marginBottom:"4px"}}>
          <span>SNOW %</span><span style={{color:t?"#8fcfff":"#3a7fc1"}}>{day.snowChance}%</span>
        </div>
        <div style={{height:"3px",background:t?"rgba(255,255,255,0.06)":"rgba(0,50,150,0.08)",borderRadius:"99px",overflow:"hidden"}}>
          <div style={{
            height:"100%",width:`${day.snowChance}%`,
            background:day.real?barColor:"linear-gradient(90deg,rgba(116,185,255,0.6),rgba(162,155,254,0.6))",
            borderRadius:"99px",
          }}/>
        </div>
      </div>

      <div style={{display:"flex",justifyContent:"space-between",fontFamily:"'DM Mono',monospace",fontSize:"9px",color:sub}}>
        <span>↑{day.high}° ↓{day.low||Math.round(day.high-14)}°F</span>
        <span>💨{day.wind||"—"}mph</span>
      </div>
    </div>
  );
}

// ─── Main App ────────────────────────────────────────────────────────────────
export default function App() {
  const [dark, setDark] = useState(true);
  const [allForecast, setAllForecast] = useState(REAL_FORECAST.map(d=>({...d})));
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);
  const [visible, setVisible] = useState(false);
  const [activeWeek, setActiveWeek] = useState(0);
  const [selected, setSelected] = useState(null);

  const t = dark;

  useEffect(()=>{
    async function fetchExtended() {
      try {
        const res = await fetch("https://api.anthropic.com/v1/messages",{
          method:"POST",headers:{"Content-Type":"application/json"},
          body:JSON.stringify({
            model:"claude-sonnet-4-20250514",max_tokens:1000,
            messages:[{role:"user",content:`Generate a realistic 9-day extended snow forecast for Brian Head, Utah ski resort (9,700 ft) for Feb 14–22, 2026. Return ONLY raw JSON array, no markdown, no backticks:
[{"day":"Saturday","date":"Feb 14","high":36,"low":22,"snowChance":20,"condition":"Partly Cloudy","wind":5}]
- day: full weekday name, date: "Feb 14" etc, high: 28–44°F, low: 15–32°F, snowChance: 0–75 int
- condition: one of: Clear, Partly Cloudy, Cloudy, Flurries Possible, Light Snow, Snow Showers, Heavy Snow
- wind: mph integer 3–18. Mix realistic active/clear days. Exactly 9 entries Feb 14–22.`}]
          })
        });
        const data = await res.json();
        const text = data.content.map(b=>b.text||"").join("").replace(/```json|```/g,"").trim();
        const ext  = JSON.parse(text);
        setAllForecast(prev=>[...prev,...ext.map(d=>({...d,real:false}))]);
      } catch(e) { setError("Extended forecast unavailable."); }
      finally { setLoading(false); setTimeout(()=>setVisible(true),80); }
    }
    fetchExtended();
  },[]);

  useEffect(()=>{ if(!loading) setTimeout(()=>setVisible(true),80); },[loading]);

  const week1 = allForecast.slice(0,7);
  const week2 = allForecast.slice(7,14);
  const displayDays = activeWeek===0 ? week1 : week2;
  const bestDay = allForecast.length ? allForecast.reduce((a,b)=>a.snowChance>b.snowChance?a:b) : null;
  const snowDays = allForecast.filter(d=>d.snowChance>=30).length;

  // ── theme tokens ─────────────────────────────────────────────────────────
  const bg      = t ? "linear-gradient(160deg,#020c1f 0%,#04122a 45%,#020810 100%)"
                    : "linear-gradient(160deg,#e0eeff 0%,#eaf5ff 45%,#d8ecff 100%)";
  const txt     = t ? "#e8f4ff" : "#071830";
  const sub     = t ? "rgba(140,180,255,0.5)" : "rgba(30,70,160,0.55)";
  const cardBg  = t ? "rgba(10,25,60,0.75)" : "rgba(255,255,255,0.8)";
  const border  = t ? "rgba(79,172,254,0.22)" : "rgba(79,172,254,0.3)";
  const divider = t ? "rgba(255,255,255,0.07)" : "rgba(0,50,150,0.1)";
  const pill    = t ? "rgba(79,172,254,0.1)" : "rgba(79,172,254,0.1)";
  const pillBorder = t ? "rgba(79,172,254,0.22)" : "rgba(79,172,254,0.3)";

  return (
    <div style={{minHeight:"100vh",background:bg,position:"relative",overflow:"hidden",fontFamily:"'DM Mono',monospace",transition:"background 0.4s ease"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;900&family=DM+Mono:wght@300;400;500&display=swap');
        *{box-sizing:border-box;}
        ::-webkit-scrollbar{width:4px;}
        ::-webkit-scrollbar-thumb{background:rgba(100,150,220,0.25);border-radius:2px;}
      `}</style>

      <SnowCanvas dark={dark}/>

      {/* Theme toggle */}
      <div style={{position:"fixed",top:"16px",right:"16px",zIndex:50}}>
        <button onClick={()=>setDark(!dark)} style={{
          background: t?"rgba(10,25,60,0.8)":"rgba(255,255,255,0.85)",
          border:`1px solid ${border}`,borderRadius:"12px",
          padding:"8px 14px",cursor:"pointer",backdropFilter:"blur(10px)",
          fontFamily:"'DM Mono',monospace",fontSize:"11px",letterSpacing:"0.1em",
          color:t?"#4facfe":"#1a4a9a",
          boxShadow: t?"0 4px 16px rgba(0,0,0,0.4)":"0 4px 16px rgba(30,60,160,0.15)",
          display:"flex",alignItems:"center",gap:"7px",
          transition:"all 0.25s ease",
        }}>
          {t ? "☀️ Light Mode" : "🌙 Dark Mode"}
        </button>
      </div>

      <div style={{position:"relative",zIndex:2,maxWidth:"1080px",margin:"0 auto",padding:"48px 20px 64px"}}>

        {/* Header */}
        <div style={{textAlign:"center",marginBottom:"36px"}}>
          <div style={{
            display:"inline-flex",alignItems:"center",gap:"7px",
            background:pill,border:`1px solid ${pillBorder}`,
            borderRadius:"99px",padding:"5px 16px",marginBottom:"18px",
          }}>
            <SnowIcon size={13} color={t?"#4facfe":"#2a7fd4"} opacity={0.9}/>
            <span style={{fontSize:"9px",letterSpacing:"0.2em",color:t?"#4facfe":"#2a7fd4",textTransform:"uppercase"}}>2-Week Snow Forecast</span>
          </div>
          <h1 style={{
            fontFamily:"'Playfair Display',serif",
            fontSize:"clamp(42px,7vw,70px)",fontWeight:900,color:txt,
            margin:"0 0 6px",lineHeight:1.05,letterSpacing:"-0.02em",
            textShadow:t?"0 0 60px rgba(79,172,254,0.28)":"0 2px 20px rgba(30,80,200,0.12)",
          }}>Brian Head</h1>
          <div style={{fontSize:"11px",letterSpacing:"0.2em",color:sub,textTransform:"uppercase",marginBottom:"18px"}}>
            Utah · 9,700 ft · Feb 9 – 22, 2026
          </div>
          {bestDay && (
            <div style={{
              display:"inline-block",
              background:t?"linear-gradient(135deg,rgba(10,25,60,0.8),rgba(5,15,40,0.9))":"rgba(255,255,255,0.85)",
              border:`1px solid ${border}`,borderRadius:"14px",
              padding:"12px 24px",boxShadow:t?"0 0 28px rgba(79,172,254,0.12)":"0 4px 20px rgba(30,80,200,0.1)",
            }}>
              <span style={{fontSize:"10px",letterSpacing:"0.1em",color:sub,textTransform:"uppercase"}}>
                ❄️ Best powder day:{" "}
                <span style={{color:t?"#4facfe":"#1a6abf",fontWeight:500}}>
                  {bestDay.day} {bestDay.date} — {bestDay.snowChance}% · {estimateSnow(bestDay.snowChance,bestDay.high).range}"
                </span>
                {!bestDay.real && <span style={{color:"rgba(160,130,255,0.7)",fontSize:"9px"}}> (AI est.)</span>}
              </span>
            </div>
          )}
        </div>

        {/* Resort stats */}
        <div style={{display:"flex",justifyContent:"center",gap:"10px",marginBottom:"30px",flexWrap:"wrap"}}>
          {[
            {label:"Base Depth",    value:`${RESORT_STATS.base}"`,                  icon:"❄️"},
            {label:"Season Total",  value:`${RESORT_STATS.seasonTotal}"`,            icon:"📊"},
            {label:"Runs Open",     value:`${RESORT_STATS.runsOpen}/${RESORT_STATS.runsTotal}`, icon:"⛷️"},
            {label:"Snow Days (2wk)",value:`${snowDays}`,                             icon:"🌨️"},
            {label:"Avg Annual",    value:`${RESORT_STATS.avgAnnual}"`,              icon:"📅"},
          ].map((s,i)=>(
            <div key={i} style={{
              background:cardBg,border:`1px solid ${divider}`,
              borderRadius:"12px",padding:"11px 16px",textAlign:"center",backdropFilter:"blur(10px)",
              minWidth:"90px",
            }}>
              <div style={{fontSize:"14px",marginBottom:"3px"}}>{s.icon}</div>
              <div style={{fontFamily:"'Playfair Display',serif",fontSize:"16px",fontWeight:700,color:t?"#c0deff":"#1a3a7a"}}>{s.value}</div>
              <div style={{fontSize:"8px",letterSpacing:"0.15em",color:sub,textTransform:"uppercase",marginTop:"2px"}}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Week toggle */}
        <div style={{display:"flex",justifyContent:"center",marginBottom:"26px",gap:"10px",flexWrap:"wrap"}}>
          {["Week 1 · Feb 9–15","Week 2 · Feb 16–22"].map((label,i)=>(
            <button key={i} onClick={()=>setActiveWeek(i)} style={{
              background:activeWeek===i
                ? t?"rgba(79,172,254,0.18)":"rgba(79,172,254,0.12)"
                : t?"rgba(255,255,255,0.04)":"rgba(255,255,255,0.6)",
              border:activeWeek===i?`1px solid ${t?"rgba(79,172,254,0.45)":"rgba(79,172,254,0.4)"}`:`1px solid ${divider}`,
              borderRadius:"10px",padding:"9px 20px",cursor:"pointer",
              fontFamily:"'DM Mono',monospace",fontSize:"10px",letterSpacing:"0.12em",
              color:activeWeek===i?t?"#4facfe":"#1a6abf":sub,
              textTransform:"uppercase",transition:"all 0.25s ease",
              boxShadow:activeWeek===i?"0 0 16px rgba(79,172,254,0.12)":"none",
            }}>
              {label}
              {i===1 && <span style={{fontSize:"7px",color:"rgba(160,130,255,0.65)",marginLeft:"6px"}}>AI EXT.</span>}
            </button>
          ))}
        </div>

        {/* Hint */}
        <div style={{textAlign:"center",marginBottom:"18px",fontFamily:"'DM Mono',monospace",fontSize:"9px",letterSpacing:"0.1em",color:sub,textTransform:"uppercase"}}>
          Click any day for detailed hourly forecast
        </div>

        {/* Grid */}
        {loading ? (
          <div style={{textAlign:"center",padding:"60px 20px"}}>
            <SnowIcon size={36} color={t?"#4facfe":"#2a7fd4"} opacity={0.5}/>
            <div style={{fontSize:"11px",letterSpacing:"0.15em",color:sub,textTransform:"uppercase",marginTop:"14px"}}>Generating extended forecast…</div>
          </div>
        ) : error ? (
          <div style={{textAlign:"center",padding:"40px",color:"rgba(255,100,100,0.6)",fontSize:"11px",letterSpacing:"0.1em"}}>{error}</div>
        ) : (
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:"12px"}}>
            {displayDays.map((f,i)=>(
              <DayCard key={`${f.day}-${f.date}`} day={f} dark={dark} index={i} visible={visible} onClick={()=>setSelected(f)}/>
            ))}
          </div>
        )}

        {/* Legend */}
        <div style={{display:"flex",justifyContent:"center",gap:"20px",marginTop:"30px",flexWrap:"wrap"}}>
          {[
            {color:"rgba(79,172,254,0.7)",label:"Live forecast (5 days)"},
            {color:"rgba(160,130,255,0.7)",label:"AI extended estimate"},
          ].map((item,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:"7px"}}>
              <div style={{width:"10px",height:"10px",borderRadius:"3px",background:item.color}}/>
              <span style={{fontSize:"9px",letterSpacing:"0.1em",color:sub,textTransform:"uppercase"}}>{item.label}</span>
            </div>
          ))}
        </div>

        <div style={{textAlign:"center",marginTop:"18px",fontSize:"9px",letterSpacing:"0.1em",color:t?"rgba(80,110,160,0.3)":"rgba(30,60,140,0.3)",textTransform:"uppercase"}}>
          Resort stats as of Feb 8, 2026 · Base 24" · Season 148" · 68/72 runs open
        </div>
      </div>

      {/* Detail modal */}
      {selected && <DetailModal day={selected} dark={dark} onClose={()=>setSelected(null)}/>}
    </div>
  );
}
