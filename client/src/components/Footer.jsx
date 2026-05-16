import { Heart, Github } from 'lucide-react';

const Footer = () => {
    return (
        <footer className="footer" style={{
            padding: '1.5rem 1rem',
            textAlign: 'center',
            borderTop: '1px solid var(--glass-border)',
            width: '100%',
            background: 'transparent'
        }}>
            <div style={{ 
                display: 'flex', 
                flexWrap: 'wrap', 
                alignItems: 'center', 
                justifyContent: 'center', 
                gap: '1.5rem',
                maxWidth: '1200px',
                margin: '0 auto'
            }}>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem', margin: 0 }}>
                    © 2026 Planory • for productivity
                </p>
                
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <a href="#" style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textDecoration: 'none', fontWeight: 500 }}>About</a>
                    <a href="#" style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textDecoration: 'none', fontWeight: 500 }}>Privacy</a>
                </div>

                <a 
                    href="https://github.com/owsam22" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    style={{ 
                        fontSize: '0.8rem', 
                        color: 'var(--primary)', 
                        textDecoration: 'none',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        transition: 'all 0.2s',
                        background: 'var(--glass)',
                        padding: '0.3rem 0.7rem',
                        borderRadius: '10px',
                        border: '1px solid var(--glass-border)',
                        margin: 0
                    }}
                    onMouseOver={(e) => {
                        e.currentTarget.style.transform = 'translateY(-1px)';
                        e.currentTarget.style.background = 'white';
                    }}
                    onMouseOut={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.background = 'var(--glass)';
                    }}
                >
                    <Github size={14} />developed by @owsam22
                </a>
            </div>
        </footer>
    );
};

export default Footer;
