import { useState, useEffect, useCallback, useRef } from "react";

const INIT_ACCOUNTS = [
  { id: 1, name: "حساب 1", color: "#4361EE" },
  { id: 2, name: "حساب 2", color: "#06C784" },
  { id: 3, name: "حساب 3", color: "#F72585" },
  { id: 4, name: "حساب 4", color: "#FB8500" },
];
const MONTHS_AR = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
const DAYS_AR_FULL = ["الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت"];
const DAYS_SHORT = ["سب","أح","اث","ثل","أر","خم","جم"];
const STATUS_LIST = [
  { value:"idea",      label:"فكرة",      emoji:"💡", color:"#9CA3AF", bg:"#1f2128" },
  { value:"writing",   label:"كتابة",     emoji:"✍️", color:"#F59E0B", bg:"#2a1f00" },
  { value:"filming",   label:"تصوير",     emoji:"🎬", color:"#3B82F6", bg:"#001a3a" },
  { value:"editing",   label:"مونتاج",    emoji:"✂️", color:"#8B5CF6", bg:"#1a0a2e" },
  { value:"review",    label:"مراجعة",    emoji:"👁️", color:"#EC4899", bg:"#2a001a" },
  { value:"done",      label:"جاهز",      emoji:"✅", color:"#10B981", bg:"#002a1a" },
  { value:"published", label:"منشور",     emoji:"🚀", color:"#6366F1", bg:"#0a0a2e" },
];

const addDays = (d,n) => { const r=new Date(d); r.setDate(r.getDate()+n); return r; };
const toStr   = (d) => { const r=new Date(d); r.setHours(12); return r.toISOString().slice(0,10); };
const todayStr = toStr(new Date());
const fmtFull  = (ds) => { const d=new Date(ds+"T12:00:00"); return `${d.getDate()} ${MONTHS_AR[d.getMonth()]} ${d.getFullYear()}`; };
const fmtDay   = (ds) => { const d=new Date(ds+"T12:00:00"); return DAYS_AR_FULL[d.getDay()]; };

let _uid = Date.now();
const uid = () => String(++_uid);
const newCard = () => ({ id:uid(), idea:"", type:"script", status:"", script:"", notes:"", accountIds:[1], done:false });

const save = async (k,v) => { try { await window.storage.set(k,JSON.stringify(v)); } catch(e){} };
const load = async (k,fb) => { try { const r=await window.storage.get(k); return r?JSON.parse(r.value):fb; } catch(e){ return fb; } };

