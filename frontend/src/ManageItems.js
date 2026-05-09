// src/ManageItems.js
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import API_BASE_URL from './config';

function ManageItems({ role }) {
  const navigate = useNavigate();
  
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  // Creation State
  const [newName, setNewName] = useState('');
  const [newGroup, setNewGroup] = useState('Normal');
  const [newShiftGroup, setNewShiftGroup] = useState('');
  const [newFromTime, setNewFromTime] = useState('');
  const [newToTime, setNewToTime] = useState('');
  const [newEmpRate, setNewEmpRate] = useState('');
  const [newEmployerRate, setNewEmployerRate] = useState('');

  // Editing State
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editGroup, setEditGroup] = useState('');
  const [editShiftGroup, setEditShiftGroup] = useState('');
  const [editFromTime, setEditFromTime] = useState('');
  const [editToTime, setEditToTime] = useState('');
  const [editEmpRate, setEditEmpRate] = useState('');
  const [editEmployerRate, setEditEmployerRate] = useState('');
  const [savingId, setSavingId] = useState(null);

  // 🔒 Helper to get headers with JWT token
  const getAuthHeaders = useCallback(() => {
    const token = localStorage.getItem('eatsync_token');
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  }, []);

  // 🟢 PRIORITY COMPONENT-LEVEL FETCH
  // This function is stable and triggers instantly when the component mounts
  const fetchItems = useCallback(async (signal) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/all-items`, { 
        signal,
        headers: getAuthHeaders() 
      });
      if (!res.ok) throw new Error("Authentication failed or server error.");
      
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error("Failed to fetch items:", err);
      }
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders]);

  // 🚀 Triggers the exact millisecond the user navigates to this page
  useEffect(() => {
    if (role !== 'admin') return;
    
    const abortController = new AbortController();
    fetchItems(abortController.signal);

    return () => {
      abortController.abort(); // Cancel pending API calls if user navigates away quickly
    };
  }, [role, fetchItems]);

  // ==========================================
  // ⏱️ CHRONOLOGICAL SORTING (SUPPORTS > 24H)
  // ==========================================
  const sortedItems = useMemo(() => {
    const getLogicalMins = (tStr) => {
      if (!tStr) return 0;
      const parts = String(tStr).split(':').map(Number);
      return (parts[0] * 60) + (parts[1] || 0);
    };

    return [...items].sort((a, b) => {
      return getLogicalMins(a.FromTime || a.fromtime) - getLogicalMins(b.FromTime || b.fromtime);
    });
  }, [items]);

  if (role !== 'admin') {
    return (
      <div className="flex-column flex-center h-screen fade-in">
        <h2 style={{fontWeight: '900', color: 'var(--text-main)'}}>🚫 Admin Access Required</h2>
        <button className="btn-primary mt-20" onClick={() => navigate('/')}>Return to Home</button>
      </div>
    );
  }

  // Helper to auto-format text input as HH:MM
  const handleTimeInput = (val, setter) => {
    let formatted = val.replace(/[^\d:]/g, '');
    if (formatted.length === 2 && !formatted.includes(':') && val.length > formatted.length - 1) {
        formatted += ':';
    }
    setter(formatted.substring(0, 5));
  };

  // 🔒 Secured POST route with JWT
  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newName.trim() || !newFromTime || !newToTime) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/items`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ 
          itemName: newName, 
          fromTime: newFromTime, 
          toTime: newToTime, 
          itemGroup: newGroup, 
          shiftGroup: newShiftGroup, 
          empRate: newEmpRate || 0, 
          employeerRate: newEmployerRate || 0 
        })
      });
      const data = await res.json();
      if (res.ok && data.success) { 
        setNewName('');
        setNewGroup('Normal');
        setNewShiftGroup(''); 
        setNewFromTime('');
        setNewToTime('');
        setNewEmpRate('');
        setNewEmployerRate('');
        await fetchItems(); // Instantly refresh table
      } else {
        alert(`Creation failed: ${data.error || 'Server error'}`);
      }
    } catch (err) { 
        alert('Failed to create item. Please check your network connection.'); 
    }
  };

  const startInlineEdit = (item) => {
    setEditingId(item.ItemID || item.itemid);
    setEditName(item.ItemName || item.itemname || '');
    setEditGroup(item.ItemGroup || item.itemgroup || 'Normal');
    setEditShiftGroup(item.ShiftGroup || item.shiftGroup || ''); 
    setEditFromTime(item.FromTime || item.fromtime || '');
    setEditToTime(item.ToTime || item.totime || '');
    setEditEmpRate(item.EmpRate || item.emprate || 0);
    setEditEmployerRate(item.EmployeerRate || item.employeerrate || 0);
  };

  // 🔒 Secured PUT route with JWT
  const saveInlineEdit = async (id) => {
    setSavingId(id);
    try {
        await fetch(`${API_BASE_URL}/api/items/${id}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify({ 
                itemName: editName, 
                itemGroup: editGroup,
                shiftGroup: editShiftGroup, 
                fromTime: editFromTime,
                toTime: editToTime,
                empRate: editEmpRate,
                employeerRate: editEmployerRate
            })
        });
        setEditingId(null);
        await fetchItems(); // Instantly refresh table
    } catch (err) {
        alert('Failed to save changes.');
    } finally {
        setSavingId(null);
    }
  };

  // 🔒 Secured DELETE route with JWT
  const handleDelete = async (id) => {
    if(!window.confirm("Are you sure you want to delete this menu item?")) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/items/${id}`, { 
        method: 'DELETE',
        headers: getAuthHeaders() 
      });
      const data = await res.json();
      if (data.success) { 
        await fetchItems(); // Instantly refresh table
      } else {
        alert(`Delete failed: ${data.error || 'Server error'}`);
      }
    } catch (err) { 
        alert('Failed to delete item.'); 
    }
  };

  // ==========================================
  // ⏱️ FORMATTER (CONVERTS 26:00 TO 2:00 AM)
  // ==========================================
  const formatTime = (timeStr) => {
      if (!timeStr) return '--:--';
      let [h, m] = String(timeStr).split(':').map(Number);
      
      // Calculate display hour using modulo for next-day wrapping
      let displayH = h % 24;
      const ampm = displayH >= 12 ? 'PM' : 'AM';
      
      displayH = displayH % 12 || 12; // Convert 0 to 12 for 12 AM
      
      // Indicate if it crosses into the next day
      const nextDayIndicator = h >= 24 ? ' (Next Day)' : '';

      return `${displayH}:${String(m).padStart(2, '0')} ${ampm}${nextDayIndicator}`;
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
          <h1 className="m-0" style={{ fontSize: '1.6rem', fontWeight: '800', letterSpacing: '-0.5px' }}>Item Master</h1>
        </div>
        <div className="navbar-right">
          <span className="badge" style={{ padding: '8px 20px', fontSize: '0.85rem', background: 'rgba(255,255,255,0.1)', color: 'white', borderRadius: '12px' }}>
            {items.length} Active Items
          </span>
        </div>
      </div>

      <main className="main-scrollable-content fade-in">
        
        {/* ADD ITEM SECTION */}
        <div className="section-header-premium mb-15">
          <h2 style={{ fontSize: '1.4rem', fontWeight: '800', color: 'var(--text-bold)' }}>Add New Item</h2>
          <p className="text-slate" style={{ fontSize: '0.9rem', marginTop: '4px' }}>Create a new meal item, define service windows, and set specific rates.</p>
        </div>

        <form style={{ 
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '20px', alignItems: 'flex-end', 
            background: 'white', padding: '25px 30px', borderRadius: '24px', marginBottom: '40px', 
            border: '1px solid #e2e8f0', boxShadow: '0 10px 30px rgba(0,0,0,0.03)' 
          }} onSubmit={handleAdd}>
          
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: '800', marginBottom: '8px', color: '#64748b', display: 'block' }}>Item Name</label>
            <input 
              className="manager-input" 
              value={newName} 
              onChange={e => setNewName(e.target.value)} 
              placeholder="e.g. Premium Thali" 
              required
              style={{ height: '50px', fontSize: '1rem', fontWeight: '600', border: '1px solid #cbd5e1', borderRadius: '12px' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: '800', marginBottom: '8px', color: '#64748b', display: 'block' }}>Item Group</label>
            <input 
              className="manager-input" 
              value={newGroup} 
              onChange={e => setNewGroup(e.target.value)} 
              placeholder="e.g. Executive" 
              required
              style={{ height: '50px', fontSize: '1rem', fontWeight: '600', border: '1px solid #cbd5e1', borderRadius: '12px' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: '800', marginBottom: '8px', color: '#64748b', display: 'block' }}>Shift Group</label>
            <input 
              className="manager-input" 
              value={newShiftGroup} 
              onChange={e => setNewShiftGroup(e.target.value)} 
              placeholder="e.g. Morning / Night" 
              style={{ height: '50px', fontSize: '1rem', fontWeight: '600', border: '1px solid #cbd5e1', borderRadius: '12px' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: '800', marginBottom: '8px', color: '#64748b', display: 'block' }}>From Time</label>
            <input 
              type="text" 
              className="manager-input" 
              value={newFromTime} 
              onChange={e => handleTimeInput(e.target.value, setNewFromTime)} 
              placeholder="HH:MM (e.g. 26:00)"
              required
              style={{ height: '50px', fontSize: '1rem', fontWeight: '600', border: '1px solid #cbd5e1', borderRadius: '12px' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: '800', marginBottom: '8px', color: '#64748b', display: 'block' }}>To Time</label>
            <input 
              type="text" 
              className="manager-input" 
              value={newToTime} 
              onChange={e => handleTimeInput(e.target.value, setNewToTime)} 
              placeholder="HH:MM (e.g. 27:30)"
              required
              style={{ height: '50px', fontSize: '1rem', fontWeight: '600', border: '1px solid #cbd5e1', borderRadius: '12px' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: '800', marginBottom: '8px', color: '#64748b', display: 'block' }}>Employee Rate (₹)</label>
            <input 
              type="number" 
              step="0.01" 
              className="manager-input" 
              value={newEmpRate} 
              onChange={e => setNewEmpRate(e.target.value)} 
              placeholder="0.00" 
              required
              style={{ height: '50px', fontSize: '1rem', fontWeight: '600', border: '1px solid #cbd5e1', borderRadius: '12px' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: '800', marginBottom: '8px', color: '#64748b', display: 'block' }}>Employeer Rate (₹)</label>
            <input 
              type="number" 
              step="0.01" 
              className="manager-input" 
              value={newEmployerRate} 
              onChange={e => setNewEmployerRate(e.target.value)} 
              placeholder="0.00" 
              required
              style={{ height: '50px', fontSize: '1rem', fontWeight: '600', border: '1px solid #cbd5e1', borderRadius: '12px' }}
            />
          </div>

          <button type="submit" className="btn-primary" style={{ height: '50px', padding: '0 20px', fontSize: '0.9rem', fontWeight: '800', borderRadius: '12px', boxShadow: '0 10px 20px var(--primary-glow)' }}>
            + Add Item
          </button>
        </form>

        {/* ITEM LIST SECTION */}
        <div className="table-section mb-60">
          <div className="flex-between mb-20">
            <h2 className="m-0" style={{ fontSize: '1.4rem', fontWeight: '800', color: 'var(--text-bold)', letterSpacing: '-0.5px' }}>Item List</h2>
          </div>

          <div className="stable-table-container fade-in" style={{ overflowX: 'auto', position: 'relative', borderRadius: '24px', border: '1px solid #e2e8f0', boxShadow: '0 15px 40px rgba(0,0,0,0.04)' }}>
            {loading && (
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(3px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="dots-loader"><div className="dot"></div><div className="dot"></div><div className="dot"></div></div>
                </div>
            )}
            
            <table className="stable-modern-table" style={{ minWidth: '1300px', width: '100%' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                  <th style={{ width: '8%', padding: '20px', color: '#64748b', fontSize: '0.8rem', fontWeight: '900' }}>🏷️ ID</th>
                  <th style={{ width: '14%', padding: '20px', color: '#64748b', fontSize: '0.8rem', fontWeight: '900' }}>🍔 ITEM NAME</th>
                  <th style={{ width: '10%', padding: '20px', color: '#64748b', fontSize: '0.8rem', fontWeight: '900' }}>📁 GROUP</th>
                  <th style={{ width: '10%', padding: '20px', color: '#64748b', fontSize: '0.8rem', fontWeight: '900' }}>🍽️ SHIFT GRP</th>
                  <th style={{ width: '14%', padding: '20px', color: '#64748b', fontSize: '0.8rem', fontWeight: '900' }}>⏱️ WINDOW</th>
                  <th style={{ width: '10%', padding: '20px', color: '#64748b', fontSize: '0.8rem', fontWeight: '900' }}>👤 EMP RATE</th>
                  <th style={{ width: '10%', padding: '20px', color: '#64748b', fontSize: '0.8rem', fontWeight: '900' }}>🏢 CO RATE</th>
                  <th style={{ width: '10%', padding: '20px', color: '#64748b', fontSize: '0.8rem', fontWeight: '900' }}>💰 TOTAL</th>
                  <th style={{ width: '14%', textAlign: 'center', padding: '20px', color: '#64748b', fontSize: '0.8rem', fontWeight: '900' }}>⚙️ ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {sortedItems.map(item => {
                  const id = item.ItemID || item.itemid;
                  const isEditing = editingId === id;
                  
                  const empRate = parseFloat(item.EmpRate || item.emprate || 0);
                  const coRate = parseFloat(item.EmployeerRate || item.employeerrate || 0);
                  const totalRate = empRate + coRate;

                  const editTotalRate = parseFloat(editEmpRate || 0) + parseFloat(editEmployerRate || 0);

                  return (
                  <tr key={id} style={{ borderBottom: '1px solid #f1f5f9', background: isEditing ? '#f0f9ff' : 'white', transition: 'background 0.3s' }}>
                    <td style={{ padding: '20px', verticalAlign: 'top' }}>
                      <span style={{ background: '#f1f5f9', color: '#475569', padding: '6px 12px', borderRadius: '8px', fontSize: '0.85rem', fontWeight: '800' }}>
                        #{id}
                      </span>
                    </td>
                    <td style={{ padding: '20px', verticalAlign: 'top' }}>
                      {isEditing ? (
                          <input className="stable-input" value={editName} onChange={e => setEditName(e.target.value)} style={{ border: '2px solid #0ea5e9', borderRadius: '10px', height: '44px', width: '100%' }} />
                      ) : (
                          <strong style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-bold)', display: 'block', marginTop: '6px' }}>{item.ItemName || item.itemname}</strong>
                      )}
                    </td>
                    <td style={{ padding: '20px', verticalAlign: 'top' }}>
                      {isEditing ? (
                          <input className="stable-input" value={editGroup} onChange={e => setEditGroup(e.target.value)} style={{ border: '2px solid #0ea5e9', borderRadius: '10px', height: '44px', width: '100%' }} />
                      ) : (
                          <span style={{ fontSize: '0.85rem', fontWeight: '700', color: '#475569', display: 'block', marginTop: '6px' }}>
                             {item.ItemGroup || item.itemgroup || 'Normal'}
                          </span>
                      )}
                    </td>
                    
                    <td style={{ padding: '20px', verticalAlign: 'top' }}>
                      {isEditing ? (
                          <input className="stable-input" value={editShiftGroup} onChange={e => setEditShiftGroup(e.target.value)} style={{ border: '2px solid #0ea5e9', borderRadius: '10px', height: '44px', width: '100%' }} />
                      ) : (
                          <span style={{ fontSize: '0.85rem', fontWeight: '700', color: '#6366f1', display: 'block', marginTop: '6px' }}>
                             {item.ShiftGroup || item.shiftGroup || '---'}
                          </span>
                      )}
                    </td>

                    <td style={{ padding: '20px', verticalAlign: 'top' }}>
                      {isEditing ? (
                          <div style={{ display: 'flex', gap: '5px', flexDirection: 'column' }}>
                              <input type="text" className="stable-input" style={{ padding: '0 10px', border: '2px solid #0ea5e9', borderRadius: '10px', height: '44px' }} value={editFromTime} onChange={e => handleTimeInput(e.target.value, setEditFromTime)} placeholder="HH:MM" />
                              <input type="text" className="stable-input" style={{ padding: '0 10px', border: '2px solid #0ea5e9', borderRadius: '10px', height: '44px' }} value={editToTime} onChange={e => handleTimeInput(e.target.value, setEditToTime)} placeholder="HH:MM" />
                          </div>
                      ) : (
                          <span style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-main)', display: 'block', marginTop: '6px', whiteSpace: 'nowrap' }}>
                            {formatTime(item.FromTime || item.fromtime)} <br/> {formatTime(item.ToTime || item.totime)}
                          </span>
                      )}
                    </td>
                    <td style={{ padding: '20px', verticalAlign: 'top' }}>
                      {isEditing ? (
                          <input type="number" step="0.01" className="stable-input" value={editEmpRate} onChange={e => setEditEmpRate(e.target.value)} style={{ border: '2px solid #0ea5e9', borderRadius: '10px', height: '44px', width: '100%' }} />
                      ) : (
                          <span style={{ fontSize: '0.9rem', fontWeight: '800', color: '#0ea5e9', display: 'block', marginTop: '6px' }}>
                             ₹{empRate.toFixed(2)}
                          </span>
                      )}
                    </td>
                    <td style={{ padding: '20px', verticalAlign: 'top' }}>
                      {isEditing ? (
                          <input type="number" step="0.01" className="stable-input" value={editEmployerRate} onChange={e => setEditEmployerRate(e.target.value)} style={{ border: '2px solid #0ea5e9', borderRadius: '10px', height: '44px', width: '100%' }} />
                      ) : (
                          <span style={{ fontSize: '0.9rem', fontWeight: '800', color: '#8b5cf6', display: 'block', marginTop: '6px' }}>
                             ₹{coRate.toFixed(2)}
                          </span>
                      )}
                    </td>
                    <td style={{ padding: '20px', verticalAlign: 'top' }}>
                      {isEditing ? (
                          <span style={{ fontSize: '0.9rem', fontWeight: '950', color: '#10b981', display: 'block', marginTop: '16px' }}>
                             ₹{editTotalRate.toFixed(2)}
                          </span>
                      ) : (
                          <span style={{ fontSize: '0.9rem', fontWeight: '950', color: '#10b981', display: 'block', marginTop: '6px' }}>
                             ₹{totalRate.toFixed(2)}
                          </span>
                      )}
                    </td>
                    <td style={{ padding: '20px', textAlign: 'center', verticalAlign: 'top' }}>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginTop: '2px' }}>
                        {isEditing ? (
                            <>
                                <button 
                                  title="Save Changes"
                                  onClick={() => saveInlineEdit(id)} 
                                  disabled={savingId === id}
                                  style={{ ...iconBtnStyle, background: '#10b981', color: 'white', opacity: savingId === id ? 0.6 : 1 }}
                                >
                                  {savingId === id ? '⏳' : '💾'}
                                </button>
                                <button 
                                  title="Cancel"
                                  onClick={() => setEditingId(null)} 
                                  disabled={savingId === id}
                                  style={{ ...iconBtnStyle, background: 'white', color: '#64748b', border: '1px solid #e2e8f0' }}
                                >
                                  ❌
                                </button>
                            </>
                        ) : (
                            <>
                                <button 
                                  title="Edit Item"
                                  onClick={() => startInlineEdit(item)}
                                  style={{ ...iconBtnStyle, background: '#f0f9ff', color: '#0ea5e9' }}
                                  onMouseOver={(e) => { e.currentTarget.style.background = '#0ea5e9'; e.currentTarget.style.color = 'white'; e.currentTarget.style.transform = 'translateY(-2px)' }}
                                  onMouseOut={(e) => { e.currentTarget.style.background = '#f0f9ff'; e.currentTarget.style.color = '#0ea5e9'; e.currentTarget.style.transform = 'translateY(0)' }}
                                >
                                  ✏️
                                </button>
                                <button 
                                  title="Delete Item"
                                  onClick={() => handleDelete(id)}
                                  style={{ ...iconBtnStyle, background: '#fff1f2', color: '#e11d48' }}
                                  onMouseOver={(e) => { e.currentTarget.style.background = '#e11d48'; e.currentTarget.style.color = 'white'; e.currentTarget.style.transform = 'translateY(-2px)' }}
                                  onMouseOut={(e) => { e.currentTarget.style.background = '#fff1f2'; e.currentTarget.style.color = '#e11d48'; e.currentTarget.style.transform = 'translateY(0)' }}
                                >
                                  🗑️
                                </button>
                            </>
                        )}
                      </div>
                    </td>
                  </tr>
                )})}
                {sortedItems.length === 0 && !loading && (
                  <tr>
                    <td colSpan="9" style={{ textAlign: 'center', padding: '60px 20px', color: '#94a3b8' }}>
                      <div style={{ fontSize: '3rem', marginBottom: '15px' }}>📋</div>
                      <p style={{ margin: 0, fontSize: '1rem', fontWeight: '800' }}>No items found.</p>
                      <p style={{ margin: '5px 0 0 0', fontSize: '0.85rem' }}>Add a new item using the form above.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}

export default ManageItems;