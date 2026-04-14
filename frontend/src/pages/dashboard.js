import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { getProfile, getClaimStats, getMyClaims, getLiveWeather, simulateTrigger, isLoggedIn, getZones, updatePolicyZone } from '../lib/api';
import { translations } from '../lib/i18n';
import NavBar from '../components/NavBar';
import ClaimSuccessOverlay from '../components/ClaimSuccessOverlay';

const STATUS_STYLE = {
  PAID:          { bg: 'rgba(29,158,117,0.15)', color: '#25c493', label: 'Accepted ✓' },
  APPROVED:      { bg: 'rgba(29,158,117,0.15)', color: '#25c493', label: 'Accepted ✓' },
  MANUAL_REVIEW: { bg: 'rgba(239,159,39,0.15)',  color: '#EF9F27', label: 'In review' },
  PENDING:       { bg: 'rgba(239,159,39,0.15)',  color: '#EF9F27', label: 'Pending' },
  FRAUD_CHECK:   { bg: 'rgba(59,130,246,0.15)',  color: '#60a5fa', label: 'Verifying' },
  REJECTED:      { bg: 'rgba(226,75,74,0.15)',   color: '#E24B4A', label: 'Rejected' },
  PAYOUT_FAILED: { bg: 'rgba(29,158,117,0.15)', color: '#25c493', label: 'Accepted ✓' },
};

const TRIGGER_LABELS = {
  HEAVY_RAIN: 'Heavy Rain', FLOOD: 'Flood Alert',
  SEVERE_AQI: 'Severe AQI', PLATFORM_PAUSE: 'Platform Paused', CURFEW: 'Curfew',
};

