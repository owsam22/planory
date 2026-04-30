import { Heart, Github } from 'lucide-react';

const Footer = () => {
    return (
        <footer className="footer" style={{
            marginTop: 'auto',
            padding: '2rem 1rem',
            textAlign: 'center',
            borderTop: '1px solid var(--glass-border)',
            width: '100%'
        }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.6rem' }}>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    © 2026 Planory • Built with <Heart size={12} color="#e74c3c" fill="#e74c3c" /> for Productivity
                </p>
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
                        transition: 'transform 0.2s'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                    onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                >
                    <Github size={16} /> Developed by @owsam22
                </a>
            </div>
        </footer>
    );
};

export default Footer;
