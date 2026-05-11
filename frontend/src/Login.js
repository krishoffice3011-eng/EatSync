// src/Login.js
import React, { useState, useEffect, useRef } from 'react';
import API_BASE_URL from './config';
import './App.css';

const Login = ({ onLogin }) => {
    // Mode toggle
    const [mode, setMode] = useState('login');

    // States
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [loading, setLoading] = useState(false);
    
    const abortControllerRef = useRef(null);

    useEffect(() => {
        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, []);

    const handleLoginSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccessMsg('');
        setLoading(true);

        if (abortControllerRef.current) abortControllerRef.current.abort();
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
                localStorage.setItem('eatsync_token', data.user.token);
                localStorage.setItem('eatsync_user', JSON.stringify(data.user));
                onLogin(data.user);
            } else {
                setError(data.message || 'Incorrect email or password. Please try again.');
            }
        } catch (err) {
            if (err.name !== 'AbortError') setError('Unable to connect to the server. Please check your network.');
        } finally {
            setLoading(false);
        }
    };

    const handleChangePasswordSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccessMsg('');

        if (newPassword !== confirmPassword) {
            setError("New passwords do not match.");
            return;
        }

        if (newPassword.length < 4) {
            setError("New password must be at least 4 characters long.");
            return;
        }

        setLoading(true);

        if (abortControllerRef.current) abortControllerRef.current.abort();
        abortControllerRef.current = new AbortController();

        try {
            const response = await fetch(`${API_BASE_URL}/api/change-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    email: email.trim(), 
                    currentPassword: currentPassword, 
                    newPassword: newPassword 
                }),
                signal: abortControllerRef.current.signal
            });

            const data = await response.json();

            if (data.success) {
                setSuccessMsg('Password updated successfully! You can now log in.');
                setMode('login');
                setPassword('');
                setCurrentPassword('');
                setNewPassword('');
                setConfirmPassword('');
            } else {
                setError(data.message || 'Failed to update password. Check your current password.');
            }
        } catch (err) {
            if (err.name !== 'AbortError') setError('Unable to connect to the server.');
        } finally {
            setLoading(false);
        }
    };

    const switchMode = (newMode) => {
        setMode(newMode);
        setError('');
        setSuccessMsg('');
        setPassword('');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
    };

    // Shared Input Style to match your UI perfectly
    const inputProps = {
        required: true,
        style: { 
            width: '100%', height: '50px', fontSize: '1rem', fontWeight: '600', 
            border: '1px solid #cbd5e1', borderRadius: '14px', padding: '0 15px', 
            boxSizing: 'border-box', outline: 'none', transition: 'all 0.3s' 
        },
        onFocus: (e) => { e.target.style.borderColor = '#4f46e5'; e.target.style.boxShadow = '0 0 0 4px rgba(79, 70, 229, 0.1)'; },
        onBlur: (e) => { e.target.style.borderColor = '#cbd5e1'; e.target.style.boxShadow = 'none'; }
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
                        {mode === 'login' ? 'Welcome back! Please sign in to continue.' : 'Update your security credentials.'}
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

                {successMsg && (
                    <div style={{ 
                        background: '#f0fdf4', color: '#10b981', padding: '12px 15px', 
                        borderRadius: '12px', fontSize: '0.85rem', fontWeight: '800', 
                        marginBottom: '25px', border: '1px solid #a7f3d0' 
                    }}>
                        ✅ {successMsg}
                    </div>
                )}
                
                {mode === 'login' ? (
                    <form onSubmit={handleLoginSubmit}>
                        <div style={{ marginBottom: '20px', textAlign: 'left' }}>
                            <label style={{ fontSize: '0.8rem', fontWeight: '800', marginBottom: '8px', color: '#64748b', display: 'block', paddingLeft: '4px' }}>
                                Email Address
                            </label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="Enter your email"
                                {...inputProps}
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
                                {...inputProps}
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
                ) : (
                    <form onSubmit={handleChangePasswordSubmit} className="fade-in">
                        <div style={{ marginBottom: '15px', textAlign: 'left' }}>
                            <label style={{ fontSize: '0.8rem', fontWeight: '800', marginBottom: '8px', color: '#64748b', display: 'block', paddingLeft: '4px' }}>Email Address</label>
                            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Enter your email" {...inputProps} style={{...inputProps.style, height: '44px'}} />
                        </div>
                        <div style={{ marginBottom: '15px', textAlign: 'left' }}>
                            <label style={{ fontSize: '0.8rem', fontWeight: '800', marginBottom: '8px', color: '#64748b', display: 'block', paddingLeft: '4px' }}>Current Password</label>
                            <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Current password" {...inputProps} style={{...inputProps.style, height: '44px'}} />
                        </div>
                        <div style={{ marginBottom: '15px', textAlign: 'left' }}>
                            <label style={{ fontSize: '0.8rem', fontWeight: '800', marginBottom: '8px', color: '#64748b', display: 'block', paddingLeft: '4px' }}>New Password</label>
                            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="New password" {...inputProps} style={{...inputProps.style, height: '44px'}} />
                        </div>
                        <div style={{ marginBottom: '25px', textAlign: 'left' }}>
                            <label style={{ fontSize: '0.8rem', fontWeight: '800', marginBottom: '8px', color: '#64748b', display: 'block', paddingLeft: '4px' }}>Confirm New Password</label>
                            <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirm new password" {...inputProps} style={{...inputProps.style, height: '44px'}} />
                        </div>

                        <button 
                            type="submit" 
                            disabled={loading} 
                            style={{ 
                                width: '100%', height: '52px', fontSize: '1rem', fontWeight: '800', 
                                borderRadius: '14px', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', 
                                color: 'white', border: 'none', cursor: loading ? 'not-allowed' : 'pointer', 
                                boxShadow: '0 10px 25px rgba(16, 185, 129, 0.3)', transition: 'all 0.3s',
                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}
                            onMouseOver={(e) => { if(!loading) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 15px 30px rgba(16, 185, 129, 0.4)'; } }}
                            onMouseOut={(e) => { if(!loading) { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 10px 25px rgba(16, 185, 129, 0.3)'; } }}
                        >
                            {loading ? '⏳ Updating...' : 'Update Password'}
                        </button>
                    </form>
                )}

                <div style={{ marginTop: '20px' }}>
                    {mode === 'login' ? (
                        <button 
                            type="button"
                            onClick={() => switchMode('change_password')}
                            style={{ background: 'none', border: 'none', color: '#4f46e5', fontSize: '0.85rem', fontWeight: '800', cursor: 'pointer', textDecoration: 'underline' }}
                        >
                            Need to change your password?
                        </button>
                    ) : (
                        <button 
                            type="button"
                            onClick={() => switchMode('login')}
                            style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '0.85rem', fontWeight: '800', cursor: 'pointer', textDecoration: 'underline' }}
                        >
                            ← Back to Sign In
                        </button>
                    )}
                </div>
                
                <p style={{ marginTop: '20px', fontSize: '0.75rem', color: '#94a3b8', fontWeight: '600' }}>
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