export default function Dashboard() {
  const router    = useRouter();
  const [profile,   setProfile]   = useState(null);
  const [stats,     setStats]     = useState(null);
  const [claims,    setClaims]    = useState([]);
  const [weather,   setWeather]   = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [simulating, setSimulating] = useState(false);
  const [simResult,  setSimResult]  = useState('');
  const [switchingZone, setSwitchingZone] = useState(false);
  const [zonesList, setZonesList] = useState([]);
  const [selectedZone, setSelectedZone] = useState('');
  const [zoneSwitchLoading, setZoneSwitchLoading] = useState(false);
  const [showSuccessOverlay, setShowSuccessOverlay] = useState(false);
  const [lastClaimAmount, setLastClaimAmount] = useState(0);
  const [lang, setLang] = useState('en');
  const [simplified, setSimplified] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  const t = translations[lang];

  function refreshData() {
    getMyClaims().then(r => setClaims(r.data.slice(0, 3)));
    getClaimStats().then(r => setStats(r.data));
  }

  useEffect(() => {
    setMounted(true);
    if (!isLoggedIn()) { router.replace('/'); return; }
    Promise.all([getProfile(), getClaimStats(), getMyClaims(), getLiveWeather()])
      .then(([p, s, c, w]) => {
        setProfile(p.data); setStats(s.data);
        setClaims(c.data.slice(0, 3)); setWeather(w.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleSwitchZoneClick() {
    setSwitchingZone(true);
    if (zonesList.length === 0) {
      try {
        const res = await getZones();
        setZonesList(res.data);
      } catch (err) {}
    }
  }

  async function handleSaveZone() {
    if (!selectedZone) return;
    setZoneSwitchLoading(true);
    try {
      await updatePolicyZone(selectedZone);
      alert(`Zone updated to ${selectedZone}! Premium and coverage details have been adjusted.`);
      setSwitchingZone(false);
      refreshData();
      getProfile().then(r => setProfile(r.data));
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to switch zone");
    } finally {
      setZoneSwitchLoading(false);
    }
  }

  async function handleSimulateTrigger() {
    const zone = profile?.zone || 'T. Nagar';
    setSimulating(true); setSimResult('');
    try {
      const res = await simulateTrigger({
        zone, trigger_type: 'HEAVY_RAIN',
        trigger_value: 72.5, threshold: 64.4,
        platform_status: 'PAUSED', duration_hours: 4,
      });
      const count = res.data.result?.claims_created ?? 0;
      if (count > 0) {
        setLastClaimAmount(res.data.result.total_payout_inr || 400);
        setShowSuccessOverlay(true);
      }
      setSimResult(`✅ Trigger fired! ${count > 0 ? count + ' claim(s) auto-created & processing' : 'Check claims — may already have one for this event'}. Zone: ${zone}`);
      setTimeout(refreshData, 2000);
    } catch {
      setSimResult('⚡ Trigger simulated (activate a policy first if no claims appear)');
    } finally { setSimulating(false); }
  }

  if (loading) return (
    <div style={{ display:'flex', justifyContent:'center', alignItems:'center', height:'100vh' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ width:44, height:44, borderRadius:'50%', border:'3px solid var(--green)', borderTopColor:'transparent', animation:'spin 0.8s linear infinite', margin:'0 auto 12px' }} />
        <p style={{ color:'var(--text2)', fontSize:14 }}>Loading GigShield...</p>
      </div>
      <style>{`@keyframes spin { to { transform:rotate(360deg); } }`}</style>
    </div>
  );

  const policy   = stats?.active_policy;
  const initials = (profile?.name || profile?.phone || 'R').slice(0,2).toUpperCase();

  return (
    <div style={{ paddingBottom: 90 }}>
      {/* ── Header ── */}
      <div style={{
        background: 'linear-gradient(160deg, #0a3828 0%, #0d1f1a 100%)',
        padding: '24px 20px 28px', borderBottom: '1px solid var(--border)',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position:'absolute', top:-40, right:-40, width:160, height:160, borderRadius:'50%', background:'rgba(29,158,117,0.06)' }} />
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <div>
            <p style={{ fontSize:13, color:'var(--text2)' }}>{t.good_day}</p>
            <h1 style={{ fontSize:22, fontWeight:800 }}>{profile?.name || 'Rider'}</h1>
            <p style={{ fontSize:12, color:'var(--text3)', marginTop:2 }}>{profile?.platform} · {profile?.zone}</p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={() => setLang(lang === 'en' ? 'ta' : 'en')} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', padding: '6px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700 }}>
              {lang === 'en' ? 'தமிழ்' : 'English'}
            </button>
            <div 
              onClick={() => setNotifOpen(true)}
              style={{ position:'relative', cursor:'pointer', width:40, height:40, borderRadius:10, background:'rgba(255,255,255,0.05)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <span style={{ fontSize:20 }}>🔔</span>
              {claims.some(c => c.status==='REJECTED' || c.status==='PENDING') && (
                <div style={{ position:'absolute', top:8, right:8, width:8, height:8, background:'var(--red)', borderRadius:'50%', border:'2px solid #0a3828' }} />
              )}
            </div>
            <div style={{
              width:48, height:48, borderRadius:'50%',
              background:'linear-gradient(135deg, var(--green), var(--green-l))',
              display:'flex', alignItems:'center', justifyContent:'center',
              fontWeight:800, fontSize:16, color:'#0a1628',
              boxShadow:'0 4px 12px rgba(29,158,117,0.4)',
            }}>{initials}</div>
          </div>
        </div>

        {/* Accessibility Toggle */}
        <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
          <label style={{ fontSize: 11, color: 'var(--text3)', display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
            <input type="checkbox" checked={simplified} onChange={() => setSimplified(!simplified)} style={{ marginRight: 6 }} />
            {t.simplified_mode} (Large Icons)
          </label>
        </div>

        {/* Policy card */}
        {policy ? (
          <div style={{ background:'rgba(29,158,117,0.08)', border:'1px solid rgba(29,158,117,0.25)', borderRadius:14, padding:16 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
              <span style={{ fontSize:12, color:'var(--text2)', fontWeight:600 }}>{policy.policy_number}</span>
              <span style={{ background:'rgba(29,158,117,0.2)', color:'var(--green-l)', borderRadius:20, padding:'3px 10px', fontSize:11, fontWeight:700 }}>🟢 ACTIVE</span>
            </div>
            <div style={{ display:'flex', gap:10, flexWrap: 'wrap' }}>
              {[
                { label: 'Max payout', val: mounted ? '₹' + (policy.max_payout_inr || 0).toLocaleString('en-IN') : '₹0', color: 'var(--green-l)' },
                { label: 'Weekly', val: mounted ? '₹' + (policy.weekly_premium_inr || 0).toLocaleString('en-IN') : '₹0', color: null },
                { label: 'Valid till', val: new Date(policy.valid_till).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }), color: null }
              ].map(({label, val, color}) => (
                <div key={label}>
                  <p style={{ fontSize: 18, fontWeight: 800, color: color || 'var(--text)' }}>{val}</p>
                  <p style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase' }}>{label}</p>
                </div>
              ))}
            </div>
            
            {/* Switch Zone UI */}
            <div style={{ marginTop: 16, borderTop: '1px solid rgba(29,158,117,0.2)', paddingTop: 12 }}>
              {!switchingZone ? (
                <button onClick={handleSwitchZoneClick} style={{ background: 'none', border: 'none', color: 'var(--green-l)', cursor: 'pointer', fontSize: 13, fontWeight: 600, padding: 0 }}>
                  ⇄ Switch Operating Area
                </button>
              ) : (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <select 
                    value={selectedZone} 
                    onChange={e => setSelectedZone(e.target.value)}
                    style={{ flex: 1, padding: '8px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid var(--border)', fontSize: 13 }}
                  >
                    <option value="">Select new zone</option>
                    {zonesList.map(z => (
                      <option key={z.zone} value={z.zone}>{z.zone} ({z.risk_level} risk)</option>
                    ))}
                  </select>
                  <button 
                    onClick={handleSaveZone} 
                    disabled={zoneSwitchLoading || !selectedZone}
                    className="btn-primary" 
                    style={{ padding: '8px 16px', minHeight: 'auto', minWidth: 'auto', fontSize: 12 }}
                  >
                    {zoneSwitchLoading ? '...' : 'Save'}
                  </button>
                  <button 
                    onClick={() => setSwitchingZone(false)} 
                    style={{ background: 'none', border: 'none', color: 'var(--text2)', cursor: 'pointer', padding: '0 8px', fontSize: 16 }}
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>

          </div>
        ) : (
          <div style={{ background:'rgba(239,159,39,0.08)', border:'1px solid rgba(239,159,39,0.2)', borderRadius:14, padding:16, textAlign:'center' }}>
            <p style={{ fontSize:14, color:'var(--amber)', marginBottom:10 }}>⚠️ No active policy</p>
            <button className="btn-primary" style={{ maxWidth:200, margin:'0 auto' }} onClick={()=>router.push('/onboarding')}>Activate Now</button>
          </div>
        )}
      </div>

      <div style={{ padding:'20px 20px 0' }}>
        {/* ── Live Weather ── */}
        {weather && (
          <div className="card" style={{ marginBottom:16, display:'flex', gap:12, alignItems:'center' }}>
            <span style={{ fontSize:36 }}>{weather.rain_mm>64?'🌧':weather.rain_mm>20?'🌦':weather.aqi>300?'😷':'☀️'}</span>
            <div style={{ flex:1 }}>
              <p style={{ fontSize:13, fontWeight:700, marginBottom:3 }}>{weather.zone || profile?.zone} — Live</p>
              <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
                <span style={{ fontSize:12, color:'var(--text2)' }}>🌡 {weather.temp??'--'}°C</span>
                <span style={{ fontSize:12, color:weather.rain_mm>64?'var(--red)':'var(--text2)' }}>🌧 {(weather.rain_mm??0).toFixed(1)}mm/hr</span>
                {weather.aqi && <span style={{ fontSize:12, color:weather.aqi>300?'var(--amber)':'var(--text2)' }}>💨 AQI {weather.aqi}</span>}
              </div>
            </div>
            {weather.rain_mm>64 && (
              <span style={{ fontSize:11, color:'var(--red)', fontWeight:700, textAlign:'center', lineHeight:1.3, animation:'pulse 1.5s ease-in-out infinite' }}>⚠️ HIGH<br/>RISK</span>
            )}
          </div>
        )}

        {/* ── Stats ── */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:20 }}>
          {[
            { label: 'Wallet Balance', val: mounted ? `₹${(stats?.wallet_balance??0).toLocaleString('en-IN')}` : '₹0', color:'var(--green-l)', icon:'💰' },
            { label: t.claims_paid,     val:stats?.total_claims??0,         color:'var(--blue)',    icon:'📋' },
          ].map(s=>(
            <div key={s.label} className="card" style={{ textAlign:'center', padding: simplified ? '24px 12px' : '16px 12px', transform: simplified ? 'scale(1.05)' : 'none', transition: 'all 0.3s' }}>
              <p style={{ fontSize: simplified ? 44 : 22, marginBottom:4 }}>{s.icon}</p>
              <p style={{ fontSize: simplified ? 32 : 24, fontWeight: 900, color:s.color }}>{s.val}</p>
              <p style={{ fontSize: simplified ? 14 : 11, color:'var(--text3)', fontWeight: 700 }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* ── Demo Trigger ── */}
        <div className="card" style={{ marginBottom:20, border:'1px solid rgba(239,159,39,0.3)' }}>
          <p style={{ fontSize:13, fontWeight:700, color:'var(--amber)', marginBottom:4 }}>🎯 Demo: Simulate a Parametric Trigger</p>
          <p style={{ fontSize:12, color:'var(--text2)', marginBottom:12 }}>
            Fire a heavy rain alert for {profile?.zone||'your zone'} — auto-creates & pays a claim
          </p>
          {simResult && (
            <p style={{ fontSize:12, color:'var(--green-l)', marginBottom:10, background:'rgba(29,158,117,0.1)', padding:'8px 12px', borderRadius:8 }}>{simResult}</p>
          )}
          <button onClick={handleSimulateTrigger} disabled={simulating}
            style={{ width:'100%', padding:12, borderRadius:10, border:'none', background:simulating?'var(--surface2)':'rgba(239,159,39,0.15)', color:'var(--amber)', fontWeight:700, fontSize:13, cursor:'pointer' }}>
            {simulating ? '⏳ Processing...' : '⚡ Fire Heavy Rain Trigger (72mm/hr)'}
          </button>
        </div>

        {/* ── Recent Claims ── */}
        <div style={{ marginBottom:20 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
            <h2 style={{ fontSize:16, fontWeight:700 }}>Recent Claims</h2>
            <button style={{ background:'none', border:'none', color:'var(--green)', fontSize:13, cursor:'pointer', fontWeight:600 }} onClick={()=>router.push('/claims')}>View all →</button>
          </div>
          {claims.length===0 ? (
            <div className="card" style={{ textAlign:'center', padding:'32px 20px' }}>
              <p style={{ fontSize:32, marginBottom:8 }}>🛡</p>
              <p style={{ color:'var(--text2)', fontSize:14, fontWeight:600 }}>No claims yet</p>
              <p style={{ color:'var(--text3)', fontSize:12, marginTop:4 }}>Use the trigger above to test a claim flow</p>
            </div>
          ) : claims.map(c=>{
            const st = STATUS_STYLE[c.status]||STATUS_STYLE.PENDING;
            return (
              <div key={c.id} className="card" style={{ marginBottom:10, display:'flex', justifyContent:'space-between', alignItems:'center', cursor:'pointer' }} onClick={()=>router.push('/claims')}>
                <div>
                  <p style={{ fontWeight:700, fontSize:14 }}>{TRIGGER_LABELS[c.trigger_type]||c.trigger_type}</p>
                  <p style={{ fontSize:12, color:'var(--text2)' }}>{c.zone} · {new Date(c.created_at).toLocaleDateString('en-IN')}</p>
                </div>
                <div style={{ textAlign:'right' }}>
                  <p style={{ fontWeight:800, color:'var(--green-l)', fontSize:16 }}>₹{c.payout_amount_inr}</p>
                  <span style={{ fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:20, background:st.bg, color:st.color }}>{st.label}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Quick Actions ── */}
        <h2 style={{ fontSize:16, fontWeight:700, marginBottom:12 }}>Quick Actions</h2>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          {[['My Policy','🛡','/policy'],['All Claims','📋','/claims']].map(([label,icon,route])=>(
            <button key={label} onClick={()=>router.push(route)} className="card"
              style={{ border:'1px solid var(--border)', cursor:'pointer', textAlign:'center', padding:'20px 12px', background:'transparent' }}>
              <p style={{ fontSize:28, marginBottom:6 }}>{icon}</p>
              <p style={{ fontSize:13, fontWeight:700, color:'var(--text)' }}>{label}</p>
            </button>
          ))}
        </div>
      </div>

      {showSuccessOverlay && (
        <ClaimSuccessOverlay 
          amount={lastClaimAmount} 
          upiId={profile?.upi_id}
          onClose={() => setShowSuccessOverlay(false)} 
        />
      )}
      
      {/* Notification Modal */}
      {notifOpen && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', backdropFilter:'blur(5px)', zIndex:100, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div style={{ background:'#0c1a16', border:'1px solid var(--border)', borderRadius:24, width:'100%', maxWidth:400, overflow:'hidden' }}>
            <div style={{ padding:'20px 24px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <h2 style={{ fontSize:18, fontWeight:800 }}>Notifications</h2>
              <button onClick={()=>setNotifOpen(false)} style={{ background:'none', border:'none', color:'var(--text2)', fontSize:24 }}>✕</button>
            </div>
            <div style={{ padding:10, maxHeight:400, overflowY:'auto' }}>
              {claims.filter(c => c.status==='REJECTED' || c.status==='PAYOUT_FAILED' || c.insurer_remark).length === 0 ? (
                <div style={{ textAlign:'center', padding:40, color:'var(--text3)' }}>No new alerts</div>
              ) : (
                claims.filter(c => c.status==='REJECTED' || c.status==='PAYOUT_FAILED' || c.insurer_remark).map(c => (
                  <div key={c.id} onClick={()=>{setNotifOpen(false); router.push('/claims');}} style={{ padding:16, borderRadius:16, background:c.status==='REJECTED'?'rgba(226,75,74,0.05)':'rgba(255,255,255,0.03)', marginBottom:8, border:'1px solid rgba(255,255,255,0.05)', cursor:'pointer' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                      <span style={{ fontSize:11, fontWeight:800, color:c.status==='REJECTED'?'#E24B4A':'var(--green-l)' }}>{c.status}</span>
                      <span style={{ fontSize:10, color:'var(--text3)' }}>{new Date(c.created_at).toLocaleDateString()}</span>
                    </div>
                    <p style={{ fontSize:13, fontWeight:700, marginBottom:4 }}>{TRIGGER_LABELS[c.trigger_type]} — {c.zone}</p>
                    {c.insurer_remark && (
                      <p style={{ fontSize:12, color:'var(--text2)', fontStyle:'italic', borderLeft:'2px solid var(--border)', paddingLeft:8, marginTop:8 }}>
                        "{c.insurer_remark}"
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
            <button onClick={()=>{setNotifOpen(false); router.push('/claims');}} style={{ width:'100%', padding:16, border:'none', background:'none', color:'var(--green-l)', fontWeight:700, fontSize:13, borderTop:'1px solid var(--border)' }}>
              View All Claims
            </button>
          </div>
        </div>
      )}

      <NavBar active="home" />
      <style>{`@keyframes spin{to{transform:rotate(360deg);}} @keyframes pulse{0%,100%{opacity:1;}50%{opacity:0.4;}}`}</style>
    </div>
  );
}
