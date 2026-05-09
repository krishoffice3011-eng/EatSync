// src/ManageCanteens.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import API_BASE_URL from './config';

// ==========================================
// 🍔 PREMIUM ITEM MULTI-SELECT 
// ==========================================
const ItemMultiSelect = ({ options, selectedValues, onChange, unavailableItems = [] }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleOption = (itemId) => {
    const strId = String(itemId);
    if (unavailableItems.includes(strId) && !selectedValues.includes(strId)) return;
    const updated = selectedValues.includes(strId)
      ? selectedValues.filter(v => v !== strId)
      : [...selectedValues, strId];
    onChange(updated);
  };

  const sortedOptions = [...options].sort((a, b) => {
    const gA = (a.ItemGroup || a.itemgroup || 'Others').toUpperCase();
    const gB = (b.ItemGroup || b.itemgroup || 'Others').toUpperCase();
    if (gA < gB) return -1;
    if (gA > gB) return 1;
    return (a.ItemName || a.itemname || '').localeCompare(b.ItemName || b.itemname || '');
  });

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
          <span style={{ color: '#94a3b8', fontSize: '0.85rem', fontWeight: '600' }}>Select Menu Items...</span>
        ) : (
          <span style={{ fontSize: '0.8rem', fontWeight: '800', color: 'var(--primary)', letterSpacing: '0.5px' }}>
            🍔 {selectedValues.length} Selected
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
            overscrollBehavior: 'contain',
            padding: '0', boxSizing: 'border-box'
        }}>
          <div style={{ position: 'sticky', top: 0, background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(10px)', display: 'flex', justifyContent: 'space-between', padding: '12px 15px', borderBottom: '1px solid #f1f5f9', zIndex: 2 }}>
            <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#64748b' }}>{options.length} Items</span>
            <span onClick={(e) => { e.stopPropagation(); onChange([]); }} style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--danger)', cursor: 'pointer' }}>Clear All</span>
          </div>
          <div style={{ padding: '8px' }}>
            {(() => {
              let currentGroup = null;
              return sortedOptions.map(opt => {
                const optId = opt.ItemID || opt.itemid;
                const optName = opt.ItemName || opt.itemname;
                const optGroup = opt.ItemGroup || opt.itemgroup || 'Others';
                const isSelected = selectedValues.includes(String(optId));
                const isUnavailable = unavailableItems.includes(String(optId)) && !isSelected;

                const elements = [];
                if (optGroup !== currentGroup) {
                  currentGroup = optGroup;
                  elements.push(<div key={`group-${optGroup}`} style={{ padding: '12px 10px 4px 10px', fontSize: '0.65rem', fontWeight: '900', color: '#94a3b8', letterSpacing: '1px', textTransform: 'uppercase' }}>{optGroup}</div>);
                }
                elements.push(
                  <div key={optId} onClick={(e) => { e.stopPropagation(); toggleOption(optId); }} style={{
                      padding: '10px', borderRadius: '10px', cursor: isUnavailable ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '10px', transition: 'all 0.2s', background: isSelected ? '#f0fdf4' : 'transparent', marginBottom: '2px', opacity: isUnavailable ? 0.5 : 1
                  }}>
                    <div style={{ width: '18px', height: '18px', border: isUnavailable ? '2px solid #cbd5e1' : (isSelected ? '2px solid #10b981' : '2px solid #cbd5e1'), borderRadius: '5px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: isSelected ? '#10b981' : 'transparent', flexShrink: 0 }}>
                      {isSelected && <span style={{ color: 'white', fontSize: '0.7rem', fontWeight: '900' }}>✓</span>}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: isSelected ? '800' : '600', color: isSelected ? '#065f46' : 'var(--text-main)' }}>{optName}</span>
                      {isUnavailable && <span style={{ fontSize: '0.6rem', color: '#94a3b8', fontWeight: '700' }}>Used in another canteen</span>}
                    </div>
                  </div>
                );
                return elements;
              });
            })()}
          </div>
        </div>
      )}
    </div>
  );
};

