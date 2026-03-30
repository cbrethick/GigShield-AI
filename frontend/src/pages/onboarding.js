import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { updateProfile, getZones, createPolicy, isLoggedIn } from '../lib/api';

const PLATFORMS = ['ZOMATO', 'SWIGGY'];

// Zone discount table (hyper-local pricing)
const ZONE_DISCOUNTS = {
  'Sholinganallur': 10, 'Anna Nagar': 8, 'Porur': 6,
  'Perambur': 4, 'Tambaram': 2, 'Guindy': 2,
};

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep]   = useState(1);
  const [zones, setZones] = useState([]);
  const [form, setForm]   = useState({
    platform: 'ZOMATO', zone: '', avg_daily_hours: 8,
    avg_daily_earnings: 800, work_start_hour: 9, work_end_hour: 21,
    upi_id: '', name: '',
  });
  const [quote,   setQuote]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  useEffect(() => {
    if (!isLoggedIn()) { router.replace('/'); return; }
    getZones().then(r => setZones(r.data)).catch(() => {});
  }, []);

  async function handleProfileSubmit() {
    setLoading(true); setError('');
    try {
      const res = await updateProfile(form);
      setQuote(res.data.premium_quote);
      setStep(3);
    } catch (err) {
      setError(err.response?.data?.detail || 'Error saving profile');
    } finally { setLoading(false); }
  }

  async function handleActivatePolicy() {
    setLoading(true); setError('');
    try {
      await createPolicy({ zone: form.zone });
      router.push('/dashboard');
    } catch (err) {
      setError(err.response?.data?.detail || 'Error creating policy');
    } finally { setLoading(false); }
  }

  const zoneDiscount = ZONE_DISCOUNTS[form.zone] || 0;

  return (
    <div style={{ minHeight:'100vh', padding:'24px 20px' }}>
      {/* Progress bar */}
      <div style={{ display:'flex', gap:8, marginBottom:28 }}>
        {[1,2,3].map(s=>(
          <div key={s} style={{
            flex:1, height:4, borderRadius:2,
            background: s<=step ? 'var(--green)' : 'var(--surface2)',
            transition:'background 0.3s',
            boxShadow: s<=step ? '0 0 8px rgba(29,158,117,0.5)' : 'none',
          }} />
        ))}
      </div>

      {/* Step 1 — Platform */}
      {step===1 && (
        <div className="animate-up">
          <p style={{ fontSize:12, color:'var(--green)', fontWeight:700, letterSpacing:'0.08em', marginBottom:8 }}>STEP 1 OF 3</p>
          <h2 style={{ fontSize:24, fontWeight:800, marginBottom:6 }}>Which platform?</h2>
          <p style={{ color:'var(--text2)', fontSize:14, marginBottom:24 }}>Select the app you deliver for</p>

          <div style={{ display:'flex', flexDirection:'column', gap:12, marginBottom:20 }}>
            {PLATFORMS.map(p=>(
              <div key={p} onClick={()=>setForm(f=>({...f,platform:p}))}
                style={{
                  padding:18, borderRadius:14, cursor:'pointer',
                  border: `2px solid ${form.platform===p ? 'var(--green)' : 'var(--border)'}`,
                  background: form.platform===p ? 'rgba(29,158,117,0.1)' : 'var(--surface)',
                  transition:'all 0.2s',
                  display:'flex', justifyContent:'space-between', alignItems:'center',
                }}>
                <div>
                  <p style={{ fontWeight:700, fontSize:16, color:form.platform===p?'var(--green-l)':'var(--text)' }}>
                    {p==='ZOMATO'?'🍕':'🛺'} {p}
                  </p>
                  <p style={{ fontSize:12, color:'var(--text3)', marginTop:2 }}>
                    {p==='ZOMATO'?'Food delivery partner':'Food & grocery delivery'}
                  </p>
                </div>
                {form.platform===p && <div style={{ width:22, height:22, borderRadius:'50%', background:'var(--green)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, color:'white', fontWeight:700 }}>✓</div>}
              </div>
            ))}
          </div>

          <div style={{ marginBottom:20 }}>
            <label style={{ fontSize:13, color:'var(--text2)', display:'block', marginBottom:8 }}>Your name <span style={{ color:'var(--text3)' }}>(optional)</span></label>
            <input className="input-field" placeholder="Ravi Kumar"
              value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} />
          </div>
          <button className="btn-primary" onClick={()=>setStep(2)}>Next →</button>
        </div>
      )}

      {/* Step 2 — Zone + Hours */}
      {step===2 && (
        <div className="animate-up">
          <p style={{ fontSize:12, color:'var(--green)', fontWeight:700, letterSpacing:'0.08em', marginBottom:8 }}>STEP 2 OF 3</p>
          <h2 style={{ fontSize:24, fontWeight:800, marginBottom:6 }}>Your work details</h2>
          <p style={{ color:'var(--text2)', fontSize:14, marginBottom:20 }}>This sets your exact coverage amount</p>

          <label style={{ fontSize:13, color:'var(--text2)', display:'block', marginBottom:8 }}>Operating zone</label>
          <select className="input-field" style={{ marginBottom: zoneDiscount>0?8:16 }}
            value={form.zone} onChange={e=>setForm(f=>({...f,zone:e.target.value}))}>
            <option value="">Select your zone</option>
            {zones.map(z=>(
              <option key={z.zone} value={z.zone}>{z.zone} — {z.risk_level} risk</option>
            ))}
          </select>

          {/* Zone discount badge */}
          {zoneDiscount>0 && (
            <div style={{ background:'rgba(29,158,117,0.1)', border:'1px solid rgba(29,158,117,0.2)', borderRadius:8, padding:'6px 12px', marginBottom:16, display:'inline-block' }}>
              <p style={{ fontSize:12, color:'var(--green-l)', fontWeight:600 }}>
                🎉 Low-risk zone discount: -₹{zoneDiscount}/week applied
              </p>
            </div>
          )}

          <label style={{ fontSize:13, color:'var(--text2)', display:'block', marginBottom:8 }}>Average daily hours</label>
          <div style={{ display:'flex', gap:8, marginBottom:20 }}>
            {[4,6,8,10,12].map(h=>(
              <div key={h} onClick={()=>setForm(f=>({...f,avg_daily_hours:h}))}
                style={{
                  flex:1, padding:'12px 0', borderRadius:10, textAlign:'center', cursor:'pointer',
                  fontWeight:700, fontSize:14,
                  border: `2px solid ${form.avg_daily_hours===h ? 'var(--green)' : 'var(--border)'}`,
                  background: form.avg_daily_hours===h ? 'rgba(29,158,117,0.1)' : 'var(--surface)',
                  color: form.avg_daily_hours===h ? 'var(--green-l)' : 'var(--text2)',
                  transition:'all 0.15s',
                }}>{h}h</div>
            ))}
          </div>

          <label style={{ fontSize:13, color:'var(--text2)', display:'block', marginBottom:8 }}>
            Average daily earnings: <strong style={{ color:'var(--text)' }}>₹{form.avg_daily_earnings}</strong>
          </label>
          <input type="range" min={400} max={2000} step={50}
            value={form.avg_daily_earnings}
            onChange={e=>setForm(f=>({...f,avg_daily_earnings:Number(e.target.value)}))}
            style={{ width:'100%', marginBottom:20 }} />

          <label style={{ fontSize:13, color:'var(--text2)', display:'block', marginBottom:8 }}>UPI ID <span style={{ color:'var(--text3)' }}>(for payouts)</span></label>
          <input className="input-field" placeholder="yourname@upi" style={{ marginBottom:20 }}
            value={form.upi_id} onChange={e=>setForm(f=>({...f,upi_id:e.target.value}))} />

          {error && <p style={{ color:'var(--red)', fontSize:13, marginBottom:12 }}>{error}</p>}
          <div style={{ display:'flex', gap:10 }}>
            <button className="btn-outline" style={{ flex:1 }} onClick={()=>setStep(1)}>← Back</button>
            <button className="btn-primary" style={{ flex:2 }}
              onClick={handleProfileSubmit} disabled={!form.zone||loading}>
              {loading ? 'Calculating...' : 'Get my quote →'}
            </button>
          </div>
        </div>
      )}

      {/* Step 3 — Quote */}
      {step===3 && quote && (
        <div className="animate-up">
          <p style={{ fontSize:12, color:'var(--green)', fontWeight:700, letterSpacing:'0.08em', marginBottom:8 }}>YOUR QUOTE</p>
          <h2 style={{ fontSize:24, fontWeight:800, marginBottom:6 }}>GigShield activated 🛡</h2>
          <p style={{ color:'var(--text2)', fontSize:14, marginBottom:20 }}>Based on your zone and work pattern</p>

          {/* Risk score */}
          <div className="card" style={{ marginBottom:16, textAlign:'center' }}>
            <p style={{ fontSize:13, color:'var(--text2)', marginBottom:6 }}>Risk score</p>
            <p style={{ fontSize:52, fontWeight:800, color:'var(--amber)', lineHeight:1 }}>{quote.risk_score}</p>
            <p style={{ fontSize:12, color:'var(--text3)', marginTop:4, marginBottom:12 }}>out of 100 · {form.zone}</p>
            <div style={{ display:'flex', gap:8 }}>
              <div style={{ flex:1, background:'var(--surface)', borderRadius:8, padding:'8px 4px' }}>
                <p style={{ fontSize:11, color:'var(--text3)' }}>Flood risk</p>
                <div style={{ height:4, background:'var(--surface2)', borderRadius:2, marginTop:6 }}>
                  <div style={{ width:`${quote.zone_flood_score*100}%`, height:'100%', background:'var(--red)', borderRadius:2 }} />
                </div>
              </div>
              <div style={{ flex:1, background:'var(--surface)', borderRadius:8, padding:'8px 4px' }}>
                <p style={{ fontSize:11, color:'var(--text3)' }}>AQI risk</p>
                <div style={{ height:4, background:'var(--surface2)', borderRadius:2, marginTop:6 }}>
                  <div style={{ width:`${Math.min(quote.zone_avg_aqi/500*100,100)}%`, height:'100%', background:'var(--amber)', borderRadius:2 }} />
                </div>
              </div>
            </div>
          </div>

          {/* Premium card */}
          <div className="card" style={{ marginBottom:20, border:'2px solid var(--green)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
              <div>
                <p style={{ fontWeight:700, fontSize:17 }}>Weekly Shield</p>
                <p style={{ fontSize:12, color:'var(--text2)' }}>Auto-renews every Sunday</p>
              </div>
              <div style={{ textAlign:'right' }}>
                <p style={{ fontSize:32, fontWeight:800, color:'var(--green-l)' }}>₹{quote.weekly_premium_inr}</p>
                <p style={{ fontSize:12, color:'var(--text3)' }}>per week</p>
              </div>
            </div>
            {zoneDiscount>0 && (
              <div style={{ background:'rgba(29,158,117,0.08)', borderRadius:8, padding:'6px 10px', marginBottom:12 }}>
                <p style={{ fontSize:12, color:'var(--green-l)', fontWeight:600 }}>✅ Zone discount applied: -₹{zoneDiscount}</p>
              </div>
            )}
            <div style={{ borderTop:'1px solid var(--border)', paddingTop:12, display:'flex', flexDirection:'column', gap:8 }}>
              {[
                ['Max payout per event', `₹${quote.max_payout_inr}`],
                ['Coverage hours per event', `${quote.coverage_hours_per_event} hrs`],
                ['Hourly rate', `₹${quote.hourly_rate}/hr`],
                ['Triggers covered', '5 disruption types'],
                ['Payout time', 'Under 10 minutes'],
              ].map(([label,val])=>(
                <div key={label} style={{ display:'flex', justifyContent:'space-between' }}>
                  <span style={{ fontSize:13, color:'var(--text2)' }}>{label}</span>
                  <span style={{ fontSize:13, fontWeight:700 }}>{val}</span>
                </div>
              ))}
            </div>
          </div>

          {error && <p style={{ color:'var(--red)', fontSize:13, marginBottom:12 }}>{error}</p>}
          <button className="btn-primary" onClick={handleActivatePolicy} disabled={loading}>
            {loading ? 'Activating...' : `Activate Policy — ₹${quote.weekly_premium_inr}/week`}
          </button>
          <button className="btn-outline" style={{ marginTop:10 }} onClick={()=>setStep(2)}>← Edit details</button>
        </div>
      )}
    </div>
  );
}