// ── useBreakpoint ──────────────────────────────────────────────
function useBreakpoint() {
  const [w, setW] = useState(window.innerWidth);
  useEffect(() => {
    const h = () => setW(window.innerWidth);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return { isMobile: w < 640, isTablet: w >= 640 && w < 1024, isDesktop: w >= 1024, width: w };
}

// ── Main ───────────────────────────────────────────────────────
export default function App() {
  const bp = useBreakpoint();
  const [tab, setTab]         = useState("calendar");
  const [monthRef, setMonthRef] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [accounts, setAccounts] = useState(INIT_ACCOUNTS);
  const [dayData,  setDayData]  = useState({});
  const [selected, setSelected] = useState(null);
  const [panelOpen,setPanelOpen]= useState(false);
  const [editAcc,  setEditAcc]  = useState(null);
  const [tempName, setTempName] = useState("");
  const [ready,    setReady]    = useState(false);
  const panelRef = useRef(null);

  useEffect(() => {
    (async () => {
      const acc = await load("acc_v4", INIT_ACCOUNTS);
      const dd  = await load("day_v4", {});
      setAccounts(acc); setDayData(dd); setReady(true);
    })();
  }, []);
  useEffect(() => { if(ready) save("acc_v4", accounts); }, [accounts, ready]);
  useEffect(() => { if(ready) save("day_v4", dayData);  }, [dayData,  ready]);

  const getDay  = useCallback((ds) => dayData[ds] || { off:false, done:false, cards:[] }, [dayData]);
  const setDay  = (ds, fn) => setDayData(p => { const c=p[ds]||{off:false,done:false,cards:[]}; return {...p,[ds]:fn(c)}; });
  const getAcc  = (id) => accounts.find(a=>a.id===id) || accounts[0];
  const addCard = (ds) => setDay(ds, d => ({...d, cards:[...d.cards, newCard()]}));
  const delCard = (ds,cid) => setDay(ds, d => ({...d, cards:d.cards.filter(c=>c.id!==cid)}));
  const updCard = (ds,cid,field,val) => setDay(ds, d => ({...d, cards:d.cards.map(c=>c.id===cid?{...c,[field]:val}:c)}));
  const toggleDone = (ds) => setDay(ds, d => ({...d, done:!d.done}));
  const toggleOff  = (ds) => setDay(ds, d => ({...d, off:!d.off, cards:d.off?d.cards:[]}));

  const openDay = (ds) => { setSelected(ds); setPanelOpen(true); if(bp.isMobile && panelRef.current) panelRef.current.scrollTo(0,0); };
  const closePanel = () => { setPanelOpen(false); setTimeout(()=>setSelected(null), 300); };

  // Stats for current month
  const stats = (() => {
    const y=monthRef.getFullYear(), m=monthRef.getMonth();
    let total=0, done=0, byStatus={}, byAccount={};
    Object.entries(dayData).forEach(([ds,day]) => {
      const d=new Date(ds); if(d.getFullYear()!==y||d.getMonth()!==m||day.off) return;
      (day.cards||[]).forEach(c => {
        total++; if(day.done||c.done) done++;
        byStatus[c.status||"idea"]=(byStatus[c.status||"idea"]||0)+1;
        (c.accountIds||[1]).forEach(aid=>{byAccount[aid]=(byAccount[aid]||0)+1;});
      });
    });
    return {total,done,byStatus,byAccount};
  })();

  // Calendar grid (starts Saturday = day 6)
  const buildGrid = () => {
    const y=monthRef.getFullYear(), m=monthRef.getMonth();
    const first=new Date(y,m,1), last=new Date(y,m+1,0);
    const offset=(first.getDay()+1)%7;
    const cells=[];
    for(let i=0;i<offset;i++) cells.push(null);
    for(let d=1;d<=last.getDate();d++) cells.push(new Date(y,m,d));
    while(cells.length%7!==0) cells.push(null);
    return cells;
  };

  const F = { fontFamily:"'Segoe UI',Tahoma,Arial,sans-serif" };

  if(!ready) return (
    <div style={{...F,direction:"rtl",minHeight:"100vh",background:"#0D1117",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff"}}>
      <div style={{textAlign:"center"}}>
        <div style={{fontSize:40,marginBottom:12}}>⏳</div>
        <div style={{fontSize:14,color:"#7D8590"}}>جاري التحميل...</div>
      </div>
    </div>
  );

  const grid = buildGrid();
  const selDay = selected ? getDay(selected) : null;
  const showSideBySide = bp.isDesktop && panelOpen;

  return (
    <div style={{...F, direction:"rtl", minHeight:"100vh", background:"#0D1117", color:"#E6EDF3", display:"flex", flexDirection:"column", maxWidth:"100vw", overflowX:"hidden"}}>

      {/* ── HEADER ── */}
      <div style={{background:"#161B22", borderBottom:"1px solid #21262D", padding: bp.isMobile ? "12px 14px" : "14px 22px"}}>
        <div style={{display:"flex", alignItems:"center", justifyContent:"space-between", gap:10, flexWrap:"wrap"}}>
          <div style={{display:"flex", alignItems:"center", gap:10}}>
            <div style={{width:36,height:36,borderRadius:10,background:"linear-gradient(135deg,#4361EE,#F72585)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>📅</div>
            <div>
              <div style={{fontWeight:900, fontSize: bp.isMobile ? 14 : 16, color:"#fff"}}>جدول المحتوى</div>
              <div style={{fontSize:10,color:"#7D8590"}}>٤ حسابات • تقويم تفاعلي</div>
            </div>
          </div>
          <div style={{display:"flex", gap:5, flexWrap:"wrap"}}>
            {accounts.map(a => (
              <button key={a.id} onClick={()=>{setEditAcc(a.id);setTempName(a.name);}}
                style={{border:`1.5px solid ${a.color}50`,borderRadius:20,padding:"4px 10px",fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"inherit",background:`${a.color}20`,color:a.color}}>
                ✏️ {bp.isMobile ? `ح${a.id}` : a.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── TABS ── */}
      <div style={{background:"#161B22", borderBottom:"1px solid #21262D", display:"flex", padding:"0 14px", overflowX:"auto"}}>
        {[{id:"calendar",label:"🗓️ التقويم"},{id:"stats",label:"📊 الإحصائيات"}].map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{
            border:"none",borderRadius:0,background:"none",padding: bp.isMobile?"10px 14px":"12px 18px",
            borderBottom:tab===t.id?"2px solid #4361EE":"2px solid transparent",
            color:tab===t.id?"#4361EE":"#7D8590",fontSize: bp.isMobile?12:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap",
          }}>{t.label}</button>
        ))}
      </div>

      {/* ══ CALENDAR TAB ══ */}
      {tab==="calendar" && (
        <div style={{display:"flex", flex:1, overflow:"hidden", position:"relative"}}>

          {/* Calendar column */}
          <div style={{
            flex: showSideBySide ? "0 0 55%" : "1",
            overflowY:"auto", padding: bp.isMobile ? "12px 10px" : "18px 20px",
            transition:"flex 0.3s ease",
          }}>
            {/* Month nav */}
            <div style={{display:"flex", alignItems:"center", gap:8, marginBottom:14}}>
              <button onClick={()=>setMonthRef(d=>new Date(d.getFullYear(),d.getMonth()-1,1))}
                style={{border:"none",borderRadius:8,padding:"8px 12px",background:"#21262D",color:"#8B949E",cursor:"pointer",fontFamily:"inherit",fontSize:15,fontWeight:700}}>‹</button>
              <div style={{flex:1, textAlign:"center", fontWeight:900, fontSize: bp.isMobile?15:17, color:"#fff"}}>
                {MONTHS_AR[monthRef.getMonth()]} {monthRef.getFullYear()}
              </div>
              <button onClick={()=>setMonthRef(d=>new Date(d.getFullYear(),d.getMonth()+1,1))}
                style={{border:"none",borderRadius:8,padding:"8px 12px",background:"#21262D",color:"#8B949E",cursor:"pointer",fontFamily:"inherit",fontSize:15,fontWeight:700}}>›</button>
              <button onClick={()=>setMonthRef(new Date(new Date().getFullYear(),new Date().getMonth(),1))}
                style={{border:"none",borderRadius:8,padding:"7px 12px",background:"#4361EE",color:"#fff",cursor:"pointer",fontFamily:"inherit",fontSize:11,fontWeight:700}}>اليوم</button>
            </div>

            {/* Day headers */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap: bp.isMobile?2:3,marginBottom: bp.isMobile?2:3}}>
              {DAYS_SHORT.map((d,i)=>(
                <div key={i} style={{textAlign:"center",padding: bp.isMobile?"5px 2px":"7px 2px",fontSize: bp.isMobile?9:11,fontWeight:800,
                  color:i===0||i===6?"#4B5563":"#4361EE",background:"#161B22",borderRadius:6}}>
                  {d}
                </div>
              ))}
            </div>

            {/* Grid cells */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap: bp.isMobile?2:3}}>
              {grid.map((date,idx)=>{
                if(!date) return <div key={idx} style={{minHeight: bp.isMobile?54:78}}/>;
                const ds=toStr(date);
                const day=getDay(ds);
                const isToday=ds===todayStr;
                const isSel=selected===ds&&panelOpen;
                const cards=day.cards||[];
                return (
                  <div key={ds} onClick={()=>openDay(ds)}
                    style={{
                      minHeight: bp.isMobile?54:78,
                      background:day.off?"#0D1117":isSel?"#1C2128":"#161B22",
                      borderRadius: bp.isMobile?8:10, padding: bp.isMobile?"5px":"7px",
                      cursor:"pointer", border:isSel?"1.5px solid #4361EE":isToday?"1.5px solid #4361EE70":"1px solid #21262D",
                      boxShadow:isSel?"0 0 0 2px rgba(67,97,238,0.15)":"none",
                      transition:"all 0.15s", opacity:day.off?0.45:1, userSelect:"none",
                    }}>
                    {/* Date number */}
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom: bp.isMobile?2:4}}>
                      <span style={{
                        fontSize: bp.isMobile?11:13, fontWeight:800,
                        color:isToday?"#fff":day.done?"#10B981":"#7D8590",
                        background:isToday?"#4361EE":"none",
                        borderRadius:"50%",width:isToday?20:undefined,height:isToday?20:undefined,
                        display:"flex",alignItems:"center",justifyContent:"center",
                      }}>{date.getDate()}</span>
                      {day.done && <span style={{fontSize:bp.isMobile?8:10}}>✅</span>}
                      {day.off  && <span style={{fontSize:bp.isMobile?8:10}}>🌙</span>}
                    </div>
                    {/* Cards preview */}
                    {!day.off && !bp.isMobile && cards.slice(0,2).map((c,i)=>{
                      const a=getAcc((c.accountIds||[1])[0]);
                      const st=STATUS_LIST.find(s=>s.value===c.status);
                      return(
                        <div key={i} style={{borderRadius:4,padding:"2px 5px",marginBottom:2,
                          background:`${a.color}30`,borderRight:`2px solid ${a.color}`,
                          display:"flex",alignItems:"center",gap:2,
                          opacity:day.done||c.done?0.45:1,
                          textDecoration:day.done||c.done?"line-through":"none"}}>
                          <span style={{fontSize:7}}>{st?.emoji||"💡"}</span>
                          <span style={{color:"#E6EDF3",fontSize:9,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1}}>
                            {c.idea||a.name}
                          </span>
                        </div>
                      );
                    })}
                    {/* Mobile: dot indicators */}
                    {!day.off && bp.isMobile && cards.length>0 && (
                      <div style={{display:"flex",gap:2,flexWrap:"wrap",marginTop:2}}>
                        {cards.slice(0,4).map((c,i)=>{
                          const a=getAcc((c.accountIds||[1])[0]);
                          return <div key={i} style={{width:5,height:5,borderRadius:"50%",background:a.color,opacity:day.done||c.done?0.4:1}}/>;
                        })}
                      </div>
                    )}
                    {!day.off && cards.length>2 && !bp.isMobile && (
                      <div style={{fontSize:9,color:"#4361EE",textAlign:"center"}}>+{cards.length-2}</div>
                    )}
                    {!day.off && cards.length===0 && !bp.isMobile && (
                      <div style={{color:"#2D333B",fontSize:9,textAlign:"center",marginTop:6}}>+ أضف</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── SIDE PANEL (Desktop) ── */}
          {showSideBySide && (
            <div style={{width:"45%",borderRight:"1px solid #21262D",background:"#0D1117",display:"flex",flexDirection:"column",overflowY:"auto"}}>
              <DayPanel ds={selected} day={selDay} accounts={accounts} getAcc={getAcc}
                onClose={closePanel} onAddCard={()=>addCard(selected)}
                onDelCard={(cid)=>delCard(selected,cid)}
                onUpdCard={(cid,f,v)=>updCard(selected,cid,f,v)}
                onToggleDone={()=>toggleDone(selected)}
                onToggleOff={()=>toggleOff(selected)} bp={bp}/>
            </div>
          )}

          {/* ── BOTTOM SHEET (Mobile / Tablet) ── */}
          {!bp.isDesktop && panelOpen && selected && (
            <>
              {/* Backdrop */}
              <div onClick={closePanel} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:40,backdropFilter:"blur(2px)"}}/>
              {/* Sheet */}
              <div ref={panelRef} style={{
                position:"fixed", bottom:0, right:0, left:0, zIndex:50,
                background:"#0D1117", borderRadius:"20px 20px 0 0",
                borderTop:"1px solid #30363D",
                maxHeight: bp.isTablet?"80vh":"88vh",
                overflowY:"auto",
                boxShadow:"0 -8px 40px rgba(0,0,0,0.6)",
                animation:"slideUp 0.3s ease",
              }}>
                {/* Drag handle */}
                <div style={{display:"flex",justifyContent:"center",padding:"10px 0 4px"}}>
                  <div style={{width:40,height:4,borderRadius:2,background:"#30363D"}}/>
                </div>
                <DayPanel ds={selected} day={selDay} accounts={accounts} getAcc={getAcc}
                  onClose={closePanel} onAddCard={()=>addCard(selected)}
                  onDelCard={(cid)=>delCard(selected,cid)}
                  onUpdCard={(cid,f,v)=>updCard(selected,cid,f,v)}
                  onToggleDone={()=>toggleDone(selected)}
                  onToggleOff={()=>toggleOff(selected)} bp={bp}/>
              </div>
            </>
          )}
        </div>
      )}

      {/* ══ STATS TAB ══ */}
      {tab==="stats" && (
        <div style={{padding: bp.isMobile?"14px 12px":"20px 24px", overflowY:"auto"}}>
          {/* Month nav */}
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:20}}>
            <button onClick={()=>setMonthRef(d=>new Date(d.getFullYear(),d.getMonth()-1,1))}
              style={{border:"none",borderRadius:8,padding:"8px 12px",background:"#21262D",color:"#8B949E",cursor:"pointer",fontFamily:"inherit",fontSize:15,fontWeight:700}}>‹</button>
            <div style={{flex:1,textAlign:"center",fontWeight:900,fontSize: bp.isMobile?14:17,color:"#fff"}}>
              📊 {MONTHS_AR[monthRef.getMonth()]} {monthRef.getFullYear()}
            </div>
            <button onClick={()=>setMonthRef(d=>new Date(d.getFullYear(),d.getMonth()+1,1))}
              style={{border:"none",borderRadius:8,padding:"8px 12px",background:"#21262D",color:"#8B949E",cursor:"pointer",fontFamily:"inherit",fontSize:15,fontWeight:700}}>›</button>
          </div>

          {/* Summary */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap: bp.isMobile?8:12,marginBottom:20}}>
            {[
              {label:"إجمالي المهام",value:stats.total,     color:"#4361EE",icon:"📋"},
              {label:"مكتملة",       value:stats.done,      color:"#10B981",icon:"✅"},
              {label:"متبقية",       value:stats.total-stats.done, color:"#F72585",icon:"⏳"},
              {label:"نسبة الإنجاز", value:stats.total?Math.round(stats.done/stats.total*100)+"%":"0%",color:"#FB8500",icon:"📈"},
            ].map((s,i)=>(
              <div key={i} style={{background:"#161B22",borderRadius:12,padding: bp.isMobile?"14px 12px":"16px",border:`1px solid ${s.color}25`,textAlign:"center"}}>
                <div style={{fontSize: bp.isMobile?22:26,marginBottom:6}}>{s.icon}</div>
                <div style={{fontSize: bp.isMobile?22:26,fontWeight:900,color:s.color}}>{s.value}</div>
                <div style={{fontSize: bp.isMobile?10:11,color:"#7D8590",marginTop:4}}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Progress bar */}
          {stats.total>0 && (
            <div style={{background:"#161B22",borderRadius:12,padding:"14px 16px",marginBottom:16,border:"1px solid #21262D"}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:10}}>
                <span style={{fontSize:13,fontWeight:700,color:"#fff"}}>تقدم الشهر</span>
                <span style={{fontSize:13,color:"#10B981",fontWeight:800}}>{Math.round(stats.done/stats.total*100)}%</span>
              </div>
              <div style={{background:"#21262D",borderRadius:20,height:10,overflow:"hidden"}}>
                <div style={{height:"100%",width:`${stats.done/stats.total*100}%`,background:"linear-gradient(90deg,#4361EE,#10B981)",borderRadius:20,transition:"width 0.5s"}}/>
              </div>
            </div>
          )}

          {/* Status breakdown */}
          <div style={{background:"#161B22",borderRadius:12,padding:"14px 16px",marginBottom:16,border:"1px solid #21262D"}}>
            <div style={{fontSize:13,fontWeight:800,color:"#fff",marginBottom:12}}>📊 توزيع الحالات</div>
            {STATUS_LIST.map(s=>{
              const count=stats.byStatus[s.value]||0;
              const pct=stats.total?count/stats.total*100:0;
              return(
                <div key={s.value} style={{marginBottom:10}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                    <span style={{fontSize:12,color:s.color}}>{s.emoji} {s.label}</span>
                    <span style={{fontSize:11,color:"#7D8590"}}>{count}</span>
                  </div>
                  <div style={{background:"#21262D",borderRadius:20,height:6,overflow:"hidden"}}>
                    <div style={{height:"100%",width:`${pct}%`,background:s.color,borderRadius:20,transition:"width 0.4s"}}/>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Per account */}
          <div style={{background:"#161B22",borderRadius:12,padding:"14px 16px",border:"1px solid #21262D"}}>
            <div style={{fontSize:13,fontWeight:800,color:"#fff",marginBottom:12}}>🎯 مهام لكل حساب</div>
            {accounts.map(a=>{
              const count=stats.byAccount[a.id]||0;
              const pct=stats.total?count/stats.total*100:0;
              return(
                <div key={a.id} style={{marginBottom:12}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                    <span style={{fontSize:13,color:a.color,fontWeight:700}}>{a.name}</span>
                    <span style={{fontSize:11,color:"#7D8590"}}>{count} — {Math.round(pct)}%</span>
                  </div>
                  <div style={{background:"#21262D",borderRadius:20,height:8,overflow:"hidden"}}>
                    <div style={{height:"100%",width:`${pct}%`,background:a.color,borderRadius:20,transition:"width 0.4s"}}/>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── RENAME MODAL ── */}
      {editAcc && (()=>{
        const a=getAcc(editAcc);
        return(
          <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.8)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
            <div style={{background:"#161B22",borderRadius:16,padding:22,width:"100%",maxWidth:300,direction:"rtl",border:"1px solid #30363D"}}>
              <div style={{fontWeight:800,fontSize:14,color:"#fff",marginBottom:14}}>✏️ تعديل اسم {a.name}</div>
              <input autoFocus value={tempName} onChange={e=>setTempName(e.target.value)}
                onKeyDown={e=>{if(e.key==="Enter"){setAccounts(p=>p.map(ac=>ac.id===editAcc?{...ac,name:tempName}:ac));setEditAcc(null);}if(e.key==="Escape")setEditAcc(null);}}
                style={{width:"100%",padding:"10px 12px",borderRadius:9,border:`1.5px solid ${a.color}70`,fontSize:14,direction:"rtl",boxSizing:"border-box",fontFamily:"inherit",background:"#0D1117",color:"#fff",outline:"none"}}
              />
              <div style={{display:"flex",gap:8,marginTop:12}}>
                <button onClick={()=>{setAccounts(p=>p.map(ac=>ac.id===editAcc?{...ac,name:tempName}:ac));setEditAcc(null);}}
                  style={{flex:1,border:"none",borderRadius:9,padding:"10px",background:a.color,color:"#fff",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>✓ حفظ</button>
                <button onClick={()=>setEditAcc(null)}
                  style={{flex:1,border:"none",borderRadius:9,padding:"10px",background:"#21262D",color:"#8B949E",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>إلغاء</button>
              </div>
            </div>
          </div>
        );
      })()}

      <style>{`@keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}} * { -webkit-tap-highlight-color: transparent; }`}</style>
    </div>
  );
}

// ── Day Panel ──────────────────────────────────────────────────
function DayPanel({ ds, day, accounts, getAcc, onClose, onAddCard, onDelCard, onUpdCard, onToggleDone, onToggleOff, bp }) {
  if(!ds||!day) return null;
  const cards = day.cards || [];
  return (
    <div style={{display:"flex",flexDirection:"column"}}>
      {/* Panel header */}
      <div style={{background:"#161B22",padding:"14px 16px",borderBottom:"1px solid #21262D",position:"sticky",top:0,zIndex:10}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
          <div>
            <div style={{fontWeight:900,fontSize: bp.isMobile?13:15,color:"#fff"}}>{fmtFull(ds)}</div>
            <div style={{fontSize:10,color:"#7D8590",marginTop:2}}>{fmtDay(ds)} • {cards.length} مهمة</div>
          </div>
          <button onClick={onClose}
            style={{border:"none",borderRadius:8,padding:"6px 11px",background:"#21262D",color:"#8B949E",cursor:"pointer",fontFamily:"inherit",fontSize:15,fontWeight:700}}>✕</button>
        </div>
        <div style={{display:"flex",gap:7}}>
          <button onClick={onToggleDone}
            style={{flex:1,border:`1px solid ${day.done?"#10B98150":"#30363D"}`,borderRadius:9,padding:"8px 6px",background:day.done?"#002a1a":"transparent",color:day.done?"#10B981":"#8B949E",fontWeight:700,fontSize: bp.isMobile?11:12,cursor:"pointer",fontFamily:"inherit"}}>
            {day.done?"✅ منجز":"☐ شطب اليوم"}
          </button>
          <button onClick={onToggleOff}
            style={{border:`1px solid ${day.off?"#FB850050":"#30363D"}`,borderRadius:9,padding:"8px 12px",background:day.off?"#1a0a00":"transparent",color:day.off?"#FB8500":"#8B949E",fontWeight:700,fontSize: bp.isMobile?11:12,cursor:"pointer",fontFamily:"inherit"}}>
            {day.off?"🌙 شاغر":"🌙"}
          </button>
        </div>
      </div>

      {/* Cards */}
      <div style={{padding:"12px 14px",paddingBottom:24}}>
        {!day.off && cards.map((card,idx)=>(
          <DayCard key={card.id} card={card} idx={idx} accounts={accounts} dayDone={day.done}
            onUpdate={(f,v)=>onUpdCard(card.id,f,v)} onDelete={()=>onDelCard(card.id)} getAcc={getAcc} bp={bp}/>
        ))}
        {!day.off && (
          <button onClick={onAddCard}
            style={{width:"100%",marginTop:6,border:"1.5px dashed #4361EE50",borderRadius:10,padding:"11px",background:"transparent",color:"#4361EE",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
            + إضافة فكرة / مهمة جديدة
          </button>
        )}
        {day.off && (
          <div style={{textAlign:"center",padding:"36px 20px",color:"#3D444D"}}>
            <div style={{fontSize:40}}>🌙</div>
            <div style={{marginTop:10,fontSize:13}}>يوم شاغر</div>
            <button onClick={onToggleOff}
              style={{marginTop:12,border:"none",borderRadius:9,padding:"8px 18px",background:"#21262D",color:"#8B949E",cursor:"pointer",fontFamily:"inherit",fontSize:12,fontWeight:600}}>
              إلغاء الشغور
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Day Card ───────────────────────────────────────────────────
function DayCard({ card, idx, accounts, dayDone, onUpdate, onDelete, getAcc, bp }) {
  const [showScript, setShowScript] = useState(false);
  const isDone = dayDone || card.done;
  const accs = (card.accountIds||[1]).map(id=>getAcc(id));
  const st = STATUS_LIST.find(s=>s.value===card.status);

  const toggleAccount = (id) => {
    const cur = card.accountIds||[1];
    if(cur.includes(id)) { if(cur.length===1) return; onUpdate("accountIds",cur.filter(x=>x!==id)); }
    else { onUpdate("accountIds", cur.length>=2 ? [cur[cur.length-1],id] : [...cur,id]); }
  };

  return (
    <div style={{
      background:isDone?"#0a0d10":"#161B22", borderRadius:12, marginBottom:10,
      border:isDone?"1px solid #21262D":`1px solid ${accs[0]?.color||"#30363D"}40`,
      overflow:"hidden", opacity:isDone?0.6:1,
    }}>
      {/* Card header */}
      <div style={{background:isDone?"#0D1117":`${accs[0]?.color||"#4361EE"}15`,padding:"8px 12px",display:"flex",alignItems:"center",gap:6,borderBottom:"1px solid #21262D",flexWrap:"wrap"}}>
        <span style={{fontSize:10,color:"#7D8590",fontWeight:700}}>#{idx+1}</span>
        <div style={{flex:1,display:"flex",gap:4,flexWrap:"wrap"}}>
          {accs.map(a=>(
            <span key={a.id} style={{background:`${a.color}25`,color:a.color,border:`1px solid ${a.color}40`,borderRadius:20,padding:"1px 8px",fontSize:10,fontWeight:800}}>{a.name}</span>
          ))}
          {st && <span style={{background:st.bg,color:st.color,borderRadius:20,padding:"1px 8px",fontSize:10,fontWeight:700}}>{st.emoji} {st.label}</span>}
        </div>
        <button onClick={()=>onUpdate("done",!card.done)}
          style={{border:"none",background:"none",cursor:"pointer",fontSize:bp.isMobile?16:15,padding:"2px 4px"}} title="شطب">{card.done?"✅":"☐"}</button>
        <button onClick={onDelete}
          style={{border:"none",background:"none",cursor:"pointer",fontSize:13,color:"#F72585",padding:"2px 4px"}}>✕</button>
      </div>

      <div style={{padding:"10px 12px"}}>
        {/* Account selector */}
        <div style={{marginBottom:9}}>
          <div style={{fontSize:10,color:"#7D8590",marginBottom:5}}>الحساب:</div>
          <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
            {accounts.map(a=>{
              const sel=(card.accountIds||[1]).includes(a.id);
              return(
                <button key={a.id} onClick={()=>toggleAccount(a.id)}
                  style={{border:`1.5px solid ${sel?a.color:"#30363D"}`,borderRadius:20,padding:"4px 10px",
                    fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"inherit",
                    background:sel?`${a.color}25`:"transparent",color:sel?a.color:"#484F58",transition:"all 0.15s",
                    minHeight:32}}>
                  {sel?"✓ ":""}{a.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Type */}
        <div style={{display:"flex",gap:5,marginBottom:9}}>
          {[{v:"script",l:"✍️ سكربت"},{v:"shoot",l:"🎬 تصوير"},{v:"free",l:"🌙 شاغر"}].map(t=>(
            <button key={t.v} onClick={()=>onUpdate("type",t.v)}
              style={{flex:1,border:`1.5px solid ${card.type===t.v?"#4361EE":"#30363D"}`,borderRadius:8,
                padding:"6px 4px",fontSize: bp.isMobile?9:10,fontWeight:700,cursor:"pointer",fontFamily:"inherit",
                background:card.type===t.v?"#4361EE25":"transparent",color:card.type===t.v?"#4361EE":"#484F58",
                transition:"all 0.15s",minHeight:34}}>
              {t.l}
            </button>
          ))}
        </div>

        {/* Idea */}
        <input placeholder="💡 عنوان الفيديو أو الفكرة..." value={card.idea||""}
          onChange={e=>onUpdate("idea",e.target.value)}
          style={{width:"100%",padding:"9px 11px",borderRadius:8,border:"1.5px solid #30363D",fontSize: bp.isMobile?13:12,
            direction:"rtl",boxSizing:"border-box",fontFamily:"inherit",background:"#0D1117",color:"#E6EDF3",
            outline:"none",textDecoration:isDone?"line-through":"none",minHeight:40}}
        />

        {/* Status */}
        <select value={card.status||""} onChange={e=>onUpdate("status",e.target.value)}
          style={{width:"100%",marginTop:7,padding:"9px 10px",borderRadius:8,border:"1.5px solid #30363D",
            fontSize: bp.isMobile?13:11,direction:"rtl",fontFamily:"inherit",background:"#0D1117",
            color:card.status?(STATUS_LIST.find(s=>s.value===card.status)?.color||"#8B949E"):"#8B949E",
            cursor:"pointer",outline:"none",minHeight:40}}>
          <option value="">— الحالة —</option>
          {STATUS_LIST.map(s=><option key={s.value} value={s.value}>{s.emoji} {s.label}</option>)}
        </select>

        {/* Script toggle */}
        <button onClick={()=>setShowScript(p=>!p)}
          style={{marginTop:7,width:"100%",padding:"9px",background:showScript?"#1C2128":"transparent",
            border:`1.5px ${showScript?"solid":"dashed"} #4361EE50`,borderRadius:8,
            color:"#818CF8",fontSize: bp.isMobile?12:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",minHeight:38}}>
          {showScript?"▲ إخفاء السكربت":"▼ كتابة / عرض السكربت"}
        </button>
        {showScript && (
          <textarea placeholder="📝 اكتب السكربت الكامل هنا..." value={card.script||""}
            onChange={e=>onUpdate("script",e.target.value)} rows={5}
            style={{marginTop:6,width:"100%",padding:"10px 11px",borderRadius:8,border:"1.5px solid #4361EE50",
              fontSize: bp.isMobile?13:11,direction:"rtl",boxSizing:"border-box",fontFamily:"inherit",
              resize:"vertical",lineHeight:1.9,background:"#0D1117",color:"#E6EDF3",outline:"none"}}
          />
        )}

        {/* Notes */}
        <input placeholder="📌 ملاحظة للتيم..." value={card.notes||""}
          onChange={e=>onUpdate("notes",e.target.value)}
          style={{marginTop:7,width:"100%",padding:"7px 11px",borderRadius:8,border:"1.5px solid #21262D",
            fontSize: bp.isMobile?12:10,direction:"rtl",boxSizing:"border-box",fontFamily:"inherit",
            background:"#0D1117",color:"#7D8590",outline:"none",minHeight:36}}
        />
      </div>
    </div>
  );
}
