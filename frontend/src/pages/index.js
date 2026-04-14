import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { login, setToken, isLoggedIn, sendEmailOTP, sendOTP } from '../lib/api';
import { auth } from '../lib/firebase';
import { RecaptchaVerifier, signInWithPhoneNumber, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState('login'); // 'login' or 'otp'
  const [authMode, setAuthMode] = useState('phone'); // 'phone' or 'email'
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [confirmationResult, setConfirmationResult] = useState(null);

  useEffect(() => {
    if (isLoggedIn()) router.replace('/dashboard');
    
    return () => {
      if (typeof window !== 'undefined' && window.recaptchaVerifier) {
        window.recaptchaVerifier.clear();
        window.recaptchaVerifier = null;
      }
    };
  }, []);

  const setupRecaptcha = () => {
    if (typeof window !== 'undefined' && !window.recaptchaVerifier) {
      try {
        window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
          'size': 'invisible',
          'callback': (response) => { console.log("reCAPTCHA verified"); },
          'expired-callback': () => { console.log("reCAPTCHA expired"); }
        });
      } catch (err) {
        console.error("reCAPTCHA init error:", err);
      }
    }
  };

  async function handleSendOTP(e) {
    e.preventDefault();
    if (phone.length < 10) { setError('Enter a valid 10-digit number'); return; }
    setLoading(true); setError('');
    
    if (phone === '6383686510') {
      try {
        await sendOTP(phone);
        console.log("Demo SMS Sent via backend");
        setStep('otp');
      } catch (err) {
        setError("Failed to send demo OTP");
      }
      setLoading(false);
      return;
    }

    console.log("Starting Firebase OTP flow for:", phone);
    setupRecaptcha();
    
    const appVerifier = window.recaptchaVerifier;
    const formatPhone = '+91' + phone;

    try {
      const confirmation = await signInWithPhoneNumber(auth, formatPhone, appVerifier);
      console.log("SMS Sent successfully!");
      setConfirmationResult(confirmation);
      setStep('otp');
    } catch (err) {
      console.error("Firebase Sign-in Error:", err);
      setError(err.message || 'Failed to send OTP. Ensure "Phone Auth" is enabled in Firebase Console.');
      if (window.recaptchaVerifier) {
        window.recaptchaVerifier.clear();
        window.recaptchaVerifier = null;
      }
    } finally { setLoading(false); }
  }

  async function handleGoogleLogin() {
    setLoading(true); setError('');
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const idToken = await result.user.getIdToken();
      
      const res = await login({ firebase_token: idToken });
      setToken(res.access_token);
      
      if (res.is_new_rider) {
        router.push(`/onboarding?name=${encodeURIComponent(result.user.displayName || '')}&email=${encodeURIComponent(result.user.email || '')}`);
      } else {
        router.push('/dashboard');
      }
    } catch (err) {
      console.error("Google Auth Error:", err);
      setError(err.message || 'Google Login failed');
    } finally { setLoading(false); }
  }

  async function handleSendEmailOTP(e) {
    e.preventDefault();
    const emailLower = email.trim().toLowerCase();
    if (!emailLower.includes('@')) { setError('Enter a valid email'); return; }
    setLoading(true); setError('');
    try {
      await sendEmailOTP(emailLower);
      setStep('otp');
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to send email OTP');
    } finally { setLoading(false); }
  }

  async function handleVerifyOTP(e) {
    e.preventDefault();
    if (otp.length < 6) { setError('Enter 6-digit OTP'); return; }
    setLoading(true); setError('');

    try {
      let res;
      if (authMode === 'phone' && phone === '6383686510') {
        res = await login({ phone: '+91' + phone, otp });
      } else if (authMode === 'phone' && confirmationResult) {
        const result = await confirmationResult.confirm(otp);
        const idToken = await result.user.getIdToken();
        res = await login({ phone: '+91' + phone, firebase_token: idToken });
      } else if (authMode === 'email') {
        res = await login({ email: email.trim().toLowerCase(), otp });
      } else {
        throw new Error("Invalid verification state");
      }
      
      if (res.is_new_rider) {
        setToken(res.access_token);
        const query = authMode === 'phone' ? `phone=${phone}` : `email=${email}`;
        router.push(`/onboarding?${query}`);
      } else {
        setToken(res.access_token);
        router.push('/dashboard');
      }
    } catch (err) {
      console.error("Verification Error:", err);
      setError(err.response?.data?.detail || err.message || 'Invalid OTP');
    } finally { setLoading(false); }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', padding: '0 20px', backgroundColor: '#0f1715' }}>
      <Head>
        <title>Login | GigShield</title>
      </Head>
      <div id="recaptcha-container"></div>
      
      {/* Hero Section */}
      <div style={{ textAlign: 'center', padding: '60px 0 40px' }}>
        <div style={{
          width: 80, height: 80, borderRadius: 24,
          background: 'linear-gradient(135deg, rgba(29,158,117,0.2), rgba(29,158,117,0.05))',
          border: '1.5px solid rgba(29,158,117,0.4)',
          margin: '0 auto 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 20px rgba(29,158,117,0.2)'
        }}>
          <span style={{ fontSize: 36 }}>🛡</span>
        </div>
        <h1 style={{ fontSize: 32, fontWeight: 800, color: '#e8f5f1', letterSpacing: '-0.5px' }}>
          GigShield
        </h1>
        <p style={{ color: '#94a3b8', marginTop: 8, fontSize: 15 }}>
          Zero-cost income protection for delivery partners
        </p>
      </div>

      {/* Form Card */}
      <div className="card animate-up" style={{ padding: 24, maxWidth: 400, margin: '0 auto', width: '100%', backgroundColor: '#1a2421', border: '1px solid #2d3b36' }}>
        {step === 'login' ? (
          <div>
            <h2 style={{ fontSize: 19, fontWeight: 700, marginBottom: 6, color: '#f8fafc' }}>Welcome Back</h2>
            <p style={{ color: '#94a3b8', fontSize: 13, marginBottom: 20 }}>Secure, free authentication for everyone</p>

            {/* Google Login Button */}
            <button 
              onClick={handleGoogleLogin}
              disabled={loading}
              style={{
                width: '100%', padding: '12px', borderRadius: '10px',
                border: '1px solid #2d3b36', backgroundColor: '#ffffff',
                color: '#334155', fontWeight: 600, fontSize: 14,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                cursor: 'pointer', marginBottom: 20
              }}
            >
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" width="18" height="18" alt="G" />
              Continue with Google
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <div style={{ flex: 1, height: 1, backgroundColor: '#2d3b36' }}></div>
              <span style={{ fontSize: 12, color: '#64748b' }}>OR</span>
              <div style={{ flex: 1, height: 1, backgroundColor: '#2d3b36' }}></div>
            </div>

            <form onSubmit={authMode === 'phone' ? handleSendOTP : handleSendEmailOTP}>
              {/* Toggle */}
              <div style={{ display: 'flex', gap: 4, backgroundColor: '#0f1715', padding: 4, borderRadius: 8, marginBottom: 16 }}>
                <button type="button" onClick={() => setAuthMode('phone')}
                  style={{
                    flex: 1, padding: '8px', borderRadius: 6, border: 'none',
                    fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    backgroundColor: authMode === 'phone' ? '#1d9e75' : 'transparent',
                    color: authMode === 'phone' ? '#fff' : '#94a3b8'
                  }}>Phone</button>
                <button type="button" onClick={() => setAuthMode('email')}
                  style={{
                    flex: 1, padding: '8px', borderRadius: 6, border: 'none',
                    fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    backgroundColor: authMode === 'email' ? '#1d9e75' : 'transparent',
                    color: authMode === 'email' ? '#fff' : '#94a3b8'
                  }}>Email</button>
              </div>

              {authMode === 'phone' ? (
                <div style={{ display: 'flex', marginBottom: 16 }}>
                  <span style={{
                    background: '#0f1715', border: '1.5px solid #2d3b36',
                    borderRight: 'none', borderRadius: '10px 0 0 10px',
                    padding: '14px 14px', fontSize: 15, color: '#94a3b8',
                  }}>+91</span>
                  <input
                    className="input-field"
                    style={{ borderRadius: '0 10px 10px 0', backgroundColor: '#0f1715', color: '#fff', border: '1.5px solid #2d3b36' }}
                    type="tel" placeholder="Mobile number"
                    value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, ''))}
                    maxLength={10}
                  />
                </div>
              ) : (
                <input
                  className="input-field"
                  style={{ marginBottom: 16, backgroundColor: '#0f1715', color: '#fff', border: '1.5px solid #2d3b36' }}
                  type="email" placeholder="Enter your email"
                  value={email} onChange={e => setEmail(e.target.value)}
                />
              )}

              {error && <p style={{ color: '#ef4444', fontSize: 13, marginBottom: 12 }}>{error}</p>}
              <button className="btn-primary" type="submit" disabled={loading} style={{ backgroundColor: '#1d9e75', color: '#fff' }}>
                {loading ? 'Processing...' : `Send ${authMode === 'phone' ? 'OTP' : 'Code'} →`}
              </button>
            </form>
          </div>
        ) : (
          <form onSubmit={handleVerifyOTP}>
            <h2 style={{ fontSize: 19, fontWeight: 700, marginBottom: 6, color: '#f8fafc' }}>Verify Code</h2>
            <p style={{ color: '#94a3b8', fontSize: 13, marginBottom: 16 }}>
              Sent to {authMode === 'phone' ? `+91 ${phone}` : email}
            </p>
            
            <input
              className="input-field"
              style={{ letterSpacing: 10, fontSize: 24, textAlign: 'center', marginBottom: 16, fontWeight: 700, backgroundColor: '#0f1715', color: '#fff', border: '1.5px solid #2d3b36' }}
              type="tel" placeholder="______"
              value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
              maxLength={6} autoFocus
            />

            {error && <p style={{ color: '#ef4444', fontSize: 13, marginBottom: 12 }}>{error}</p>}
            <button className="btn-primary" type="submit" disabled={loading} style={{ backgroundColor: '#1d9e75', color: '#fff' }}>
              {loading ? 'Verifying...' : 'Verify & Continue →'}
            </button>
            <button type="button" style={{ marginTop: 16, background: 'none', border: 'none', color: '#94a3b8', fontSize: 13, cursor: 'pointer', width: '100%', textAlign: 'center' }}
              onClick={() => { setStep('login'); setError(''); setOtp(''); }}>
              ← Try another method
            </button>
          </form>
        )}
      </div>

      <p style={{ textAlign: 'center', color: '#64748b', fontSize: 12, marginTop: 24, marginBottom: 40, lineHeight: 1.6 }}>
        Secure login · {authMode === 'phone' ? 'Managed by Firebase' : 'Zero-cost Email Link'}
      </p>
    </div>
  );
}
