import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { getProfile, getClaimStats, getMyClaims, getLiveWeather, simulateTrigger, isLoggedIn } from '../lib/api';
import NavBar from '../components/NavBar';

const STATUS_STYLE = {
  PAID:          { bg: 'rgba(29,158,117,0.15)', color: '#25c493', label: 'Paid ✓' },
  APPROVED:      { bg: 'rgba(29,158,117,0.15)', color: '#25c493', label: 'Approved ✓' },
  MANUAL_REVIEW: { bg: 'rgba(239,159,39,0.15)',  color: '#EF9F27', label: 'In review' },
  PENDING:       { bg: 'rgba(239,159,39,0.15)',  color: '#EF9F27', label: 'Pending' },
  FRAUD_CHECK:   { bg: 'rgba(59,130,246,0.15)',  color: '#60a5fa', label: 'Verifying' },
  REJECTED:      { bg: 'rgba(226,75,74,0.15)',   color: '#E24B4A', label: 'Rejected' },
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

  function refreshData() {
    getMyClaims().then(r => setClaims(r.data.slice(0, 3)));
    getClaimStats().then(r => setStats(r.data));
  }

  useEffect(() => {
    if (!isLoggedIn()) { router.replace('/'); return; }
    Promise.all([getProfile(), getClaimStats(), getMyClaims(), getLiveWeather()])
      .then(([p, s, c, w]) => {
        setProfile(p.data); setStats(s.data);
        setClaims(c.data.slice(0, 3)); setWeather(w.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

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
            <p style={{ fontSize:13, color:'var(--text2)' }}>Good day,</p>
            <h1 style={{ fontSize:22, fontWeight:800 }}>{profile?.name || 'Rider'}</h1>
            <p style={{ fontSize:12, color:'var(--text3)', marginTop:2 }}>{profile?.platform} · {profile?.zone}</p>
          </div>
          <div style={{
            width:48, height:48, borderRadius:'50%',
            background:'linear-gradient(135deg, var(--green), var(--green-l))',
            display:'flex', alignItems:'center', justifyContent:'center',
            fontWeight:800, fontSize:16, color:'#0a1628',
            boxShadow:'0 4px 12px rgba(29,158,117,0.4)',
          }}>{initials}</div>
        </div>

        {/* Policy card */}
        {policy ? (
          <div style={{ background:'rgba(29,158,117,0.08)', border:'1px solid rgba(29,158,117,0.25)', borderRadius:14, padding:16 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
              <span style={{ fontSize:12, color:'var(--text2)', fontWeight:600 }}>{policy.policy_number}</span>
              <span style={{ background:'rgba(29,158,117,0.2)', color:'var(--green-l)', borderRadius:20, padding:'3px 10px', fontSize:11, fontWeight:700 }}>🟢 ACTIVE</span>
            </div>
            <div style={{ display:'flex', gap:16 }}>
              {[['Max payout','₹'+policy.max_payout_inr,'var(--green-l)'],['Weekly','₹'+policy.weekly_premium_inr,null],['Valid till', new Date(policy.valid_till).toLocaleDateString('en-IN',{day:'numeric',month:'short'}), null]].map(([label,val,color])=>(
                <div key={label}>
                  <p style={{ fontSize:20, fontWeight:800, color: color||'var(--text)' }}>{val}</p>
                  <p style={{ fontSize:11, color:'var(--text3)' }}>{label}</p>
                </div>
              ))}
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
            { label:'Total protected', val:`₹${stats?.total_paid_inr??0}`, color:'var(--green-l)', icon:'💰' },
            { label:'Claims paid',     val:stats?.total_claims??0,         color:'var(--blue)',    icon:'📋' },
          ].map(s=>(
            <div key={s.label} className="card" style={{ textAlign:'center', padding:'16px 12px' }}>
              <p style={{ fontSize:22, marginBottom:4 }}>{s.icon}</p>
              <p style={{ fontSize:24, fontWeight:800, color:s.color }}>{s.val}</p>
              <p style={{ fontSize:11, color:'var(--text3)' }}>{s.label}</p>
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

      <NavBar active="home" />
      <style>{`@keyframes spin{to{transform:rotate(360deg);}} @keyframes pulse{0%,100%{opacity:1;}50%{opacity:0.4;}}`}</style>
    </div>
  );
}
