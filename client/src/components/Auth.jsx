import React, { useState } from 'react';
import { Zap, ShieldCheck, LayoutDashboard } from 'lucide-react';
import { GoogleLogin } from '@react-oauth/google';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const Auth = ({ setUser }) => {
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleGoogleSuccess = async (credentialResponse) => {
        setIsLoading(true);
        setError('');
        try {
            const response = await fetch(`${API_URL}/api/google-login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ credential: credentialResponse.credential })
            });
            const data = await response.json();
            if (response.ok) {
                setUser(data);
            } else {
                setError(data.error || 'Authentication failed');
            }
        } catch (err) {
            setError('Server connection failed');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
            <div className="glass-card fade-in" style={{ 
                width: '100%', 
                maxWidth: '440px', 
                padding: '3.5rem 2.5rem', 
                background: 'rgba(255, 255, 255, 0.7)',
                backdropFilter: 'blur(20px)',
                borderRadius: '32px',
                border: '1px solid rgba(255, 255, 255, 0.4)',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.1)',
                textAlign: 'center'
            }}>
                <div style={{ marginBottom: '3rem' }}>
                    <div style={{ 
                        width: '80px', 
                        height: '80px', 
                        background: 'linear-gradient(135deg, var(--primary) 0%, #ff8e7e 100%)', 
                        borderRadius: '24px', 
                        margin: '0 auto 2rem', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        boxShadow: '0 12px 24px rgba(242, 109, 91, 0.3)',
                        transform: 'rotate(-5deg)'
                    }}>
                        <Zap size={40} color="white" />
                    </div>
                    <h1 style={{ fontSize: '2.5rem', fontWeight: 800, letterSpacing: '-0.04em', color: 'var(--text-main)', marginBottom: '0.75rem' }}>Planory</h1>
                    <p style={{ color: 'var(--text-muted)', fontWeight: 500, fontSize: '1.1rem' }}>Your life, organized elegantly.</p>
                </div>

                <div style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: '2rem', 
                    alignItems: 'center',
                    padding: '1rem 0'
                }}>
                    <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
                        <GoogleLogin
                            onSuccess={handleGoogleSuccess}
                            onError={() => setError('Google Login Failed')}
                            useOneTap
                            itp_support={true}
                            ux_mode="popup"
                            theme="filled_blue"
                            shape="pill"
                            size="large"
                            width="320"
                        />
                    </div>

                    {error && (
                        <div style={{ 
                            background: '#fee2e2', 
                            color: '#dc2626', 
                            padding: '0.75rem 1rem', 
                            borderRadius: '12px', 
                            fontSize: '0.9rem', 
                            fontWeight: 600,
                            width: '100%',
                            border: '1px solid #fecaca'
                        }}>
                            {error}
                        </div>
                    )}
                </div>

                <div style={{ marginTop: '4rem', display: 'flex', justifyContent: 'center', gap: '1.5rem', opacity: 0.6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', fontWeight: 600 }}>
                        <ShieldCheck size={16} />
                        <span>Secure Auth</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', fontWeight: 600 }}>
                        <LayoutDashboard size={16} />
                        <span>Cloud Sync</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Auth;
