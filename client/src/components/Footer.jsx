import { Heart, LogOut } from 'lucide-react';

const Footer = ({ onLogout }) => {
    return (
        <footer className="footer" style={{
            marginTop: 'auto',
            padding: '2rem 1rem',
            textAlign: 'center',
            borderTop: '1px solid var(--glass-border)',
            width: '100%'
        }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.8rem' }}>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    © 2026 Planory • Built with <Heart size={14} color="#e74c3c" fill="#e74c3c" /> for Productivity
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <a
                        href="https://github.com/owsam22"
                        target="_blank"
                        rel="noreferrer"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            fontSize: '0.8rem',
                            color: 'var(--text-muted)',
                            textDecoration: 'none',
                            transition: 'color 0.2s'
                        }}
                        onMouseOver={(e) => e.target.style.color = 'var(--primary)'}
                        onMouseOut={(e) => e.target.style.color = 'var(--text-muted)'}
                    >
                         @owsam22
                    </a>
                    {onLogout && (
                        <button
                            onClick={onLogout}
                            style={{
                                background: 'none',
                                border: 'none',
                                color: '#e74c3c',
                                cursor: 'pointer',
                                fontSize: '0.8rem',
                                fontWeight: 600,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.4rem',
                                padding: '0.5rem',
                                borderRadius: '8px',
                                transition: 'background 0.2s'
                            }}
                            onMouseOver={(e) => e.currentTarget.style.background = 'rgba(231, 76, 60, 0.1)'}
                            onMouseOut={(e) => e.currentTarget.style.background = 'none'}
                        >
                            <LogOut size={16} /> Logout
                        </button>
                    )}
                </div>
            </div>
        </footer>
    );
};

export default Footer;
