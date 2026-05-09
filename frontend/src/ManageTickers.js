// src/ManageTickers.js
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import API_BASE_URL from './config';

function ManageTickers({ role }) {
  const navigate = useNavigate();

  // State Initialization
  const [tickers, setTickers] = useState([]);
  const [newTicker, setNewTicker] = useState('');
  const [overtimeLimit, setOvertimeLimit] = useState(30); 
  const [tickerSpeed, setTickerSpeed] = useState(60); 
  const [tickerColor, setTickerColor] = useState('#38bdf8');
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // 🔒 Helper to get headers with JWT token (Stable)
  const getAuthHeaders = useCallback(() => {
    const token = localStorage.getItem('eatsync_token');
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  }, []);

  // 🟢 PRIORITY COMPONENT-LEVEL FETCH (Stable)
  const fetchGlobalSettings = useCallback(async (signal) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/ticker-settings`, { 
          signal,
          headers: getAuthHeaders() 
      });
      
      if (!res.ok) throw new Error("Failed to fetch settings");
      
      const data = await res.json();
      if (!data.error) {
        setTickers(Array.isArray(data.tickers) ? data.tickers : []);
        setOvertimeLimit(data.overtimeLimit || 30);
        setTickerSpeed(data.tickerSpeed || 60);
        setTickerColor(data.tickerColor || '#38bdf8');
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error("Settings load failed:", err);
      }
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders]);

  // 🚀 Triggers the exact millisecond the user navigates to this page
  useEffect(() => {
    if (role !== 'admin') return;

    const abortController = new AbortController();
    fetchGlobalSettings(abortController.signal);

    return () => {
      abortController.abort(); // Cancel pending API calls if user navigates away quickly
    };
  }, [role, fetchGlobalSettings]);

  if (role !== 'admin') {
    return (
      <div className="flex-column flex-center h-screen fade-in">
        <h2 style={{fontWeight: '900', color: 'var(--text-main)'}}>🚫 Admin Access Required</h2>
        <button className="btn-primary mt-20" onClick={() => navigate('/')}>Return to Home</button>
      </div>
    );
  }

  // 🔒 Secured Save Route
  const handleSaveSettings = async (updatedTickers = tickers) => {
    setSaving(true);
    try {
      const payload = {
        tickers: updatedTickers,
        overtimeLimit: parseInt(overtimeLimit) || 30,
        tickerSpeed: parseInt(tickerSpeed) || 60,
        tickerColor: tickerColor
      };

      const res = await fetch(`${API_BASE_URL}/api/ticker-settings`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        // Flash success visually if needed, data is already synced locally
      } else {
        alert("Failed to save settings to server.");
      }
    } catch (err) {
      alert("Network Error while saving settings.");
    } finally {
      setSaving(false);
    }
  };

  const handleAddTicker = (e) => {
    e.preventDefault();
    if (!newTicker.trim()) return;
    
    const updated = [...tickers, newTicker.trim()];
    setTickers(updated);
    setNewTicker('');
    handleSaveSettings(updated);
  };

  const handleDeleteTicker = (index) => {
    if(!window.confirm("Remove this slogan from the broadcast?")) return;
    const updated = tickers.filter((_, i) => i !== index);
    setTickers(updated);
    handleSaveSettings(updated);
  };

  const iconBtnStyle = {
    width: '42px', height: '42px', borderRadius: '12px', display: 'flex', alignItems: 'center', 
    justifyContent: 'center', fontSize: '1.1rem', cursor: 'pointer', border: 'none', 
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', boxShadow: '0 4px 10px rgba(0,0,0,0.06)'
  };

  return (
    <div className="main-pane-100">
      <div className="top-navbar premium-alt">
        <div className="navbar-left">
          <div className="global-breadcrumb dark-mode" onClick={() => navigate('/')}>
            <span className="home-icon">🏠</span>
            <span className="breadcrumb-text">Home</span>
          </div>
        </div>
        <div className="navbar-center">
          <h1 className="m-0" style={{ fontSize: '1.6rem', fontWeight: '800', letterSpacing: '-0.5px' }}>Ticker & Global Alerts</h1>
        </div>
        <div className="navbar-right">
          <span className="badge" style={{ padding: '8px 20px', fontSize: '0.85rem', background: 'rgba(255,255,255,0.1)', color: 'white', borderRadius: '12px' }}>
            {saving ? '⏳ Saving...' : '🟢 System Synced'}
          </span>
        </div>
      </div>

      <main className="main-scrollable-content fade-in">
        
        {loading ? (
           <div style={{ display: 'flex', justifyContent: 'center', padding: '100px' }}>
               <div className="dots-loader"><div className="dot"></div><div className="dot"></div><div className="dot"></div></div>
           </div>
        ) : (
          <>
            {/* GLOBAL SETTINGS SECTION */}
            <div className="section-header-premium mb-15">
              <h2 style={{ fontSize: '1.4rem', fontWeight: '800', color: 'var(--text-bold)' }}>Global Dashboard Settings</h2>
              <p className="text-slate" style={{ fontSize: '0.9rem', marginTop: '4px' }}>Configure overtime alerts and modify the visual behavior of the broadcast ticker.</p>
            </div>

            <div style={{ 
                display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', alignItems: 'flex-end', 
                background: 'white', padding: '25px 30px', borderRadius: '24px', marginBottom: '40px', 
                border: '1px solid #e2e8f0', boxShadow: '0 10px 30px rgba(0,0,0,0.03)' 
              }}>
              
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: '800', marginBottom: '8px', color: '#e11d48', display: 'block' }}>Extended Stay Limit (Minutes)</label>
                <input 
                  type="number" 
                  className="manager-input" 
                  value={overtimeLimit} 
                  onChange={e => setOvertimeLimit(e.target.value)} 
                  style={{ height: '50px', fontSize: '1.1rem', fontWeight: '800', border: '2px solid #fecdd3', borderRadius: '12px', background: '#fff1f2', color: '#be123c' }} 
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: '800', marginBottom: '8px', color: '#64748b', display: 'block' }}>Ticker Speed (Seconds)</label>
                <input 
                  type="number" 
                  className="manager-input" 
                  value={tickerSpeed} 
                  onChange={e => setTickerSpeed(e.target.value)} 
                  style={{ height: '50px', fontSize: '1rem', fontWeight: '600', border: '1px solid #cbd5e1', borderRadius: '12px' }} 
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: '800', marginBottom: '8px', color: '#64748b', display: 'block' }}>Ticker Hex Color</label>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <input 
                      type="color" 
                      value={tickerColor} 
                      onChange={e => setTickerColor(e.target.value)} 
                      style={{ height: '50px', width: '60px', padding: '2px', border: '1px solid #cbd5e1', borderRadius: '12px', cursor: 'pointer' }} 
                    />
                    <input 
                      type="text" 
                      className="manager-input" 
                      value={tickerColor} 
                      onChange={e => setTickerColor(e.target.value)} 
                      style={{ height: '50px', flex: 1, fontSize: '1rem', fontWeight: '700', border: '1px solid #cbd5e1', borderRadius: '12px', textTransform: 'uppercase' }} 
                    />
                </div>
              </div>

              <button 
                onClick={() => handleSaveSettings(tickers)} 
                className="btn-primary" 
                style={{ height: '50px', padding: '0 30px', fontSize: '0.9rem', fontWeight: '800', borderRadius: '12px', boxShadow: '0 10px 20px var(--primary-glow)' }}
                disabled={saving}
              >
                {saving ? 'Saving...' : '💾 Save System Settings'}
              </button>
            </div>

            {/* ADD SLOGAN SECTION */}
            <div className="section-header-premium mb-15">
              <h2 style={{ fontSize: '1.4rem', fontWeight: '800', color: 'var(--text-bold)' }}>Broadcast Slogans</h2>
              <p className="text-slate" style={{ fontSize: '0.9rem', marginTop: '4px' }}>Manage the rolling text that appears at the top of the Home Dashboard.</p>
            </div>

            <form style={{ 
                display: 'flex', gap: '20px', alignItems: 'flex-end', background: 'white', padding: '25px 30px', 
                borderRadius: '24px', marginBottom: '40px', border: '1px solid #e2e8f0', boxShadow: '0 10px 30px rgba(0,0,0,0.03)' 
              }} onSubmit={handleAddTicker}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '0.8rem', fontWeight: '800', marginBottom: '8px', color: '#64748b', display: 'block' }}>New Slogan</label>
                <input 
                  className="manager-input" 
                  value={newTicker} 
                  onChange={e => setNewTicker(e.target.value)} 
                  placeholder="e.g. 📢 Hygiene is our priority!" 
                  required
                  style={{ height: '50px', fontSize: '1rem', fontWeight: '600', border: '1px solid #cbd5e1', borderRadius: '12px' }}
                />
              </div>
              <button type="submit" className="btn-primary" style={{ height: '50px', padding: '0 30px', fontSize: '0.9rem', fontWeight: '800', borderRadius: '12px', background: '#10b981', boxShadow: '0 10px 20px rgba(16,185,129,0.2)' }}>
                + Add Slogan
              </button>
            </form>

            {/* SLOGAN LIST SECTION */}
            <div className="table-section mb-60">
              <div className="stable-table-container fade-in" style={{ overflowX: 'auto', position: 'relative', borderRadius: '24px', border: '1px solid #e2e8f0', boxShadow: '0 15px 40px rgba(0,0,0,0.04)' }}>
                <table className="stable-modern-table" style={{ width: '100%' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                      <th style={{ width: '10%', padding: '20px', color: '#64748b', fontSize: '0.8rem', fontWeight: '900' }}>#</th>
                      <th style={{ width: '75%', padding: '20px', color: '#64748b', fontSize: '0.8rem', fontWeight: '900' }}>📢 BROADCAST MESSAGE</th>
                      <th style={{ width: '15%', textAlign: 'center', padding: '20px', color: '#64748b', fontSize: '0.8rem', fontWeight: '900' }}>⚙️ ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tickers.map((text, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9', background: 'white', transition: 'background 0.3s' }}>
                        <td style={{ padding: '20px', verticalAlign: 'middle' }}>
                          <span style={{ background: '#f1f5f9', color: '#475569', padding: '6px 12px', borderRadius: '8px', fontSize: '0.85rem', fontWeight: '800' }}>
                            {idx + 1}
                          </span>
                        </td>
                        <td style={{ padding: '20px', verticalAlign: 'middle' }}>
                          <strong style={{ fontSize: '1.05rem', fontWeight: '700', color: 'var(--text-bold)', display: 'block' }}>{text}</strong>
                        </td>
                        <td style={{ padding: '20px', textAlign: 'center', verticalAlign: 'middle' }}>
                          <div style={{ display: 'flex', justifyContent: 'center' }}>
                            <button 
                              title="Delete Slogan"
                              onClick={() => handleDeleteTicker(idx)}
                              style={{ ...iconBtnStyle, background: '#fff1f2', color: '#e11d48' }}
                              onMouseOver={(e) => { e.currentTarget.style.background = '#e11d48'; e.currentTarget.style.color = 'white'; e.currentTarget.style.transform = 'translateY(-2px)' }}
                              onMouseOut={(e) => { e.currentTarget.style.background = '#fff1f2'; e.currentTarget.style.color = '#e11d48'; e.currentTarget.style.transform = 'translateY(0)' }}
                            >
                              🗑️
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {tickers.length === 0 && (
                       <tr>
                         <td colSpan="3">
                            <div style={{ padding: '80px', textAlign: 'center', color: '#64748b' }}>
                               <div style={{ fontSize: '4rem', marginBottom: '15px' }}>📢</div>
                               <h3 style={{ fontSize: '1.4rem', color: 'var(--text-bold)', margin: '0 0 10px 0', fontWeight: '800' }}>No Slogans Found</h3>
                               <p style={{ margin: 0, fontSize: '1rem' }}>Add some slogans using the input above to broadcast them on the live ticker.</p>
                            </div>
                         </td>
                       </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </>
        )}
      </main>
    </div>
  );
}

export default ManageTickers;