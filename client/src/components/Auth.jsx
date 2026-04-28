import React, { useState } from 'react';
import { CheckCircle, Zap } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const Auth = ({ setUser }) => {
    const [isLogin, setIsLogin] = useState(true);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [timezone, setTimezone] = useState('Asia/Kolkata');
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        const endpoint = isLogin ? '/api/login' : '/api/signup';
        try {
            const body = isLogin ? { username, password } : { username, password, timezone };
            const response = await fetch(`${API_URL}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            const data = await response.json();
            if (response.ok) {
                setUser(data);
            } else {
                setError(data.error);
            }
        } catch (err) {
            setError('Server connection failed');
        }
    };

    return (
        <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="glass-card fade-in" style={{ width: '100%', maxWidth: '420px', padding: '3rem', background: 'rgba(255, 255, 255, 0.6)' }}>
                <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
                    <div style={{ width: '64px', height: '64px', background: 'var(--primary)', borderRadius: '18px', margin: '0 auto 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 20px rgba(242, 109, 91, 0.2)' }}>
                        <Zap size={32} color="white" />
                    </div>
                    <h1 style={{ fontSize: '2rem', fontWeight: 700, letterSpacing: '-0.03em' }}>{isLogin ? 'Sign In' : 'Join Planory'}</h1>
                    <p style={{ color: 'var(--text-muted)', fontWeight: 500, marginTop: '0.5rem' }}>Organize your life elegantly.</p>
                </div>
                
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div>
                        <label style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.5rem', display: 'block', color: 'var(--text-main)', opacity: 0.8 }}>USERNAME</label>
                        <input 
                            type="text" 
                            placeholder="Enter username" 
                            value={username} 
                            onChange={(e) => setUsername(e.target.value)} 
                            required 
                            style={{ borderRadius: '14px', padding: '1rem', background: 'rgba(255,255,255,0.7)', border: '1px solid var(--glass-border)', width: '100%' }}
                        />
                    </div>
                    <div>
                        <label style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.5rem', display: 'block', color: 'var(--text-main)', opacity: 0.8 }}>PASSWORD</label>
                        <input 
                            type="password" 
                            placeholder="••••••••" 
                            value={password} 
                            onChange={(e) => setPassword(e.target.value)} 
                            required 
                            style={{ borderRadius: '14px', padding: '1rem', background: 'rgba(255,255,255,0.7)', border: '1px solid var(--glass-border)', width: '100%' }}
                        />
                    </div>
                    
                    {!isLogin && (
                        <div>
                            <label style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.5rem', display: 'block', color: 'var(--text-main)', opacity: 0.8 }}>REGION</label>
                            <select 
                                value={timezone} 
                                onChange={(e) => setTimezone(e.target.value)}
                                style={{ borderRadius: '14px', padding: '1rem', background: 'rgba(255,255,255,0.7)', border: '1px solid var(--glass-border)', width: '100%' }}
                            >
                                <option value="Asia/Kolkata">IST (India)</option>
                                <option value="UTC">UTC (Universal)</option>
                                <option value="America/New_York">EST (New York)</option>
                            </select>
                        </div>
                    )}
                    
                    {error && <p style={{ color: '#e74c3c', fontSize: '0.85rem', fontWeight: 600, textAlign: 'center' }}>{error}</p>}
                    
                    <button 
                        type="submit" 
                        style={{ 
                            background: 'var(--primary)', 
                            color: 'white', 
                            padding: '1.1rem', 
                            borderRadius: '16px', 
                            fontWeight: 700,
                            fontSize: '1rem',
                            marginTop: '1rem',
                            border: 'none',
                            cursor: 'pointer',
                            boxShadow: '0 8px 20px rgba(242, 109, 91, 0.2)'
                        }}
                    >
                        {isLogin ? 'Sign In' : 'Create Account'}
                    </button>
                </form>

                <p style={{ textAlign: 'center', marginTop: '2rem', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                    {isLogin ? "New to Planory? " : "Already have an account? "}
                    <button 
                        onClick={() => setIsLogin(!isLogin)} 
                        style={{ background: 'none', color: 'var(--primary)', fontWeight: 700, border: 'none', cursor: 'pointer' }}
                    >
                        {isLogin ? 'Sign Up' : 'Sign In'}
                    </button>
                </p>
            </div>
        </div>
    );
};

export default Auth;