// ==========================================
// 📟 PREMIUM DEVICE MULTI-SELECT
// ==========================================
const DeviceMultiSelect = ({ options, selectedValues, onChange, unavailableIPs = [] }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleOption = (ipValue) => {
    const strIp = String(ipValue);
    if (unavailableIPs.includes(strIp) && !selectedValues.includes(strIp)) return;
    const updated = selectedValues.includes(strIp)
      ? selectedValues.filter(v => v !== strIp)
      : [...selectedValues, strIp];
    onChange(updated);
  };

  return (
    <div className="custom-select-wrapper" ref={containerRef} style={{ width: '100%', position: 'relative' }}>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        style={{
          minHeight: '44px', height: 'auto', padding: '8px 15px', background: 'white',
          border: isOpen ? '2px solid #0ea5e9' : '1px solid #cbd5e1', borderRadius: '12px', 
          display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center', cursor: 'pointer', 
          transition: 'all 0.3s ease',
          boxShadow: isOpen ? '0 4px 15px rgba(14, 165, 233, 0.15)' : 'inset 0 2px 4px rgba(0,0,0,0.02)',
          width: '100%', boxSizing: 'border-box'
        }}
      >
        {selectedValues.length === 0 ? (
          <span style={{ color: '#94a3b8', fontSize: '0.85rem', fontWeight: '600' }}>Select Devices...</span>
        ) : (
          <span style={{ fontSize: '0.8rem', fontWeight: '800', color: '#0ea5e9', letterSpacing: '0.5px' }}>
            📟 {selectedValues.length} Selected
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
            overscrollBehavior: 'contain',
            padding: '0', boxSizing: 'border-box'
        }}>
          <div style={{ position: 'sticky', top: 0, background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(10px)', display: 'flex', justifyContent: 'space-between', padding: '12px 15px', borderBottom: '1px solid #f1f5f9', zIndex: 2 }}>
            <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#64748b' }}>{options.length} Devices</span>
            <span onClick={(e) => { e.stopPropagation(); onChange([]); }} style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--danger)', cursor: 'pointer' }}>Clear All</span>
          </div>
          <div style={{ padding: '8px' }}>
            {options.map(opt => {
              const strIp = String(opt.IPAddress);
              const isSelected = selectedValues.includes(strIp);
              const isUnavailable = unavailableIPs.includes(strIp) && !isSelected;

              return (
                <div key={strIp} onClick={(e) => { e.stopPropagation(); toggleOption(strIp); }} style={{
                    padding: '10px', borderRadius: '10px', cursor: isUnavailable ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '10px', transition: 'all 0.2s', background: isSelected ? '#f0f9ff' : 'transparent', marginBottom: '2px', opacity: isUnavailable ? 0.5 : 1
                }}>
                  <div style={{ width: '18px', height: '18px', border: isUnavailable ? '2px solid #cbd5e1' : (isSelected ? '2px solid #0ea5e9' : '2px solid #cbd5e1'), borderRadius: '5px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: isSelected ? '#0ea5e9' : 'transparent', flexShrink: 0 }}>
                    {isSelected && <span style={{ color: 'white', fontSize: '0.7rem', fontWeight: '900' }}>✓</span>}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: isSelected ? '800' : '600', color: isSelected ? '#0369a1' : 'var(--text-main)' }}>{opt.DeviceName}</span>
                    <span style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: '600' }}>IP: {strIp} {isUnavailable && '• In Use'}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

// ==========================================
// MAIN COMPONENT
// ==========================================
function ManageCanteens({ canteensData, setCanteensData, role }) {
  const navigate = useNavigate();
  
  const [items, setItems] = useState([]);
  const [devices, setDevices] = useState([]);
  const [selectedItemsMap, setSelectedItemsMap] = useState({});
  const [selectedDevicesMap, setSelectedDevicesMap] = useState({});
  const [isSyncing, setIsSyncing] = useState(true);

  const [newName, setNewName] = useState('');
  const [newCapacity, setNewCapacity] = useState('');

  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editCapacity, setEditCapacity] = useState('');
  const [editSelectedItems, setEditSelectedItems] = useState([]);
  const [editSelectedDevices, setEditSelectedDevices] = useState([]);
  const [savingId, setSavingId] = useState(null);

  // 🔒 Helper to get headers with JWT token (Stable)
  const getAuthHeaders = useCallback(() => {
      const token = localStorage.getItem('eatsync_token');
      return {
          'Authorization': `Bearer ${token}`
      };
  }, []);

  // 🟢 PRIORITY COMPONENT-LEVEL FETCH (Stable)
  const fetchCoreData = useCallback(async (silent = false, signal) => {
    if (!silent) setIsSyncing(true);
    try {
      const authHeaders = getAuthHeaders();
      const [itemsRes, devicesRes, canteensRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/all-items`, { signal, headers: authHeaders }),
          fetch(`${API_BASE_URL}/api/all-devices`, { signal, headers: authHeaders }),
          fetch(`${API_BASE_URL}/api/canteens-list`, { signal, headers: authHeaders })
      ]);
      
      const itemsData = await itemsRes.json();
      const devicesData = await devicesRes.json();
      const canteensRaw = await canteensRes.json();
      
      setItems(Array.isArray(itemsData) ? itemsData : []);
      setDevices(Array.isArray(devicesData) ? devicesData : []);
      
      const initialItemSelections = {};
      const initialDeviceSelections = {};
      
      if (Array.isArray(canteensRaw)) {
          canteensRaw.forEach(c => {
              const cId = c.CanteenID || c.canteenid || c.id;
              const itemField = c.ItemID || c.ItemId || c.itemid;
              const ipField = c.IPAddress || c.ipaddress;
              
              initialItemSelections[cId] = itemField ? String(itemField).split(',').map(id => id.trim()).filter(id => id) : [];
              initialDeviceSelections[cId] = ipField ? String(ipField).split(',').map(ip => ip.trim()).filter(ip => ip) : [];
          });
          
          if (setCanteensData) {
             // 🟢 FIX: Use functional state update to prevent infinite loops from dependency arrays
             setCanteensData(prevData => {
                 return canteensRaw.map(raw => {
                     const rawId = raw.CanteenID || raw.canteenid;
                     // Only inherit stats if the canteen already existed in state
                     const existing = prevData ? prevData.find(ex => String(ex.id) === String(rawId)) : null;
                     return {
                         id: rawId,
                         name: raw.CanteenName || raw.canteenname,
                         itemid: raw.ItemID || raw.itemid,
                         ipaddress: raw.IPAddress || raw.ipaddress,
                         stats: existing?.stats || { maxCapacity: raw.Capacity || 100 }
                     };
                 });
             });
          }
      }
      setSelectedItemsMap(initialItemSelections);
      setSelectedDevicesMap(initialDeviceSelections);
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error("Failed to load data:", err);
      }
    } finally {
      setIsSyncing(false);
    }
  }, [getAuthHeaders, setCanteensData]);

  // 🚀 Triggers the exact millisecond the user navigates to this page
  useEffect(() => {
    if (role !== 'admin') return;

    const abortController = new AbortController();
    fetchCoreData(false, abortController.signal);

    return () => {
      abortController.abort(); // Cancel pending API calls if user navigates away quickly
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

  const getUnavailableItems = (currentId) => {
    return Object.keys(selectedItemsMap).filter(id => String(id) !== String(currentId)).flatMap(id => selectedItemsMap[id] || []);
  };

  const getUnavailableIPs = (currentId) => {
    return Object.keys(selectedDevicesMap).filter(id => String(id) !== String(currentId)).flatMap(id => selectedDevicesMap[id] || []);
  };

  // 🔒 Secured POST route with JWT
  const handleAdd = async () => {
    if (!newName.trim() || !newCapacity.trim()) return;
    try {
      const token = localStorage.getItem('eatsync_token');
      const res = await fetch(`${API_BASE_URL}/api/canteens`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ name: newName, maxCapacity: newCapacity })
      });
      if (res.ok) { 
        setNewName(''); setNewCapacity('');
        await fetchCoreData(true); // Refresh table silently
      } else {
        alert('Failed to save canteen.');
      }
    } catch (err) { 
        alert('Network Error.'); 
    }
  };

  // 🔒 Secured DELETE route with JWT
  const handleDelete = async (id) => {
    if(!window.confirm("Are you sure you want to delete this canteen?")) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/canteens/${id}`, { 
          method: 'DELETE',
          headers: getAuthHeaders()
      });
      if (res.ok) await fetchCoreData(true);
    } catch (err) { alert('Delete failed.'); }
  };

  const startInlineEdit = (canteen) => {
    setEditingId(canteen.id);
    setEditName(canteen.name);
    setEditCapacity(canteen.stats?.maxCapacity || canteen.Capacity || 0);
    setEditSelectedItems(selectedItemsMap[canteen.id] || []);
    setEditSelectedDevices(selectedDevicesMap[canteen.id] || []);
  };

  // 🔒 Secured PUT/POST routes with JWT
  const saveInlineEdit = async (canteenId) => {
    setSavingId(canteenId);
    try {
        const token = localStorage.getItem('eatsync_token');
        const headersWithAuth = { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };

        await Promise.all([
            fetch(`${API_BASE_URL}/api/canteens/${canteenId}`, {
                method: 'PUT',
                headers: headersWithAuth,
                body: JSON.stringify({ name: editName, maxCapacity: editCapacity })
            }),
            fetch(`${API_BASE_URL}/api/update-canteen-items`, {
                method: 'POST',
                headers: headersWithAuth,
                body: JSON.stringify({ canteenId, itemIds: editSelectedItems })
            }),
            fetch(`${API_BASE_URL}/api/update-canteen-devices`, {
                method: 'POST',
                headers: headersWithAuth,
                body: JSON.stringify({ canteenId, ipAddresses: editSelectedDevices })
            })
        ]);
        setEditingId(null);
        await fetchCoreData(true); 
    } catch (err) {
        alert('Failed to save changes.');
    } finally {
        setSavingId(null);
    }
  };

  // God Level Icon Button Styling
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
          <h1 className="m-0" style={{ fontSize: '1.6rem', fontWeight: '800', letterSpacing: '-0.5px' }}>Manage Canteens</h1>
        </div>
        <div className="navbar-right">
          <span className="badge" style={{ padding: '8px 20px', fontSize: '0.85rem', background: 'rgba(255,255,255,0.1)', color: 'white', borderRadius: '12px' }}>
            {canteensData.length} Total Canteens
          </span>
        </div>
      </div>

      <main className="main-scrollable-content fade-in">
        
        {/* ADD CANTEEN SECTION */}
        <div className="section-header-premium mb-15">
          <h2 style={{ fontSize: '1.4rem', fontWeight: '800', color: 'var(--text-bold)' }}>Add New Canteen</h2>
          <p className="text-slate" style={{ fontSize: '0.9rem', marginTop: '4px' }}>Create a new canteen, set its seats, and assign devices and menus.</p>
        </div>

        <form style={{ 
            display: 'flex', gap: '20px', alignItems: 'flex-end', background: 'white', padding: '25px 30px', 
            borderRadius: '24px', marginBottom: '40px', border: '1px solid #e2e8f0', boxShadow: '0 10px 30px rgba(0,0,0,0.03)' 
          }} onSubmit={(e) => { e.preventDefault(); handleAdd(); }}>
          <div style={{ flex: 2 }}>
            <label style={{ fontSize: '0.8rem', fontWeight: '800', marginBottom: '8px', color: '#64748b', display: 'block' }}>Canteen Name</label>
            <input 
              className="manager-input" 
              value={newName} 
              onChange={e => setNewName(e.target.value)} 
              placeholder="e.g. Main Cafeteria" 
              required
              style={{ height: '50px', fontSize: '1rem', fontWeight: '600', border: '1px solid #cbd5e1', borderRadius: '12px' }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: '0.8rem', fontWeight: '800', marginBottom: '8px', color: '#64748b', display: 'block' }}>Total Seats</label>
            <input 
              className="manager-input" 
              type="number"
              value={newCapacity} 
              onChange={e => setNewCapacity(e.target.value)} 
              placeholder="Number of seats" 
              required
              style={{ height: '50px', fontSize: '1rem', fontWeight: '600', border: '1px solid #cbd5e1', borderRadius: '12px' }}
            />
          </div>
          <button type="submit" className="btn-primary" style={{ height: '50px', padding: '0 30px', fontSize: '0.9rem', fontWeight: '800', borderRadius: '12px', boxShadow: '0 10px 20px var(--primary-glow)' }}>
            + Add Canteen
          </button>
        </form>

        {/* CANTEEN LIST SECTION */}
        <div className="table-section mb-60">
          <div className="flex-between mb-20">
            <h2 className="m-0" style={{ fontSize: '1.4rem', fontWeight: '800', color: 'var(--text-bold)', letterSpacing: '-0.5px' }}>Canteen List</h2>
          </div>
          
          <div className="stable-table-container fade-in" style={{ overflowX: 'auto', overflowY: 'visible', position: 'relative', borderRadius: '24px', border: '1px solid #e2e8f0', boxShadow: '0 15px 40px rgba(0,0,0,0.04)', paddingBottom: '200px' }}>
            {isSyncing && (
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(3px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="dots-loader"><div className="dot"></div><div className="dot"></div><div className="dot"></div></div>
                </div>
            )}
            
            <table className="stable-modern-table" style={{ minWidth: '1100px', width: '100%' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                  <th style={{ width: '8%', padding: '20px', color: '#64748b', fontSize: '0.8rem', fontWeight: '900' }}>🏷️ ID</th>
                  <th style={{ width: '20%', padding: '20px', color: '#64748b', fontSize: '0.8rem', fontWeight: '900' }}>📝 Name</th>
                  <th style={{ width: '12%', padding: '20px', color: '#64748b', fontSize: '0.8rem', fontWeight: '900' }}>🪑 Seats</th>
                  <th style={{ width: '22%', padding: '20px', color: '#64748b', fontSize: '0.8rem', fontWeight: '900' }}>📟 Devices</th>
                  <th style={{ width: '22%', padding: '20px', color: '#64748b', fontSize: '0.8rem', fontWeight: '900' }}>🍔 Menu Items</th>
                  <th style={{ width: '16%', textAlign: 'center', padding: '20px', color: '#64748b', fontSize: '0.8rem', fontWeight: '900' }}>⚙️ Actions</th>
                </tr>
              </thead>
              <tbody>
                {canteensData.map(c => {
                  const isEditing = editingId === c.id;
                  const assignedItems = selectedItemsMap[c.id] || [];
                  const assignedIPs = selectedDevicesMap[c.id] || [];

                  return (
                  <tr key={c.id} style={{ borderBottom: '1px solid #f1f5f9', background: isEditing ? '#f0f9ff' : 'white', transition: 'background 0.3s' }}>
                    <td style={{ padding: '20px', verticalAlign: 'top' }}>
                      <span style={{ background: '#f1f5f9', color: '#475569', padding: '6px 12px', borderRadius: '8px', fontSize: '0.85rem', fontWeight: '800' }}>
                        #{c.id}
                      </span>
                    </td>
                    <td style={{ padding: '20px', verticalAlign: 'top' }}>
                      {isEditing ? (
                          <input className="stable-input" value={editName} onChange={e => setEditName(e.target.value)} style={{ border: '2px solid #0ea5e9', borderRadius: '10px', height: '44px', width: '100%' }} />
                      ) : (
                          <strong style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-bold)', display: 'block', marginTop: '6px' }}>{c.name}</strong>
                      )}
                    </td>
                    <td style={{ padding: '20px', verticalAlign: 'top' }}>
                        {isEditing ? (
                            <input className="stable-input" type="number" value={editCapacity} onChange={e => setEditCapacity(e.target.value)} style={{ border: '2px solid #0ea5e9', borderRadius: '10px', height: '44px', width: '90px' }} />
                        ) : (
                            <span style={{ fontSize: '1rem', fontWeight: '800', color: '#475569', display: 'block', marginTop: '6px' }}>
                               {c.stats?.maxCapacity || 0}
                            </span>
                        )}
                    </td>
                    <td style={{ padding: '20px', verticalAlign: 'top' }}>
                        {isEditing ? (
                            <DeviceMultiSelect options={devices} selectedValues={editSelectedDevices} unavailableIPs={getUnavailableIPs(c.id)} onChange={setEditSelectedDevices} />
                        ) : (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '6px' }}>
                                {assignedIPs.length === 0 ? <span style={{color: '#94a3b8', fontSize: '0.85rem', fontWeight: '600'}}>None</span> : 
                                 assignedIPs.map(ip => {
                                    const dev = devices.find(d => String(d.IPAddress) === String(ip));
                                    return (
                                        <span key={ip} style={{ fontSize: '0.75rem', padding: '6px 12px', background: '#f0f9ff', color: '#0284c7', borderRadius: '8px', fontWeight: '700', border: '1px solid #bae6fd' }}>
                                            {dev ? dev.DeviceName : ip}
                                        </span>
                                    )
                                 })}
                            </div>
                        )}
                    </td>
                    <td style={{ padding: '20px', verticalAlign: 'top' }}>
                        {isEditing ? (
                            <ItemMultiSelect options={items} selectedValues={editSelectedItems} unavailableItems={getUnavailableItems(c.id)} onChange={setEditSelectedItems} />
                        ) : (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '6px' }}>
                                {assignedItems.length === 0 ? <span style={{color: '#94a3b8', fontSize: '0.85rem', fontWeight: '600'}}>None</span> : 
                                 assignedItems.slice(0, 3).map(id => {
                                    const item = items.find(i => String(i.ItemID || i.itemid) === String(id));
                                    return (
                                        <span key={id} style={{ fontSize: '0.75rem', padding: '6px 12px', background: '#f8fafc', color: '#475569', borderRadius: '8px', fontWeight: '700', border: '1px solid #e2e8f0' }}>
                                            {item ? item.ItemName || item.itemname : `Item #${id}`}
                                        </span>
                                    )
                                 })}
                                 {assignedItems.length > 3 && <span style={{fontSize: '0.75rem', fontWeight: '800', color: 'var(--primary)', alignSelf: 'center', marginLeft: '5px'}}>+{assignedItems.length - 3}</span>}
                            </div>
                        )}
                    </td>
                    <td style={{ padding: '20px', textAlign: 'center', verticalAlign: 'top' }}>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginTop: '2px' }}>
                        {isEditing ? (
                            <>
                                <button 
                                  title="Save Changes"
                                  onClick={() => saveInlineEdit(c.id)} 
                                  disabled={savingId === c.id}
                                  style={{ ...iconBtnStyle, background: '#10b981', color: 'white', opacity: savingId === c.id ? 0.6 : 1 }}
                                  onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                                  onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                                >
                                  {savingId === c.id ? '⏳' : '💾'}
                                </button>
                                <button 
                                  title="Cancel"
                                  onClick={() => setEditingId(null)} 
                                  disabled={savingId === c.id}
                                  style={{ ...iconBtnStyle, background: 'white', color: '#64748b', border: '1px solid #e2e8f0' }}
                                  onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                                  onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                                >
                                  ❌
                                </button>
                            </>
                        ) : (
                            <>
                                <button 
                                  title="Edit Canteen"
                                  onClick={() => startInlineEdit(c)}
                                  style={{ ...iconBtnStyle, background: '#f0f9ff', color: '#0ea5e9' }}
                                  onMouseOver={(e) => { e.currentTarget.style.background = '#0ea5e9'; e.currentTarget.style.color = 'white'; e.currentTarget.style.transform = 'translateY(-2px)' }}
                                  onMouseOut={(e) => { e.currentTarget.style.background = '#f0f9ff'; e.currentTarget.style.color = '#0ea5e9'; e.currentTarget.style.transform = 'translateY(0)' }}
                                >
                                  ✏️
                                </button>
                                <button 
                                  title="Delete Canteen"
                                  onClick={() => handleDelete(c.id)}
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
                {canteensData.length === 0 && !isSyncing && (
                   <tr>
                     <td colSpan="6">
                        <div style={{ padding: '80px', textAlign: 'center', color: '#64748b' }}>
                           <div style={{ fontSize: '4rem', marginBottom: '15px' }}>🏢</div>
                           <h3 style={{ fontSize: '1.4rem', color: 'var(--text-bold)', margin: '0 0 10px 0', fontWeight: '800' }}>No Canteens Found</h3>
                           <p style={{ margin: 0, fontSize: '1rem' }}>Use the form above to add your first canteen.</p>
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

export default ManageCanteens;