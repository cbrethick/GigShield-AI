import React, { useEffect, useState } from 'react';

export default function ClaimSuccessOverlay({ amount, upiId, txRef, onClose }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    setShow(true);
    const timer = setTimeout(() => {
      // Auto close after 6 seconds if needed, or keep for user interaction
    }, 6000);
    return () => clearTimeout(timer);
  }, []);

  if (!amount) return null;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.85)', zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20, backdropFilter: 'blur(8px)',
      opacity: show ? 1 : 0, transition: 'opacity 0.5s ease-in-out',
    }}>
      <div style={{
        background: 'linear-gradient(160deg, #0d2a20 0%, #06110e 100%)',
        width: '100%', maxWidth: 400, borderRadius: 24, padding: 32,
        border: '1px solid rgba(29,158,117,0.3)', textAlign: 'center',
        boxShadow: '0 20px 50px rgba(0,0,0,0.5), 0 0 30px rgba(29,158,117,0.15)',
        transform: show ? 'scale(1) translateY(0)' : 'scale(0.9) translateY(20px)',
        transition: 'all 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
      }}>
        {/* Animated Checkmark */}
        <div style={{ marginBottom: 24 }}>
          <div className="success-checkmark">
            <div className="check-icon">
              <span className="icon-line line-tip"></span>
              <span className="icon-line line-long"></span>
              <div className="icon-circle"></div>
              <div className="icon-fix"></div>
            </div>
          </div>
        </div>

        <h2 style={{ fontSize: 24, fontWeight: 800, color: '#fff', marginBottom: 8 }}>Payout Dispatched!</h2>
        <p style={{ color: 'var(--text2)', fontSize: 14, marginBottom: 24 }}>Your claim was approved instantly by GigShield AI</p>

        <div style={{ 
          background: 'rgba(29,158,117,0.08)', borderRadius: 16, padding: 20, 
          marginBottom: 24, border: '1px dashed rgba(29,158,117,0.3)' 
        }}>
          <p style={{ fontSize: 13, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 1 }}>Amount Received</p>
          <p style={{ fontSize: 36, fontWeight: 900, color: 'var(--green-l)', margin: '4px 0' }}>₹{amount}</p>
          <p style={{ fontSize: 12, color: 'var(--text2)', marginTop: 8 }}>
            Sent to: <span style={{ fontWeight: 600, color: '#fff' }}>{upiId || 'Linked UPI ID'}</span>
          </p>
        </div>

        <div style={{ textAlign: 'left', background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: 12, marginBottom: 24 }}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
            <span style={{ fontSize:11, color:'var(--text3)' }}>Transaction ID</span>
            <span style={{ fontSize:11, color:'var(--text2)', fontWeight:600 }}>{txRef || 'GS-'+Math.random().toString(36).substr(2,9).toUpperCase()}</span>
          </div>
          <div style={{ display:'flex', justifyContent:'space-between' }}>
            <span style={{ fontSize:11, color:'var(--text3)' }}>Status</span>
            <span style={{ fontSize:11, color:'var(--green-l)', fontWeight:700 }}>VERIFIED SUCCESS</span>
          </div>
        </div>

        <button 
          onClick={() => { setShow(false); setTimeout(onClose, 500); }}
          style={{
            width: '100%', padding: '16px', borderRadius: 14, border: 'none',
            background: 'linear-gradient(135deg, var(--green), var(--green-l))',
            color: '#0a1628', fontWeight: 800, fontSize: 15, cursor: 'pointer',
            boxShadow: '0 8px 20px rgba(29,158,117,0.3)',
          }}
        >
          Great, thanks!
        </button>

        <p style={{ fontSize: 10, color: 'var(--text3)', marginTop: 20 }}>Powered by GigShield × RazorpayX</p>
      </div>

      <style>{`
        .success-checkmark {
          width: 80px; height: 115px; margin: 0 auto;
        }
        .check-icon {
          width: 80px; height: 80px; position: relative; border-radius: 50%;
          box-sizing: content-box; border: 4px solid #4CAF50;
        }
        .check-icon::after {
          content: ''; position: absolute; left: 28px; top: 40px;
          width: 30px; height: 50px; border-radius: 50%;
        }
        .icon-line {
          height: 5px; background-color: #4CAF50; display: block;
          border-radius: 2px; position: absolute; z-index: 10;
        }
        .line-tip {
          top: 46px; left: 14px; width: 25px; transform: rotate(45deg);
          animation: icon-line-tip 0.75s;
        }
        .line-long {
          top: 38px; right: 8px; width: 47px; transform: rotate(-45deg);
          animation: icon-line-long 0.75s;
        }
        .icon-circle {
          top: -4px; left: -4px; z-index: 10; width: 80px; height: 80px;
          border-radius: 50%; border: 4px solid rgba(76, 175, 80, 0.5);
          position: absolute; box-sizing: content-box;
        }
        @keyframes icon-line-tip {
          0% { width: 0; left: 1px; top: 19px; }
          54% { width: 0; left: 1px; top: 19px; }
          70% { width: 50px; left: -8px; top: 37px; }
          84% { width: 17px; left: 21px; top: 48px; }
          100% { width: 25px; top: 46px; left: 14px; }
        }
        @keyframes icon-line-long {
          0% { width: 0; right: 46px; top: 54px; }
          65% { width: 0; right: 46px; top: 54px; }
          84% { width: 55px; right: 0px; top: 35px; }
          100% { width: 47px; right: 8px; top: 38px; }
        }
      `}</style>
    </div>
  );
}
