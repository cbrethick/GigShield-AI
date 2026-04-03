import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { sendOTP, verifyOTP, saveToken, isLoggedIn } from '../lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isLoggedIn()) router.replace('/dashboard');
  }, []);

  async function handleSendOTP(e) {
    e.preventDefault();
    if (phone.length < 10) { setError('Enter a valid 10-digit number'); return; }
    setLoading(true); setError('');
    try {
      await sendOTP('+91' + phone);
      setStep('otp');
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to send OTP');
    } finally { setLoading(false); }
  }

  async function handleVerifyOTP(e) {
    e.preventDefault();
    if (otp.length < 4) { setError('Enter the OTP'); return; }
    setLoading(true); setError('');
    try {
      const res = await verifyOTP('+91' + phone, otp);
      saveToken(res.data.access_token);
      localStorage.setItem('gs_rider_id', res.data.rider_id);
      router.push(res.data.is_new_rider ? '/onboarding' : '/dashboard');
    } catch (err) {
      setError(err.response?.data?.detail || 'Invalid OTP');
    } finally { setLoading(false); }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', padding: '0 20px' }}>
      {/* Hero Section */}
      <div style={{ textAlign: 'center', padding: '60px 0 40px' }}>
        {/* Logo */}
        <div style={{
          width: 80, height: 80, borderRadius: 24,
          background: 'linear-gradient(135deg, rgba(29,158,117,0.2), rgba(29,158,117,0.05))',
          border: '1.5px solid rgba(29,158,117,0.4)',
          margin: '0 auto 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          animation: 'glow 3s ease-in-out infinite',
        }}>
          <span style={{ fontSize: 36 }}>🛡</span>
        </div>
        <h1 style={{ fontSize: 32, fontWeight: 800, color: '#e8f5f1', letterSpacing: '-0.5px' }}>
          GigShield
        </h1>
        <p style={{ color: 'var(--text2)', marginTop: 8, fontSize: 15 }}>
          Income protection for delivery partners
        </p>

        {/* Stats strip */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginTop: 28 }}>
          {[
            { val: '₹800', label: 'Avg weekly payout' },
            { val: '< 10min', label: 'Auto-approval' },
            { val: '5', label: 'Trigger types' },
          ].map(s => (
            <div key={s.label} style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 17, fontWeight: 700, color: 'var(--green-l)' }}>{s.val}</p>
              <p style={{ fontSize: 11, color: 'var(--text3)' }}>{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Form Card */}
      <div className="card animate-up" style={{ padding: 24 }}>
        {step === 'phone' ? (
          <form onSubmit={handleSendOTP}>
            <h2 style={{ fontSize: 19, fontWeight: 700, marginBottom: 6 }}>Login / Sign up</h2>
            <p style={{ color: 'var(--text2)', fontSize: 13, marginBottom: 20 }}>Enter your mobile number to continue</p>

            <div style={{ display: 'flex', marginBottom: 16 }}>
              <span style={{
                background: 'var(--surface2)', border: '1.5px solid var(--border)',
                borderRight: 'none', borderRadius: '10px 0 0 10px',
                padding: '14px 14px', fontSize: 15, color: 'var(--text2)',
              }}>+91</span>
              <input
                className="input-field"
                style={{ borderRadius: '0 10px 10px 0' }}
                type="tel" placeholder="10-digit mobile number"
                value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, ''))}
                maxLength={10} autoFocus
              />
            </div>

            {error && <p style={{ color: 'var(--red)', fontSize: 13, marginBottom: 12 }}>{error}</p>}
            <button className="btn-primary" type="submit" disabled={loading}>
              {loading ? 'Sending...' : 'Send OTP →'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOTP}>
            <input
              className="input-field"
              style={{ letterSpacing: 10, fontSize: 24, textAlign: 'center', marginBottom: 16, fontWeight: 700 }}
              type="tel" placeholder="______"
              value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
              maxLength={6} autoFocus
            />

            {error && <p style={{ color: 'var(--red)', fontSize: 13, marginBottom: 12 }}>{error}</p>}
            <button className="btn-primary" type="submit" disabled={loading}>
              {loading ? 'Verifying...' : 'Verify & Continue →'}
            </button>
            <button type="button" className="btn-outline" style={{ marginTop: 10 }}
              onClick={() => { setStep('phone'); setError(''); setOtp(''); }}>
              ← Change number
            </button>
          </form>
        )}
      </div>

      {/* Live Support Hint */}
      <p style={{ textAlign: 'center', color: 'var(--text3)', fontSize: 12, marginTop: 24, lineHeight: 1.6 }}>
        Secure login via 2FA · Managed by GigShield Core
      </p>
    </div>
  );
}
