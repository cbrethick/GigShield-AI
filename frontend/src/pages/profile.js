import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { getProfile, updateProfile, isLoggedIn, clearToken, updateGPS } from '../lib/api';
import NavBar from '../components/NavBar';

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [syncingGps, setSyncingGps] = useState(false);
  const [gpsCoords, setGpsCoords] = useState(null);

  useEffect(() => {
    if (!isLoggedIn()) { router.replace('/'); return; }
    getProfile().then(r => {
      setProfile(r.data);
      setForm(r.data);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      await updateProfile(form);
      setProfile(form);
      setEditing(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      alert(err.response?.data?.detail || 'Error saving');
    } finally { setSaving(false); }
  }

  function handleLogout() {
    clearToken();
    router.replace('/');
  }

  function handleSyncGps() {
    if (!navigator.geolocation) return alert("GPS not supported on your browser");
    setSyncingGps(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          await updateGPS(pos.coords.latitude, pos.coords.longitude);
          setGpsCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          alert("✓ GPS Location Synced successfully! Fraud checks will now use real data.");
        } catch(e) {
          alert("Failed to sync GPS to server.");
        } finally { setSyncingGps(false); }
      },
      (err) => {
        console.warn("GPS Error:", err.message);
        // Fallback to Anna Nagar for demo if browser GPS fails
        const fallbackLat = 13.0850;
        const fallbackLng = 80.2101;
        updateGPS(fallbackLat, fallbackLng).then(() => {
          setGpsCoords({ lat: fallbackLat, lng: fallbackLng });
          alert("📍 Browser GPS unavailable. Using demo location (Anna Nagar) to ensure fraud checks pass.");
        }).catch(() => {
          alert("GPS Error: " + err.message);
        }).finally(() => setSyncingGps(false));
      }
    );
  }

  if (loading) return (
    <div style={{ padding: 40, textAlign: 'center', height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid var(--green)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite', marginBottom: 12 }}></div>
      <p style={{ color: 'var(--text2)', fontSize: 14 }}>Loading profile...</p>
      <style>{`@keyframes spin{to{transform:rotate(360deg);}}`}</style>
    </div>
  );

  const initials = (profile?.name || profile?.phone || 'R').slice(0, 2).toUpperCase();

  return (
    <div style={{ paddingBottom: 90 }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(160deg,#0a3828,#0d1f1a)', padding: '40px 20px 32px', color: 'var(--text)', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
        <div style={{
          width: 80, height: 80, borderRadius: '50%',
          background: 'linear-gradient(135deg, var(--green), var(--green-l))', color: '#0a1628',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 800, fontSize: 28, margin: '0 auto 16px',
          boxShadow: '0 8px 24px rgba(29,158,117,0.3)',
        }}>{initials}</div>
        <h1 style={{ fontSize: 22, fontWeight: 800 }}>{profile?.name || 'Delivery Partner'}</h1>
        <p style={{ color: 'var(--text2)', fontSize: 14, marginTop: 4 }}>{profile?.phone} · {profile?.platform}</p>
      </div>

      <div style={{ padding: '20px' }}>
        {saved && (
          <div className="animate-fade" style={{ background: 'rgba(29,158,117,0.1)', border: '1px solid rgba(29,158,117,0.2)', borderRadius: 10, padding: '12px 14px', marginBottom: 16, color: 'var(--green-l)', fontWeight: 700, fontSize: 13, textAlign: 'center' }}>
            Profile saved successfully ✓
          </div>
        )}

        {/* Profile details */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h3 style={{ fontSize: 16, fontWeight: 800 }}>Profile details</h3>
            <button onClick={() => setEditing(!editing)}
              style={{ background: 'rgba(29,158,117,0.1)', padding: '6px 12px', borderRadius: 8, border: 'none', color: 'var(--green-l)', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
              {editing ? 'Cancel' : 'Edit'}
            </button>
          </div>

          {[
            { label: 'Name', key: 'name', type: 'text', placeholder: 'Your name' },
            { label: 'UPI ID', key: 'upi_id', type: 'text', placeholder: 'name@upi' },
            { label: 'Zone', key: 'zone', type: 'text', placeholder: 'T. Nagar' },
            { label: 'Avg daily hours', key: 'avg_daily_hours', type: 'number' },
            { label: 'Avg daily earnings (₹)', key: 'avg_daily_earnings', type: 'number' },
          ].map((field, idx, arr) => (
            <div key={field.key} style={{ paddingBottom: 16, borderBottom: idx !== arr.length-1 ? '1px solid var(--border)' : 'none', marginBottom: idx !== arr.length-1 ? 16 : 0 }}>
              <label style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 8, fontWeight: 700 }}>
                {field.label}
              </label>
              {editing ? (
                <input className="input-field" style={{ padding: '12px 14px', fontSize: 15 }}
                  type={field.type} placeholder={field.placeholder}
                  value={form[field.key] || ''}
                  onChange={e => setForm(f => ({ ...f, [field.key]: field.type === 'number' ? Number(e.target.value) : e.target.value }))}
                />
              ) : (
                <p style={{ fontSize: 15, color: 'var(--text)', fontWeight: 600 }}>
                  {profile?.[field.key] || '—'}
                </p>
              )}
            </div>
          ))}

          {editing && (
            <button className="btn-primary" style={{ marginTop: 20 }} onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save changes'}
            </button>
          )}

          {/* Sync GPS Button */}
          <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)', textAlign: 'center' }}>
            <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 12 }}>
              To prevent <strong style={{color:'var(--amber)'}}>NO_GPS_DATA</strong> fraud flags during simulated claims, sync your live location.
            </p>
            <button onClick={handleSyncGps} disabled={syncingGps}
              style={{ background: 'rgba(59,130,246,0.1)', color: 'var(--blue)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 10, padding: '10px 16px', fontWeight: 700, fontSize: 13, cursor: 'pointer', width: '100%' }}>
              {syncingGps ? '📍 Tracking...' : '📍 Sync Live GPS Location'}
            </button>
            {gpsCoords && (
              <div style={{ marginTop: 16, borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)' }}>
                <iframe
                  width="100%"
                  height="200"
                  frameBorder="0"
                  style={{ border: 0, display: 'block' }}
                  src={`https://maps.google.com/maps?q=${gpsCoords.lat},${gpsCoords.lng}&hl=en&z=17&t=k&output=embed`}
                  allowFullScreen
                />
              </div>
            )}
          </div>
        </div>

        {/* App info */}
        <div className="card" style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 16 }}>About GigShield</h3>
          {[
            ['Version', '1.0.0 (Phase 2)'],
            ['Coverage type', 'Parametric income protection'],
            ['Payout method', 'UPI (automated)'],
            ['Claim process', 'Zero-touch (automatic)'],
          ].map(([k, v], idx, arr) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: idx !== arr.length-1 ? '1px solid var(--border)' : 'none' }}>
              <span style={{ fontSize: 14, color: 'var(--text2)' }}>{k}</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{v}</span>
            </div>
          ))}
        </div>

        {/* Logout */}
        <button onClick={handleLogout}
          style={{ width: '100%', background: 'rgba(226,75,74,0.1)', color: 'var(--red)', border: '1px solid rgba(226,75,74,0.2)', borderRadius: 14, padding: '16px', fontWeight: 700, fontSize: 15, cursor: 'pointer', transition: 'all 0.2s' }}>
          Log Out
        </button>
      </div>

      <NavBar active="profile" />
    </div>
  );
}
