// src/ManageUser.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import API_BASE_URL from './config';

// ==========================================
// 🏢 CANTEEN MULTI-SELECT DROPDOWN
// ==========================================
const CanteenMultiSelect = ({ options, selectedValues, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleOption = (canteenId) => {
    const strId = String(canteenId);
    const updated = selectedValues.includes(strId)
      ? selectedValues.filter(v => v !== strId)
      : [...selectedValues, strId];
    onChange(updated);
  };

  return (
    <div className="custom-select-wrapper" ref={containerRef} style={{ width: '100%', position: 'relative' }}>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        style={{
          minHeight: '44px', height: 'auto', padding: '8px 15px', background: 'white',
          border: isOpen ? '2px solid var(--primary)' : '1px solid #cbd5e1', borderRadius: '12px', 
          display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center', cursor: 'pointer', 
          transition: 'all 0.3s ease',
          boxShadow: isOpen ? '0 4px 15px var(--primary-glow)' : 'inset 0 2px 4px rgba(0,0,0,0.02)',
          width: '100%', boxSizing: 'border-box'
        }}
      >
        {selectedValues.length === 0 ? (
          <span style={{ color: '#94a3b8', fontSize: '0.85rem', fontWeight: '600' }}>Select Canteens...</span>
        ) : (
          <span style={{ fontSize: '0.8rem', fontWeight: '800', color: 'var(--primary)', letterSpacing: '0.5px' }}>
            🏢 {selectedValues.length} Assigned
          </span>
        )}
        <span style={{ marginLeft: 'auto', fontSize: '0.7rem', color: '#94a3b8', transition: 'transform 0.3s', transform: isOpen ? 'rotate(180deg)' : 'none' }}>▼</span>
      </div>

      {isOpen && (
        <div className="fade-in" style={{ 
            position: 'absolute', top: 'calc(100% + 8px)', left: 0, 
            width: '100%',
            background: 'white', borderRadius: '16px', boxShadow: '0 20px 40px rgba(0,0,0,0.2)', 
            border: '1px solid #e2e8f0', zIndex: 9999, 
            maxHeight: '220px',
            overflowY: 'auto',
            padding: '0', boxSizing: 'border-box'
        }}>
          <div style={{ position: 'sticky', top: 0, background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(10px)', display: 'flex', justifyContent: 'space-between', padding: '12px 15px', borderBottom: '1px solid #f1f5f9', zIndex: 2 }}>
            <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#64748b' }}>{options.length} Canteens</span>
            <span onClick={(e) => { e.stopPropagation(); onChange([]); }} style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--danger)', cursor: 'pointer' }}>Clear All</span>
          </div>
          <div style={{ padding: '8px' }}>
            {options.map(opt => {
              const optId = opt.CanteenID || opt.canteenid || opt.id;
              const optName = opt.CanteenName || opt.canteenname || opt.name;
              const isSelected = selectedValues.includes(String(optId));

              return (
                <div key={optId} onClick={(e) => { e.stopPropagation(); toggleOption(optId); }} style={{
                    padding: '10px', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', transition: 'all 0.2s', background: isSelected ? '#f0fdf4' : 'transparent', marginBottom: '2px'
                }}>
                  <div style={{ width: '18px', height: '18px', border: isSelected ? '2px solid #10b981' : '2px solid #cbd5e1', borderRadius: '5px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: isSelected ? '#10b981' : 'transparent', flexShrink: 0 }}>
                    {isSelected && <span style={{ color: 'white', fontSize: '0.7rem', fontWeight: '900' }}>✓</span>}
                  </div>
                  <span style={{ fontSize: '0.85rem', fontWeight: isSelected ? '800' : '600', color: isSelected ? '#065f46' : 'var(--text-main)' }}>{optName}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

function ManageUser({ role }) {
  const navigate = useNavigate();
  
  const [users, setUsers] = useState([]);
  const [canteens, setCanteens] = useState([]);
  const [loading, setLoading] = useState(true);

  // Creation State
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState('user');
  const [newCanteens, setNewCanteens] = useState([]);

  // Editing State
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState('user');
  const [editCanteens, setEditCanteens] = useState([]);
  const [savingId, setSavingId] = useState(null);

  // 🔒 Helper to get headers with JWT token (Stable)
  const getAuthHeaders = useCallback(() => {
    const token = localStorage.getItem('eatsync_token');
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  }, []);

  // 🟢 PRIORITY COMPONENT-LEVEL FETCH (Stable)
  const fetchCoreData = useCallback(async (signal) => {
    setLoading(true);
    try {
      const authHeaders = getAuthHeaders();
      const [usersRes, canteensRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/users`, { signal, headers: authHeaders }),
        fetch(`${API_BASE_URL}/api/canteens-list`, { signal, headers: authHeaders })
      ]);
      const usersData = await usersRes.json();
      const canteensData = await canteensRes.json();
      
      setUsers(Array.isArray(usersData) ? usersData : []);
      setCanteens(Array.isArray(canteensData) ? canteensData : []);
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error("Failed to load data:", err);
      }
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders]);

  // 🚀 Triggers the exact millisecond the user navigates to this page
  useEffect(() => {
    const abortController = new AbortController();
    if (role === 'admin') {
        fetchCoreData(abortController.signal);
    }

    return () => {
      abortController.abort(); // Cancel pending API calls on unmount
    };
  }, [role, fetchCoreData]);

  if (role !== 'admin') {
    return (
      <div className="flex-column flex-center h-screen fade-in">
        <h2 style={{fontWeight: '900', color: 'var(--text-main)'}}>🚫 Admin Access Required</h2>
        <button className="btn-primary mt-20" onClick={() => navigate('/')}>Return to Home</button>
      </div>
    );
  }

  // 🔒 Secured POST route with JWT
  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newName.trim() || !newEmail.trim()) return;

    try {
      // 1. Create the user
      const res = await fetch(`${API_BASE_URL}/api/users`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ name: newName, email: newEmail })
      });
      const data = await res.json();
      
      if (data.success) {
        // 2. Find the newly created user to assign Password, Role, and Canteens
        const newUser = data.users.find(u => u.email === newEmail);
        if (newUser) {
            await fetch(`${API_BASE_URL}/api/users/${newUser.id}`, {
                method: 'PUT',
                headers: getAuthHeaders(),
                body: JSON.stringify({ 
                    name: newName, 
                    email: newEmail, 
                    role: newRole,
                    password: 'Test@123', // Enforce Default Password
                    canteenIds: newCanteens // Sends array to backend
                })
            });
        }
        
        setNewName('');
        setNewEmail('');
        setNewRole('user');
        setNewCanteens([]);
        await fetchCoreData(); // Silent background refresh
        alert('User created successfully!\nDefault Password: Test@123');
      }
    } catch (err) {
      alert('Failed to create user');
    }
  };

  const startInlineEdit = (user) => {
    setEditingId(user.id);
    setEditName(user.name);
    setEditEmail(user.email);
    setEditRole((user.role || 'user').toLowerCase());
    setEditCanteens(user.assignedCanteens || []);
  };

  // 🔒 Secured PUT route with JWT
  const saveInlineEdit = async (id) => {
    setSavingId(id);
    try {
      await fetch(`${API_BASE_URL}/api/users/${id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ 
          name: editName, 
          email: editEmail, 
          role: editRole,
          canteenIds: editCanteens // Sends array to backend to map Multiple Canteens
        })
      });
      setEditingId(null);
      await fetchCoreData(); // Silent background refresh
    } catch (err) {
      alert('Failed to save changes.');
    } finally {
      setSavingId(null);
    }
  };

  // 🔒 FIX: Updated Reset Password to use exact Username via new API Route
  const handleResetPassword = async (id, name) => {
    if (!window.confirm(`Are you sure you want to reset the password for ${name}?\n\nTheir new password will be exactly their username: "${name}"`)) return;
    
    try {
      const res = await fetch(`${API_BASE_URL}/api/users/${id}/reset-password`, {
        method: 'PUT',
        headers: getAuthHeaders()
      });
      
      const data = await res.json();
      
      if (res.ok && data.success) {
        alert(`✅ Success!\n\nPassword for ${name} has been reset.\nNew Password: ${data.newPasswordText}`);
        await fetchCoreData();
      } else {
        alert(`❌ Failed to reset password: ${data.message || 'Unknown error'}`);
      }
    } catch (err) {
      console.error("Error resetting password:", err);
      alert("Network error while trying to reset password.");
    }
  };

  // 🔒 Secured DELETE route with JWT
  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;
    try {
      await fetch(`${API_BASE_URL}/api/users/${id}`, { 
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      await fetchCoreData();
    } catch (err) {
      alert('Delete failed');
    }
  };

  // Button Styling
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
          <h1 className="m-0" style={{ fontSize: '1.6rem', fontWeight: '800', letterSpacing: '-0.5px' }}>User Master</h1>
        </div>
        <div className="navbar-right">
          <span className="badge" style={{ padding: '8px 20px', fontSize: '0.85rem', background: 'rgba(255,255,255,0.1)', color: 'white', borderRadius: '12px' }}>
            {users.length} Active Users
          </span>
        </div>
      </div>

      <main className="main-scrollable-content fade-in">
        
        {/* ADD USER SECTION */}
        <div className="section-header-premium mb-15">
          <h2 style={{ fontSize: '1.4rem', fontWeight: '800', color: 'var(--text-bold)' }}>Add New User</h2>
          <p className="text-slate" style={{ fontSize: '0.9rem', marginTop: '4px' }}>Create a new user, assign their role, and link them to canteens.</p>
        </div>

        <form style={{ 
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', alignItems: 'flex-end', 
            background: 'white', padding: '25px 30px', borderRadius: '24px', marginBottom: '40px', 
            border: '1px solid #e2e8f0', boxShadow: '0 10px 30px rgba(0,0,0,0.03)' 
          }} onSubmit={handleAdd}>
          
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: '800', marginBottom: '8px', color: '#64748b', display: 'block' }}>Full Name</label>
            <input 
              className="manager-input" 
              value={newName} 
              onChange={e => setNewName(e.target.value)} 
              placeholder="e.g. John Doe" 
              required
              style={{ height: '50px', fontSize: '1rem', fontWeight: '600', border: '1px solid #cbd5e1', borderRadius: '12px' }}
            />
          </div>
          
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: '800', marginBottom: '8px', color: '#64748b', display: 'block' }}>Email Address</label>
            <input 
              type="email"
              className="manager-input" 
              value={newEmail} 
              onChange={e => setNewEmail(e.target.value)} 
              placeholder="e.g. user@company.com" 
              required
              style={{ height: '50px', fontSize: '1rem', fontWeight: '600', border: '1px solid #cbd5e1', borderRadius: '12px' }}
            />
          </div>

          <div>
             <label style={{ fontSize: '0.8rem', fontWeight: '800', marginBottom: '8px', color: '#64748b', display: 'block' }}>Role</label>
             <select 
               className="manager-input"
               value={newRole}
               onChange={e => setNewRole(e.target.value)}
               style={{ height: '50px', fontSize: '1rem', fontWeight: '600', border: '1px solid #cbd5e1', borderRadius: '12px', background: 'white' }}
             >
               <option value="user">User</option>
               <option value="admin">Admin</option>
             </select>
          </div>

          <div>
             <label style={{ fontSize: '0.8rem', fontWeight: '800', marginBottom: '8px', color: '#64748b', display: 'block' }}>Assign Canteens</label>
             <CanteenMultiSelect 
                options={canteens} 
                selectedValues={newCanteens} 
                onChange={setNewCanteens} 
             />
          </div>

          <button type="submit" className="btn-primary" style={{ height: '50px', padding: '0 30px', fontSize: '0.9rem', fontWeight: '800', borderRadius: '12px', boxShadow: '0 10px 20px var(--primary-glow)' }}>
            + Add User
          </button>
        </form>

        {/* USER LIST SECTION */}
        <div className="table-section mb-60">
          <div className="flex-between mb-20">
            <h2 className="m-0" style={{ fontSize: '1.4rem', fontWeight: '800', color: 'var(--text-bold)', letterSpacing: '-0.5px' }}>User List</h2>
          </div>

          <div className="stable-table-container fade-in" style={{ overflowX: 'auto', overflowY: 'visible', position: 'relative', borderRadius: '24px', border: '1px solid #e2e8f0', boxShadow: '0 15px 40px rgba(0,0,0,0.04)', paddingBottom: '200px' }}>
            {loading && (
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(3px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="dots-loader"><div className="dot"></div><div className="dot"></div><div className="dot"></div></div>
                </div>
            )}
            
            <table className="stable-modern-table" style={{ minWidth: '1100px', width: '100%' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                  <th style={{ width: '8%', padding: '20px', color: '#64748b', fontSize: '0.8rem', fontWeight: '900' }}>ID</th>
                  <th style={{ width: '20%', padding: '20px', color: '#64748b', fontSize: '0.8rem', fontWeight: '900' }}>NAME</th>
                  <th style={{ width: '20%', padding: '20px', color: '#64748b', fontSize: '0.8rem', fontWeight: '900' }}>EMAIL</th>
                  <th style={{ width: '12%', padding: '20px', color: '#64748b', fontSize: '0.8rem', fontWeight: '900' }}>ROLE</th>
                  <th style={{ width: '22%', padding: '20px', color: '#64748b', fontSize: '0.8rem', fontWeight: '900' }}>ASSIGNED CANTEENS</th>
                  <th style={{ width: '18%', textAlign: 'center', padding: '20px', color: '#64748b', fontSize: '0.8rem', fontWeight: '900' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  const isEditing = editingId === user.id;
                  const assignedCanteens = editCanteens.length > 0 && isEditing ? editCanteens : (user.assignedCanteens || []);

                  return (
                  <tr key={user.id} style={{ borderBottom: '1px solid #f1f5f9', background: isEditing ? '#f0f9ff' : 'white', transition: 'background 0.3s' }}>
                    <td style={{ padding: '20px', verticalAlign: 'top' }}>
                      <span style={{ background: '#f1f5f9', color: '#475569', padding: '6px 12px', borderRadius: '8px', fontSize: '0.85rem', fontWeight: '800' }}>
                        #{user.id}
                      </span>
                    </td>
                    <td style={{ padding: '20px', verticalAlign: 'top' }}>
                      {isEditing ? (
                          <input className="stable-input" value={editName} onChange={e => setEditName(e.target.value)} style={{ border: '2px solid #0ea5e9', borderRadius: '10px', height: '44px', width: '100%' }} />
                      ) : (
                          <strong style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-bold)', display: 'block', marginTop: '6px' }}>{user.name}</strong>
                      )}
                    </td>
                    <td style={{ padding: '20px', verticalAlign: 'top' }}>
                        {isEditing ? (
                            <input className="stable-input" type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)} style={{ border: '2px solid #0ea5e9', borderRadius: '10px', height: '44px', width: '100%' }} />
                        ) : (
                            <span style={{ fontSize: '1rem', fontWeight: '600', color: '#475569', display: 'block', marginTop: '6px' }}>
                               {user.email}
                            </span>
                        )}
                    </td>
                    <td style={{ padding: '20px', verticalAlign: 'top' }}>
                        {isEditing ? (
                            <select 
                                className="stable-input" 
                                value={editRole} 
                                onChange={e => setEditRole(e.target.value)} 
                                style={{ border: '2px solid #0ea5e9', borderRadius: '10px', height: '44px', width: '100%', background: 'white' }}
                            >
                                <option value="user">User</option>
                                <option value="admin">Admin</option>
                            </select>
                        ) : (
                            <span style={{ 
                                display: 'inline-block', marginTop: '6px', fontSize: '0.75rem', padding: '6px 12px', 
                                background: user.role === 'admin' ? '#f0f9ff' : '#f8fafc', 
                                color: user.role === 'admin' ? '#0ea5e9' : '#64748b', 
                                borderRadius: '8px', fontWeight: '800', border: `1px solid ${user.role === 'admin' ? '#bae6fd' : '#e2e8f0'}` 
                            }}>
                                {String(user.role || 'user').toUpperCase()}
                            </span>
                        )}
                    </td>
                    <td style={{ padding: '20px', verticalAlign: 'top' }}>
                        {isEditing ? (
                            <CanteenMultiSelect 
                                options={canteens} 
                                selectedValues={editCanteens} 
                                onChange={setEditCanteens} 
                            />
                        ) : (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '6px' }}>
                                {assignedCanteens.length === 0 ? <span style={{color: '#94a3b8', fontSize: '0.85rem', fontWeight: '600'}}>None</span> : 
                                 assignedCanteens.slice(0, 3).map(id => {
                                    const c = canteens.find(can => String(can.CanteenID || can.canteenid || can.id) === String(id));
                                    return (
                                        <span key={id} style={{ fontSize: '0.75rem', padding: '6px 12px', background: '#f8fafc', color: '#475569', borderRadius: '8px', fontWeight: '700', border: '1px solid #e2e8f0' }}>
                                            {c ? c.CanteenName || c.canteenname || c.name : `Canteen #${id}`}
                                        </span>
                                    )
                                 })}
                                 {assignedCanteens.length > 3 && <span style={{fontSize: '0.75rem', fontWeight: '800', color: 'var(--primary)', alignSelf: 'center', marginLeft: '5px'}}>+{assignedCanteens.length - 3}</span>}
                            </div>
                        )}
                    </td>
                    <td style={{ padding: '20px', textAlign: 'center', verticalAlign: 'top' }}>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginTop: '2px' }}>
                        {isEditing ? (
                            <>
                                <button 
                                  title="Save Changes"
                                  onClick={() => saveInlineEdit(user.id)} 
                                  disabled={savingId === user.id}
                                  style={{ ...iconBtnStyle, background: '#10b981', color: 'white', opacity: savingId === user.id ? 0.6 : 1 }}
                                >
                                  {savingId === user.id ? '⏳' : '💾'}
                                </button>
                                <button 
                                  title="Cancel"
                                  onClick={() => setEditingId(null)} 
                                  disabled={savingId === user.id}
                                  style={{ ...iconBtnStyle, background: 'white', color: '#64748b', border: '1px solid #e2e8f0' }}
                                >
                                  ❌
                                </button>
                            </>
                        ) : (
                            <>
                                <button 
                                  title="Edit User"
                                  onClick={() => startInlineEdit(user)}
                                  style={{ ...iconBtnStyle, background: '#f0f9ff', color: '#0ea5e9' }}
                                  onMouseOver={(e) => { e.currentTarget.style.background = '#0ea5e9'; e.currentTarget.style.color = 'white'; e.currentTarget.style.transform = 'translateY(-2px)' }}
                                  onMouseOut={(e) => { e.currentTarget.style.background = '#f0f9ff'; e.currentTarget.style.color = '#0ea5e9'; e.currentTarget.style.transform = 'translateY(0)' }}
                                >
                                  ✏️
                                </button>
                                
                                {/* 🔑 Reset to Username Button */}
                                <button 
                                  title="Reset Password to Username"
                                  onClick={() => handleResetPassword(user.id, user.name)}
                                  style={{ ...iconBtnStyle, background: '#fffbeb', color: '#d97706' }}
                                  onMouseOver={(e) => { e.currentTarget.style.background = '#d97706'; e.currentTarget.style.color = 'white'; e.currentTarget.style.transform = 'translateY(-2px)' }}
                                  onMouseOut={(e) => { e.currentTarget.style.background = '#fffbeb'; e.currentTarget.style.color = '#d97706'; e.currentTarget.style.transform = 'translateY(0)' }}
                                >
                                  🔑
                                </button>

                                <button 
                                  title="Delete User"
                                  onClick={() => handleDelete(user.id)}
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
                {users.length === 0 && !loading && (
                   <tr>
                     <td colSpan="6">
                        <div style={{ padding: '80px', textAlign: 'center', color: '#64748b' }}>
                           <div style={{ fontSize: '4rem', marginBottom: '15px' }}>👥</div>
                           <h3 style={{ fontSize: '1.4rem', color: 'var(--text-bold)', margin: '0 0 10px 0', fontWeight: '800' }}>No Users Found</h3>
                           <p style={{ margin: 0, fontSize: '1rem' }}>Use the form above to add your first user.</p>
                        </div>
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

export default ManageUser;