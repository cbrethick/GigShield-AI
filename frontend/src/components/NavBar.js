import { useRouter } from 'next/router';

const TABS = [
  { id: 'home',   label: 'Home',   route: '/dashboard', icon: '⊞' },
  { id: 'claims', label: 'Claims', route: '/claims',    icon: '📋' },
  { id: 'policy', label: 'Policy', route: '/policy',    icon: '🛡' },
  { id: 'profile',label: 'Profile',route: '/profile',   icon: '👤' },
];

export default function NavBar({ active }) {
  const router = useRouter();
  return (
    <div style={{
      position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
      width: '100%', maxWidth: 480,
      background: 'rgba(13, 31, 26, 0.85)', backdropFilter: 'blur(16px)', 
      borderTop: '1px solid var(--border)',
      display: 'flex', zIndex: 100,
      paddingBottom: 'max(env(safe-area-inset-bottom), 16px)',
      paddingTop: 8,
    }}>
      {TABS.map(tab => {
        const isActive = active === tab.id;
        return (
          <button key={tab.id}
            onClick={() => router.push(tab.route)}
            style={{
              flex: 1, padding: '8px 4px', border: 'none',
              background: 'none', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            }}>
            <div style={{
              width: 32, height: 32, borderRadius: 10,
              background: isActive ? 'rgba(29,158,117,0.15)' : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, transition: 'all 0.2s',
              color: isActive ? 'var(--green-l)' : 'var(--text3)',
              boxShadow: isActive ? '0 0 12px rgba(29,158,117,0.3)' : 'none',
            }}>{tab.icon}</div>
            <span style={{
              fontSize: 11, fontWeight: isActive ? 700 : 600,
              color: isActive ? 'var(--green-l)' : 'var(--text3)',
              letterSpacing: '0.02em',
            }}>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
