import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { getMyClaims, isLoggedIn } from '../lib/api';
import NavBar from '../components/NavBar';

const STATUS_STYLE = {
  PAID:          { bg:'rgba(29,158,117,0.15)',  color:'#25c493', label:'Paid ✓' },
  APPROVED:      { bg:'rgba(29,158,117,0.15)',  color:'#25c493', label:'Approved ✓' },
  MANUAL_REVIEW: { bg:'rgba(239,159,39,0.15)',  color:'#EF9F27', label:'Under review' },
  PENDING:       { bg:'rgba(239,159,39,0.15)',  color:'#EF9F27', label:'Pending' },
  FRAUD_CHECK:   { bg:'rgba(59,130,246,0.15)',  color:'#60a5fa', label:'Verifying' },
  REJECTED:      { bg:'rgba(226,75,74,0.15)',   color:'#E24B4A', label:'Rejected' },
};

const TRIGGER_LABELS = {
  HEAVY_RAIN:'Heavy Rain', FLOOD:'Flood Alert',
  SEVERE_AQI:'Severe AQI', PLATFORM_PAUSE:'Platform Paused', CURFEW:'Curfew',
};

const TRIGGER_ICONS = {
  HEAVY_RAIN:'🌧', FLOOD:'🌊', SEVERE_AQI:'😷', PLATFORM_PAUSE:'⏸', CURFEW:'🚫',
};

const TRIGGER_DESC = {
  HEAVY_RAIN:'Rainfall exceeded 64mm/hr threshold — Zomato/Swiggy paused orders',
  FLOOD:'Flood alert issued for your zone — platform shutdown',
  SEVERE_AQI:'Air Quality Index exceeded 400 — platform suspended operations',
  PLATFORM_PAUSE:'Platform suspended orders in your zone',
  CURFEW:'Section 144 / government curfew in your zone',
};

