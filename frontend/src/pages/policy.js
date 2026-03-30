import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { getMyPolicies, isLoggedIn, simulateTrigger, getProfile } from '../lib/api';
import NavBar from '../components/NavBar';

export default function PolicyPage() {
  const router = useRouter();
  const [policies, setPolicies] = useState([]);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [simLoading, setSimLoading] = useState(false);
  const [simResult, setSimResult] = useState(null);

  useEffect(() => {
    if (!isLoggedIn()) { router.replace('/'); return; }
    Promise.all([getMyPolicies(), getProfile()])
      .then(([p, r]) => { setPolicies(p.data); setProfile(r.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function runDemo() {
    const active = policies.find(p => p.status === 'ACTIVE');
    if (!active) return;
    setSimLoading(true); setSimResult(null);
    try {
      const res = await simulateTrigger({
        zone: active.zone,
        trigger_type: 'HEAVY_RAIN',
        trigger_value: 78.5,
        threshold: 64,
        platform_status: 'PAUSED',
        duration_hours: 4,
      });
      setSimResult(res.data);
    } catch (err) {
      setSimResult({ error: err.response?.data?.detail || 'Error' });
    } finally { setSimLoading(false); }
  }

  const active = policies.find(p => p.status === 'ACTIVE');
  const daysLeft = active ? Math.max(0, Math.ceil((new Date(active.valid_till) - new Date()) / 86400000)) : 0;

  return (
    <div style={{ paddingBottom: 90 }}>
      {/* Header */}
      <div style={{
        padding: '20px 20px 16px', background: 'linear-gradient(160deg,#0a3828,#0d1f1a)',
        borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--text)' }}>←</button>
        <div>
          <h1 style={{ fontSize: 19, fontWeight: 800 }}>My Policy</h1>
        </div>
      </div>

      <div style={{ padding: '16px 20px' }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid var(--green)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
            <p style={{ color: 'var(--text2)', fontSize: 14 }}>Loading policy...</p>
          </div>
        )}

        {!loading && !active && (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <p style={{ fontWeight: 600, fontSize: 16, marginBottom: 12 }}>No active policy</p>
            <button className="btn-primary" onClick={() => router.push('/onboarding')}>Get covered →</button>
          </div>
        )}

        {active && (
          <>
            {/* Active policy card */}
            <div className="card" style={{ background: 'linear-gradient(135deg, var(--green-d), var(--green))', borderRadius: 20, padding: 20, color: 'white', marginBottom: 20, border: 'none', boxShadow: '0 8px 32px rgba(29,158,117,0.3)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div>
                  <p style={{ fontSize: 12, opacity: 0.8, color: 'rgba(255,255,255,0.8)' }}>Policy number</p>
                  <p style={{ fontWeight: 800, fontSize: 15, letterSpacing: '0.05em' }}>{active.policy_number}</p>
                </div>
                <span style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 20, padding: '4px 12px', fontSize: 11, fontWeight: 800, letterSpacing: '0.05em' }}>
                  ACTIVE
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                <div>
                  <p style={{ fontSize: 12, opacity: 0.7, color: 'rgba(255,255,255,0.8)' }}>Weekly premium</p>
                  <p style={{ fontSize: 28, fontWeight: 800 }}>₹{active.weekly_premium_inr}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: 12, opacity: 0.7, color: 'rgba(255,255,255,0.8)' }}>Max payout</p>
                  <p style={{ fontSize: 28, fontWeight: 800 }}>₹{active.max_payout_inr}</p>
                </div>
              </div>
              <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 10, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', backdropFilter: 'blur(4px)' }}>
                <div>
                  <p style={{ fontSize: 11, opacity: 0.7, color: 'rgba(255,255,255,0.8)' }}>Zone</p>
                  <p style={{ fontWeight: 700, fontSize: 13 }}>{active.zone}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: 11, opacity: 0.7, color: 'rgba(255,255,255,0.8)' }}>Valid till</p>
                  <p style={{ fontWeight: 700, fontSize: 13 }}>
                    {new Date(active.valid_till).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} ({daysLeft}d left)
                  </p>
                </div>
              </div>
            </div>

            {/* What's covered */}
            <div className="card" style={{ marginBottom: 16 }}>
              <h3 style={{ fontSize: 15, fontWeight: 800, marginBottom: 12, color: 'var(--text)' }}>What's covered</h3>
              {[
                { icon: '🌧', label: 'Heavy rain (>64mm/hr)' },
                { icon: '🌊', label: 'Flood alert' },
                { icon: '🏭', label: 'Severe AQI (>400)' },
                { icon: '📱', label: 'Platform order pause' },
                { icon: '🚫', label: 'Curfew / zone closure' },
              ].map(item => (
                <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 20 }}>{item.icon}</span>
                  <p style={{ fontSize: 14, color: 'var(--text)' }}>{item.label}</p>
                  <span style={{ marginLeft: 'auto', color: 'var(--green-l)', fontWeight: 800, fontSize: 16 }}>✓</span>
                </div>
              ))}
              <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 12, lineHeight: 1.5 }}>
                Coverage = income lost only. No health, vehicle, or accident coverage is provided.
              </p>
            </div>

            {/* Demo trigger */}
            <div className="card" style={{ marginBottom: 16, border: '1px dashed rgba(239,159,39,0.4)', background: 'rgba(239,159,39,0.05)' }}>
              <h3 style={{ fontSize: 15, fontWeight: 800, marginBottom: 6, color: 'var(--amber)' }}>Demo: Simulate a trigger</h3>
              <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 12, lineHeight: 1.5 }}>
                Simulate a heavy rain event in {active.zone} to see the auto-claim process in action.
              </p>
              <button className="btn-primary" onClick={runDemo} disabled={simLoading} style={{ background: 'linear-gradient(135deg, #EF9F27, #f5b041)', boxShadow: '0 4px 16px rgba(239,159,39,0.3)', color: '#0d1f1a' }}>
                {simLoading ? 'Triggering...' : 'Simulate heavy rain ⚡'}
              </button>
              {simResult && (
                <div style={{ marginTop: 12, background: simResult.error ? 'rgba(226,75,74,0.1)' : 'rgba(29,158,117,0.1)', borderRadius: 10, padding: '12px 14px', border: `1px solid ${simResult.error ? 'rgba(226,75,74,0.2)' : 'rgba(29,158,117,0.2)'}` }}>
                  {simResult.error ? (
                    <p style={{ color: 'var(--red)', fontSize: 13, fontWeight: 600 }}>{simResult.error}</p>
                  ) : (
                    <>
                      <p style={{ color: 'var(--green-l)', fontWeight: 800, fontSize: 14, marginBottom: 4 }}>
                        Trigger fired successfully! ✅
                      </p>
                      <p style={{ color: 'var(--green)', fontSize: 13 }}>
                        Claims created: {simResult.result?.claims_created ?? 0} |
                        Approved: {simResult.result?.approved ?? 0} |
                        Payout: ₹{simResult.result?.total_payout_inr ?? 0}
                      </p>
                      <p style={{ color: 'var(--text2)', fontSize: 12, marginTop: 6 }}>Check Claims tab to see your process →</p>
                    </>
                  )}
                </div>
              )}
            </div>
          </>
        )}

        {/* Past policies */}
        {policies.filter(p => p.status !== 'ACTIVE').length > 0 && (
          <div style={{ marginTop: 24 }}>
            <h3 style={{ fontSize: 15, fontWeight: 800, marginBottom: 12, color: 'var(--text2)' }}>Past policies</h3>
            {policies.filter(p => p.status !== 'ACTIVE').map(p => (
              <div key={p.id} className="card" style={{ marginBottom: 10, opacity: 0.6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <p style={{ fontSize: 13, fontWeight: 700 }}>{p.policy_number}</p>
                  <span style={{ fontSize: 11, background: 'var(--surface2)', color: 'var(--text2)', padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>{p.status}</span>
                </div>
                <p style={{ fontSize: 12, color: 'var(--text3)' }}>
                  {new Date(p.valid_from).toLocaleDateString('en-IN')} – {new Date(p.valid_till).toLocaleDateString('en-IN')} · ₹{p.weekly_premium_inr}/week
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <NavBar active="policy" />
      <style>{`@keyframes spin{to{transform:rotate(360deg);}}`}</style>
    </div>
  );
}
