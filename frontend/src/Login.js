// src/Login.js
import React, { useState, useEffect, useRef } from 'react';
import API_BASE_URL from './config';
import './App.css';

const Login = ({ onLogin }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    
    const abortControllerRef = useRef(null);

    useEffect(() => {
        // Cleanup function to abort any pending login requests if component unmounts
        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        abortControllerRef.current = new AbortController();

        try {
            const response = await fetch(`${API_BASE_URL}/api/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email.trim(), password: password }),
                signal: abortControllerRef.current.signal
            });

            const data = await response.json();

            if (data.success) {
                // 🔒 FIX: Securely store the JWT token and user profile in the browser
                localStorage.setItem('eatsync_token', data.user.token);
                localStorage.setItem('eatsync_user', JSON.stringify(data.user));
                
                onLogin(data.user);
            } else {
                setError(data.message || 'Incorrect email or password. Please try again.');
            }
        } catch (err) {
            if (err.name !== 'AbortError') {
                setError('Unable to connect to the server. Please check your network.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-container" style={{ 
            height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', 
            background: 'radial-gradient(circle at center, #f8fafc 0%, #e2e8f0 100%)', position: 'relative', overflow: 'hidden' 
        }}>
            
            {/* Animated Background Elements */}
            <div style={{
                position: 'absolute', top: '-50%', left: '-50%', width: '200%', height: '200%',
                background: 'radial-gradient(circle at center, rgba(79, 70, 229, 0.05) 0%, transparent 40%)',
                animation: 'rotateBg 30s linear infinite', zIndex: 1
            }}></div>

            <div className="fade-in" style={{ 
                background: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(20px)', padding: '50px 40px', 
                borderRadius: '32px', border: '1px solid rgba(255, 255, 255, 0.8)', 
                boxShadow: '0 40px 80px rgba(0, 0, 0, 0.08), inset 0 0 0 1px rgba(226, 232, 240, 0.5)', 
                width: '100%', maxWidth: '420px', textAlign: 'center', zIndex: 10 
            }}>
                
                <div style={{ marginBottom: '30px' }}>
                    <h2 style={{ fontSize: '2.4rem', fontWeight: '950', color: 'var(--text-bold)', margin: '0 0 10px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '2.8rem', filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.1))' }}>🍽️</span> EatSync
                    </h2>
                    <p style={{ fontSize: '0.95rem', fontWeight: '600', color: '#64748b', margin: 0 }}>
                        Welcome back! Please sign in to continue.
                    </p>
                </div>
                
                {error && (
                    <div style={{ 
                        background: '#fef2f2', color: '#ef4444', padding: '12px 15px', 
                        borderRadius: '12px', fontSize: '0.85rem', fontWeight: '800', 
                        marginBottom: '25px', border: '1px solid #fecdd3' 
                    }}>
                        ⚠️ {error}
                    </div>
                )}
                
                <form onSubmit={handleSubmit}>
                    <div style={{ marginBottom: '20px', textAlign: 'left' }}>
                        <label style={{ fontSize: '0.8rem', fontWeight: '800', marginBottom: '8px', color: '#64748b', display: 'block', paddingLeft: '4px' }}>
                            Email Address
                        </label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="Enter your email"
                            required
                            style={{ 
                                width: '100%', height: '50px', fontSize: '1rem', fontWeight: '600', 
                                border: '1px solid #cbd5e1', borderRadius: '14px', padding: '0 15px', 
                                boxSizing: 'border-box', outline: 'none', transition: 'all 0.3s' 
                            }}
                            onFocus={(e) => { e.target.style.borderColor = '#4f46e5'; e.target.style.boxShadow = '0 0 0 4px rgba(79, 70, 229, 0.1)'; }}
                            onBlur={(e) => { e.target.style.borderColor = '#cbd5e1'; e.target.style.boxShadow = 'none'; }}
                        />
                    </div>

                    <div style={{ marginBottom: '35px', textAlign: 'left' }}>
                        <label style={{ fontSize: '0.8rem', fontWeight: '800', marginBottom: '8px', color: '#64748b', display: 'block', paddingLeft: '4px' }}>
                            Password
                        </label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••••••"
                            required
                            style={{ 
                                width: '100%', height: '50px', fontSize: '1rem', fontWeight: '600', 
                                border: '1px solid #cbd5e1', borderRadius: '14px', padding: '0 15px', 
                                boxSizing: 'border-box', outline: 'none', transition: 'all 0.3s' 
                            }}
                            onFocus={(e) => { e.target.style.borderColor = '#4f46e5'; e.target.style.boxShadow = '0 0 0 4px rgba(79, 70, 229, 0.1)'; }}
                            onBlur={(e) => { e.target.style.borderColor = '#cbd5e1'; e.target.style.boxShadow = 'none'; }}
                        />
                    </div>

                    <button 
                        type="submit" 
                        disabled={loading} 
                        style={{ 
                            width: '100%', height: '52px', fontSize: '1rem', fontWeight: '800', 
                            borderRadius: '14px', background: 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)', 
                            color: 'white', border: 'none', cursor: loading ? 'not-allowed' : 'pointer', 
                            boxShadow: '0 10px 25px rgba(79, 70, 229, 0.3)', transition: 'all 0.3s',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}
                        onMouseOver={(e) => { if(!loading) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 15px 30px rgba(79, 70, 229, 0.4)'; } }}
                        onMouseOut={(e) => { if(!loading) { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 10px 25px rgba(79, 70, 229, 0.3)'; } }}
                    >
                        {loading ? '⏳ Signing in...' : 'Sign In'}
                    </button>
                </form>
                
                <p style={{ marginTop: '30px', fontSize: '0.75rem', color: '#94a3b8', fontWeight: '600' }}>
                    © {new Date().getFullYear()} EatSync Management
                </p>
            </div>
            
            <style>{`
                @keyframes rotateBg {
                    100% { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
};

export default Login;