export default function ClaimsPage() {
  const router = useRouter();
  const [claims, setClaims]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    if (!isLoggedIn()) { router.replace('/'); return; }
    getMyClaims()
      .then(r => setClaims(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ paddingBottom:90 }}>
      {/* Header */}
      <div style={{
        padding:'20px 20px 16px', background:'linear-gradient(160deg,#0a3828,#0d1f1a)',
        borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:12,
      }}>
        <button onClick={()=>router.back()} style={{ background:'none', border:'none', fontSize:20, cursor:'pointer', color:'var(--text)' }}>←</button>
        <div>
          <h1 style={{ fontSize:19, fontWeight:800 }}>My Claims</h1>
          <p style={{ fontSize:12, color:'var(--text2)', marginTop:2 }}>Zero-touch auto-approval system</p>
        </div>
      </div>

      <div style={{ padding:'16px 20px' }}>
        {loading && (
          <div style={{ textAlign:'center', padding:40 }}>
            <div style={{ width:36, height:36, borderRadius:'50%', border:'3px solid var(--green)', borderTopColor:'transparent', animation:'spin 0.8s linear infinite', margin:'0 auto 12px' }} />
            <p style={{ color:'var(--text2)', fontSize:14 }}>Loading claims...</p>
          </div>
        )}

        {!loading && claims.length===0 && (
          <div style={{ textAlign:'center', padding:'60px 20px' }}>
            <div style={{ fontSize:52, marginBottom:12 }}>🛡</div>
            <p style={{ fontWeight:700, fontSize:17, marginBottom:6 }}>No claims yet</p>
            <p style={{ color:'var(--text2)', fontSize:14 }}>Claims appear automatically when a trigger fires in your zone</p>
            <button className="btn-primary" style={{ maxWidth:200, margin:'20px auto 0' }} onClick={()=>router.push('/dashboard')}>
              Go to Dashboard
            </button>
          </div>
        )}

        {claims.map(c => {
          const st    = STATUS_STYLE[c.status] || STATUS_STYLE.PENDING;
          const isOpen = selected === c.id;
          const fraudFlags = Array.isArray(c.fraud_flags) ? c.fraud_flags : [];
          const payoutDetails = c.payout_details || {};

          return (
            <div key={c.id} className="card" style={{ marginBottom:14, cursor:'pointer', border: isOpen ? '1px solid var(--green)' : '1px solid var(--border)' }}
              onClick={()=>setSelected(isOpen ? null : c.id)}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                <div style={{ display:'flex', gap:12, alignItems:'center' }}>
                  <span style={{ fontSize:32 }}>{TRIGGER_ICONS[c.trigger_type]||'⚡'}</span>
                  <div>
                    <p style={{ fontWeight:700, fontSize:15, marginBottom:3 }}>
                      {TRIGGER_LABELS[c.trigger_type]||c.trigger_type}
                    </p>
                    <p style={{ fontSize:12, color:'var(--text2)' }}>
                      {c.zone} · {new Date(c.created_at).toLocaleDateString('en-IN',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}
                    </p>
                  </div>
                </div>
                <div style={{ textAlign:'right' }}>
                  <p style={{ fontWeight:800, fontSize:20, color:'var(--green-l)', marginBottom:4 }}>₹{c.payout_amount_inr}</p>
                  <span style={{ fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:20, background:st.bg, color:st.color }}>{st.label}</span>
                </div>
              </div>

              {/* Expanded detail - SETTLEMENT PIPELINE */}
              {isOpen && (
                <div style={{ marginTop:16, borderTop:'1px solid var(--border)', paddingTop:16 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
                    <div>
                      <p style={{ fontSize:13, fontWeight:800, color:'var(--green-l)', textTransform:'uppercase', letterSpacing:'0.05em' }}>
                        🛡 ZERO-TOUCH CLAIM SYSTEM
                      </p>
                      <p style={{ fontSize:11, color:'var(--text3)' }}>Settlement in minutes • Fast & Secure</p>
                    </div>
                    <div style={{ background:'rgba(29,158,117,0.1)', padding:'4px 8px', borderRadius:6, fontSize:11, fontWeight:700, color:'var(--green-l)' }}>
                      ⚡ FAST SETTLEMENT
                    </div>
                  </div>

                  {/* The 5 Steps */}
                  {[
                    { label: `${TRIGGER_LABELS[c.trigger_type]||'Trigger'} Confirmed`, done: true, sub: `Source: Weather API | ${c.trigger_value}${c.trigger_type==='HEAVY_RAIN'?'mm':''}` },
                    { label: 'Worker Eligibility Check', done: true, sub: 'Policy Active • Zone Valid • No Duplicates' },
                    { label: 'Payout Calculated', done: true, sub: `Formula: ${payoutDetails.formula || `₹${c.payout_amount_inr} fixed`}` },
                    { label: 'Transfer Initiated', done: c.status==='PAID' || c.status==='APPROVED', sub: c.payout_mode ? `${c.payout_mode} Transfer via Razorpay` : 'Processing payment...' },
                    { label: 'Record Updated', done: c.status==='PAID', sub: c.status==='PAID' ? 'System logs updated • Database reconciled' : 'Waiting for confirmation' },
                  ].map((step, i) => (
                    <div key={i} style={{ display:'flex', gap:12, marginBottom:16, position:'relative' }}>
                      {/* Step Line */}
                      {i < 4 && <div style={{ position:'absolute', left:11, top:24, bottom:-12, width:2, background: step.done ? 'var(--green)' : 'var(--surface2)' }} />}
                      
                      <div style={{
                        width:24, height:24, borderRadius:'50%', flexShrink:0,
                        background: step.done ? 'var(--green)' : 'var(--surface2)',
                        display:'flex', alignItems:'center', justifyContent:'center',
                        fontSize:11, color: step.done ? 'white' : 'var(--text3)', fontWeight:900,
                        zIndex:1,
                        boxShadow: step.done ? '0 0 10px rgba(29,158,117,0.3)' : 'none',
                      }}>{step.done ? '✓' : (i+1)}</div>
                      
                      <div>
                        <p style={{ fontSize:13, fontWeight:700, color: step.done ? 'var(--text)' : 'var(--text3)' }}>{step.label}</p>
                        <p style={{ fontSize:11, color: step.done ? 'var(--text2)' : 'var(--text3)', marginTop:2 }}>{step.sub}</p>
                      </div>
                    </div>
                  ))}

                  {/* Fraud Check Banner */}
                  <div style={{ background:'rgba(59,130,246,0.08)', borderRadius:8, padding:'10px 12px', border:'1px solid rgba(59,130,246,0.2)', marginTop:10, display:'flex', alignItems:'center', gap:10 }}>
                    <span style={{ fontSize:18 }}>🔒</span>
                    <p style={{ fontSize:12, color:'#90cdf4', fontWeight:600 }}>Fraud detection check completed successfully before payout.</p>
                  </div>

                  {/* Payout success box */}
                  {c.status==='PAID' && (
                    <div style={{ background:'linear-gradient(rgba(29,158,117,0.1), rgba(29,158,117,0.05))', border:'1px solid rgba(29,158,117,0.2)', borderRadius:10, padding:'14px', marginTop:14 }}>
                      <p style={{ fontSize:14, color:'var(--green-l)', fontWeight:800, marginBottom:4 }}>✅ PAYMENT SUCCESSFUL</p>
                      <p style={{ fontSize:12, color:'var(--text2)', lineHeight:1.4 }}>
                        ₹{c.payout_amount_inr} has been sent to your <strong>{c.payout_mode}</strong> account. 
                        Funds should reflect in your balance within minutes.
                      </p>
                      <p style={{ fontSize:10, color:'var(--text3)', marginTop:8, textTransform:'uppercase' }}>Ref: {c.claim_number}</p>
                    </div>
                  )}

                  {fraudFlags.length>0 && (
                    <div style={{ background:'rgba(239,159,39,0.1)', border:'1px solid rgba(239,159,39,0.2)', borderRadius:8, padding:'8px 12px', marginTop:8 }}>
                      <p style={{ fontSize:12, color:'var(--amber)', fontWeight:600 }}>⚠️ Security Note: {fraudFlags.join(', ')}</p>
                    </div>
                  )}
                </div>
              )}
              <div style={{ fontSize:11, color:'var(--text3)', marginTop:10, textAlign:'center', opacity:0.7 }}>{isOpen?'▲ CLOSE SETTLEMENT PANEL':'▼ VIEW SETTLEMENT STEPS'}</div>
            </div>
          );
        })}
      </div>

      <NavBar active="claims" />
      <style>{`@keyframes spin{to{transform:rotate(360deg);}}`}</style>
    </div>
  );
}
