import { useState, useEffect } from 'react';
import { getInsurerDashboard, getLiveStats, simulateTrigger } from '../../lib/api';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts';

const TRIGGER_COLORS = {
  HEAVY_RAIN: '#378ADD', FLOOD: '#185FA5',
  SEVERE_AQI: '#639922', PLATFORM_PAUSE: '#EF9F27', CURFEW: '#E24B4A',
};

const STATUS_STYLE = {
  PAID:          { bg: '#E1F5EE', color: '#0F6E56' },
  APPROVED:      { bg: '#E1F5EE', color: '#0F6E56' },
  MANUAL_REVIEW: { bg: '#FAEEDA', color: '#854F0B' },
  REJECTED:      { bg: '#FCEBEB', color: '#A32D2D' },
  PENDING:       { bg: '#E6F1FB', color: '#185FA5' },
};

export default function InsurerDashboard() {
  const [data, setData] = useState(null);
  const [live, setLive] = useState(null);
  const [loading, setLoading] = useState(true);
  const [simZone, setSimZone] = useState('T. Nagar');
  const [simType, setSimType] = useState('HEAVY_RAIN');
  const [simLoading, setSimLoading] = useState(false);
  const [simMsg, setSimMsg] = useState('');

  async function load() {
    try {
      const [d, l] = await Promise.all([getInsurerDashboard(), getLiveStats()]);
      setData(d.data);
      setLive(l.data);
    } catch (e) {
      console.error(e);
    } finally { setLoading(false); }
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000); // refresh every 30s
    return () => clearInterval(interval);
  }, []);

  async function handleSimulate() {
    setSimLoading(true); setSimMsg('');
    try {
      const res = await simulateTrigger({
        zone: simZone, trigger_type: simType,
        trigger_value: simType === 'SEVERE_AQI' ? 420 : 78.5,
        threshold: simType === 'SEVERE_AQI' ? 400 : 64,
        platform_status: 'PAUSED', duration_hours: 4,
      });
      const r = res.data.result;
      setSimMsg(`✓ ${r.claims_created} claims created · ${r.approved} approved · ₹${r.total_payout_inr} payout`);
      setTimeout(load, 1000);
    } catch (e) {
      setSimMsg('Error: ' + (e.response?.data?.detail || e.message));
    } finally { setSimLoading(false); }
  }

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'sans-serif' }}>
      <p style={{ color: '#666' }}>Loading dashboard...</p>
    </div>
  );

  const s = data?.summary || {};
  const maxZoneClaims = Math.max(...(data?.zone_risk?.map(z => z.claims) || [1]));

  return (
    <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', background: '#f4f6f5', minHeight: '100vh', maxWidth: '100%' }}>

      {/* Top bar */}
      <div style={{ background: '#085041', padding: '16px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ color: 'white', fontSize: 20, fontWeight: 700, margin: 0 }}>GigShield — Insurer Dashboard</h1>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, margin: '2px 0 0' }}>
            Live · refreshes every 30s · {new Date().toLocaleTimeString('en-IN')}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {live && (
            <div style={{ background: 'rgba(255,255,255,0.12)', borderRadius: 8, padding: '6px 14px', color: 'white', fontSize: 12 }}>
              {live.pending_claims} pending · ₹{live.amount_paid_last_hour_inr} paid last hr
            </div>
          )}
          <div style={{ background: '#1D9E75', borderRadius: 8, padding: '6px 12px', color: 'white', fontSize: 12, fontWeight: 600 }}>
            LIVE
          </div>
        </div>
      </div>

      <div style={{ padding: '24px 28px' }}>

        {/* KPI row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
          {[
            { label: 'Active policies', val: s.active_policies?.toLocaleString(), delta: '+12% this week', ok: true },
            { label: 'Claims this week', val: s.claims_this_week?.toLocaleString(), delta: 'auto-triggered', ok: true },
            { label: 'Loss ratio', val: `${s.loss_ratio_pct}%`, delta: s.loss_ratio_pct > 70 ? 'Above target' : 'Within target', ok: s.loss_ratio_pct <= 70 },
            { label: 'Fraud blocked', val: s.fraud_blocked, delta: `₹${s.fraud_saved_inr?.toLocaleString()} saved`, ok: true },
          ].map(k => (
            <div key={k.label} style={{ background: 'white', borderRadius: 14, padding: '18px 20px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <p style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>{k.label}</p>
              <p style={{ fontSize: 28, fontWeight: 700, color: '#1a1a1a', marginBottom: 4 }}>{k.val ?? '—'}</p>
              <p style={{ fontSize: 12, color: k.ok ? '#1D9E75' : '#E24B4A', fontWeight: 500 }}>{k.delta}</p>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, marginBottom: 20 }}>

          {/* Weekly trend chart */}
          <div style={{ background: 'white', borderRadius: 14, padding: '20px 20px 12px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Weekly claims trend</h3>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={data?.weekly_trend || []} barSize={20}>
                <XAxis dataKey="week" tick={{ fontSize: 11, fill: '#999' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#999' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: '1px solid #eee', fontSize: 12 }}
                  formatter={(val, name) => [val, name === 'claims' ? 'Claims' : 'Payout ₹']}
                />
                <Bar dataKey="claims" fill="#1D9E75" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Claim type breakdown */}
          <div style={{ background: 'white', borderRadius: 14, padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>By trigger type</h3>
            {(data?.trigger_breakdown || []).length === 0 && (
              <p style={{ color: '#999', fontSize: 13 }}>No claims yet</p>
            )}
            {(data?.trigger_breakdown || []).map(t => (
              <div key={t.trigger} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: '#666' }}>{t.trigger.replace(/_/g, ' ')}</span>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>{t.count}</span>
                </div>
                <div style={{ height: 5, background: '#f0f0f0', borderRadius: 3 }}>
                  <div style={{
                    height: '100%', borderRadius: 3,
                    width: `${Math.min((t.count / Math.max(s.claims_this_week, 1)) * 100, 100)}%`,
                    background: TRIGGER_COLORS[t.trigger] || '#1D9E75',
                  }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>

          {/* Zone risk */}
          <div style={{ background: 'white', borderRadius: 14, padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Claims by zone</h3>
            {(data?.zone_risk || []).length === 0 && (
              <p style={{ color: '#999', fontSize: 13 }}>No zone data yet</p>
            )}
            {(data?.zone_risk || []).map(z => {
              const pct = Math.round((z.claims / maxZoneClaims) * 100);
              const color = pct > 70 ? '#E24B4A' : pct > 40 ? '#EF9F27' : '#1D9E75';
              return (
                <div key={z.zone} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <span style={{ fontSize: 12, color: '#333', width: 100, flexShrink: 0 }}>{z.zone}</span>
                  <div style={{ flex: 1, height: 5, background: '#f0f0f0', borderRadius: 3 }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 3, transition: 'width 0.5s' }} />
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 600, width: 28, textAlign: 'right' }}>{z.claims}</span>
                </div>
              );
            })}
          </div>

          {/* Fraud summary */}
          <div style={{ background: 'white', borderRadius: 14, padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Fraud detection</h3>
            {[
              { label: 'Auto-approved',   val: (s.claims_this_week ?? 0) - (s.fraud_blocked ?? 0), color: '#1D9E75', bg: '#E1F5EE' },
              { label: 'Flagged/review',  val: s.fraud_blocked ?? 0,                                color: '#854F0B', bg: '#FAEEDA' },
              { label: 'Savings',         val: `₹${(s.fraud_saved_inr ?? 0).toLocaleString()}`,     color: '#185FA5', bg: '#E6F1FB' },
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: item.bg, borderRadius: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 13, color: item.color, fontWeight: 500 }}>{item.label}</span>
                <span style={{ fontSize: 16, fontWeight: 700, color: item.color }}>{item.val}</span>
              </div>
            ))}
            <p style={{ fontSize: 11, color: '#999', marginTop: 8 }}>
              Powered by Isolation Forest + rule-based engine
            </p>
          </div>
        </div>

        {/* Recent claims table */}
        <div style={{ background: 'white', borderRadius: 14, padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Recent claims — live feed</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #f0f0f0' }}>
                {['Claim #', 'Zone', 'Trigger', 'Amount', 'Fraud flags', 'Status', 'Time'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '6px 8px', color: '#999', fontWeight: 500, fontSize: 11, textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(data?.recent_claims || []).map(c => {
                const st = STATUS_STYLE[c.status] || STATUS_STYLE.PENDING;
                return (
                  <tr key={c.id} style={{ borderBottom: '1px solid #f8f8f8' }}>
                    <td style={{ padding: '9px 8px', color: '#185FA5', fontWeight: 500 }}>{c.claim_number?.slice(-8)}</td>
                    <td style={{ padding: '9px 8px' }}>{c.zone}</td>
                    <td style={{ padding: '9px 8px', color: '#666' }}>{c.trigger.replace(/_/g, ' ')}</td>
                    <td style={{ padding: '9px 8px', fontWeight: 600 }}>₹{c.amount_inr}</td>
                    <td style={{ padding: '9px 8px' }}>
                      {c.fraud_flags?.length > 0
                        ? <span style={{ color: '#854F0B', fontSize: 11 }}>{c.fraud_flags[0]}</span>
                        : <span style={{ color: '#1D9E75', fontSize: 11 }}>Clean</span>}
                    </td>
                    <td style={{ padding: '9px 8px' }}>
                      <span style={{ background: st.bg, color: st.color, padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>
                        {c.status}
                      </span>
                    </td>
                    <td style={{ padding: '9px 8px', color: '#999', fontSize: 11 }}>
                      {new Date(c.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                );
              })}
              {(data?.recent_claims || []).length === 0 && (
                <tr><td colSpan={7} style={{ padding: '20px 8px', textAlign: 'center', color: '#999' }}>No claims yet — simulate a trigger below</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Simulate trigger panel */}
        <div style={{ background: 'white', borderRadius: 14, padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '2px dashed #e0e0e0' }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>Demo: Simulate a parametric trigger</h3>
          <p style={{ fontSize: 13, color: '#666', marginBottom: 16 }}>Fire a real trigger event and watch the claims pipeline execute in real time.</p>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div>
              <label style={{ fontSize: 11, color: '#999', display: 'block', marginBottom: 4 }}>Zone</label>
              <select value={simZone} onChange={e => setSimZone(e.target.value)}
                style={{ border: '1px solid #e0e0e0', borderRadius: 8, padding: '8px 12px', fontSize: 13 }}>
                {['T. Nagar','Adyar','Velachery','Porur','Anna Nagar','Sholinganallur'].map(z => (
                  <option key={z} value={z}>{z}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, color: '#999', display: 'block', marginBottom: 4 }}>Trigger type</label>
              <select value={simType} onChange={e => setSimType(e.target.value)}
                style={{ border: '1px solid #e0e0e0', borderRadius: 8, padding: '8px 12px', fontSize: 13 }}>
                {['HEAVY_RAIN','FLOOD','SEVERE_AQI','CURFEW'].map(t => (
                  <option key={t} value={t}>{t.replace(/_/g,' ')}</option>
                ))}
              </select>
            </div>
            <button onClick={handleSimulate} disabled={simLoading}
              style={{ background: '#085041', color: 'white', border: 'none', borderRadius: 8, padding: '9px 20px', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
              {simLoading ? 'Firing...' : 'Fire trigger →'}
            </button>
          </div>
          {simMsg && (
            <div style={{ marginTop: 12, background: simMsg.startsWith('✓') ? '#E1F5EE' : '#FCEBEB', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: simMsg.startsWith('✓') ? '#085041' : '#A32D2D', fontWeight: 500 }}>
              {simMsg}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
