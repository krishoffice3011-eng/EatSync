// src/App.js
import React, { useState, useEffect, useMemo } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Link,
  useLocation,
  Navigate,
} from "react-router-dom";
import { io } from "socket.io-client";
import Home from "./Home";
import CanteenDetail from "./CanteenDetail";
import ManageUser from "./ManageUser";
import ManageCanteens from "./ManageCanteens";
import ManageItems from "./ManageItems"; 
import ManageTickers from "./ManageTickers"; 
import ItemDetail from "./ItemDetail"; 
import Login from "./Login";
import CanteenEmployees from "./CanteenEmployees";
import Reports from "./Reports"; 
import API_BASE_URL from "./config";
import "./App.css";

const Sidebar = ({ user, isOpen }) => {
  const location = useLocation();
  const isActive = (path) =>
    location.pathname === path ? "sidebar-link active" : "sidebar-link";
  const role = (user?.Role || user?.role || "").toLowerCase();

  return (
    <aside className={`global-sidebar-15 ${isOpen ? "" : "closed"}`}>
      <div className="sidebar-logo" style={{ padding: '35px 24px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '-50%', left: '-50%', width: '200%', height: '200%', background: 'radial-gradient(circle at center, rgba(79, 70, 229, 0.05) 0%, transparent 50%)', animation: 'rotateBg 20s linear infinite', zIndex: 0 }}></div>
        <h2 style={{ position: 'relative', zIndex: 1 }}>
          <span style={{ animation: 'float 3s ease-in-out infinite' }}>🍽️</span> EatSync
        </h2>
      </div>
      <nav className="sidebar-nav">
        <Link to="/" className={isActive("/")}>
          <div className="sidebar-icon">🏠</div> Home Overview
        </Link>
        {role === "admin" && (
          <>
            <Link to="/reports" className={isActive("/reports")}>
              <div className="sidebar-icon">📊</div> Reports Engine
            </Link>
            
            <Link to="/manage-canteens" className={isActive("/manage-canteens")}>
              <div className="sidebar-icon">🏢</div> Canteen Master
            </Link>
            <Link to="/manage-items" className={isActive("/manage-items")}>
              <div className="sidebar-icon">🍔</div> Item Master
            </Link>
            <Link to="/manage-users" className={isActive("/manage-users")}>
              <div className="sidebar-icon">👥</div> User Master
            </Link>
            <Link to="/manage-tickers" className={isActive("/manage-tickers")}>
              <div className="sidebar-icon">📢</div> Ticker & Alerts
            </Link>
          </>
        )}
      </nav>
      <div className="sidebar-footer">
        <div className="sidebar-divider"></div>
        <p style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <span style={{ color: 'var(--primary)' }}>⚡</span> EatSync OS v1.0
        </p>
      </div>
    </aside>
  );
};

const LiveMenuPreview = ({ items, isLiveDate, isSidebarOpen }) => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [manualIndex, setManualIndex] = useState(null);

  useEffect(() => {
    const timerId = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timerId);
  }, []);

  const getLogicalMinsFromString = (tStr) => {
      if (!tStr) return 0;
      let [h, m] = tStr.split(':').map(Number);
      if (h >= 0 && h < 5) h += 24; 
      return h * 60 + m; 
  };

  const formatT = (tStr) => {
      if(!tStr) return '--:--';
      let [h, m] = tStr.split(':').map(Number);
      let displayH = h % 24;
      let ampm = displayH >= 12 ? 'PM' : 'AM';
      displayH = displayH % 12 || 12;
      return `${displayH}:${String(m).padStart(2, '0')} ${ampm}`;
  };

  const groupedItems = useMemo(() => {
      if (!items || items.length === 0) return [];
      
      const map = new Map();
      items.forEach(item => {
          const name = item.ItemName || item.itemname || 'Unknown Meal';
          if (!map.has(name)) {
              map.set(name, { name, variants: [], earliestStart: 99999, latestEnd: 0 });
          }
          
          const groupData = map.get(name);
          const startMins = getLogicalMinsFromString(item.FromTime || item.fromtime);
          const endMins = getLogicalMinsFromString(item.ToTime || item.totime);
          const adjustedEnd = endMins < startMins ? endMins + 24 * 60 : endMins;

          groupData.variants.push({
              group: item.ItemGroup || item.itemgroup || 'NORMAL',
              fromStr: item.FromTime || item.fromtime,
              toStr: item.ToTime || item.totime,
              startMins,
              endMins: adjustedEnd
          });

          if (startMins < groupData.earliestStart) groupData.earliestStart = startMins;
          if (adjustedEnd > groupData.latestEnd) groupData.latestEnd = adjustedEnd;
      });

      return Array.from(map.values()).sort((a, b) => a.earliestStart - b.earliestStart);
  }, [items]);

  const getGroupStatus = (groupItem, time) => {
      if (!groupItem) return 'UNKNOWN';
      let currentMins = time.getHours() * 60 + time.getMinutes();
      if (currentMins < 5 * 60) currentMins += 24 * 60; 
      if (currentMins >= groupItem.earliestStart && currentMins <= groupItem.latestEnd) return 'LIVE NOW';
      if (currentMins < groupItem.earliestStart) return 'UPCOMING';
      return 'COMPLETED';
  };

  const autoIndex = useMemo(() => {
      if (groupedItems.length === 0) return 0;
      let activeIdx = -1;
      let nextIdx = -1;
      
      for (let i = 0; i < groupedItems.length; i++) {
          const status = getGroupStatus(groupedItems[i], currentTime);
          if (status === 'LIVE NOW') { activeIdx = i; break; }
          if (status === 'UPCOMING' && nextIdx === -1) { nextIdx = i; }
      }
      
      if (activeIdx !== -1) return activeIdx;
      if (nextIdx !== -1) return nextIdx;
      return groupedItems.length - 1; 
  }, [groupedItems, currentTime]);

  const displayIndex = manualIndex !== null ? manualIndex : autoIndex;
  const currentItem = groupedItems[displayIndex];
  const status = getGroupStatus(currentItem, currentTime);

  const isFirst = displayIndex === 0;
  const isLast = displayIndex === groupedItems.length - 1;

  const handlePrev = () => { if (!isFirst) setManualIndex(displayIndex - 1); };
  const handleNext = () => { if (!isLast) setManualIndex(displayIndex + 1); };

  let containerBg = '#f8fafc';
  let containerBorder = '#e2e8f0';
  let titleColor = 'var(--text-bold)';

  if (status === 'LIVE NOW') {
      containerBg = '#ecfdf5';
      containerBorder = '#10b981';
      titleColor = '#065f46';
  } else if (status === 'UPCOMING') {
      containerBg = '#eff6ff';
      containerBorder = '#3b82f6';
      titleColor = '#1e3a8a';
  } else if (status === 'COMPLETED') {
      containerBg = '#f1f5f9';
      containerBorder = '#cbd5e1';
      titleColor = '#475569';
  }

  return (
    <div style={{ 
        display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'space-between', 
        background: containerBg, border: `2px solid ${containerBorder}`, borderRadius: '28px', 
        padding: '12px 25px', 
        boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.03), 0 4px 15px rgba(0,0,0,0.04)',
        transition: 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
        minHeight: '85px',
        position: 'relative' 
    }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flex: 1, overflow: 'hidden', zIndex: 5, maxWidth: '40%' }}>
            {currentItem ? (
                <>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '120px', flexShrink: 0 }}>
                        <span style={{ fontWeight: '950', color: titleColor, fontSize: '1.25rem', letterSpacing: '-0.5px' }}>
                            {currentItem.name}
                        </span>
                        {status === 'LIVE NOW' && <span className="live-indicator-text" style={{ fontSize: '0.6rem', padding: '3px 8px', alignSelf: 'flex-start', background: '#10b981', boxShadow: '0 0 10px rgba(16,185,129,0.4)' }}>LIVE NOW</span>}
                        {status === 'UPCOMING' && <span className="badge info-badge" style={{ fontSize: '0.6rem', padding: '3px 8px', alignSelf: 'flex-start', letterSpacing: '1px' }}>UPCOMING</span>}
                        {status === 'COMPLETED' && <span className="badge" style={{ fontSize: '0.6rem', padding: '3px 8px', alignSelf: 'flex-start', background: '#e2e8f0', color: '#64748b' }}>COMPLETED</span>}
                    </div>
                    
                    <div style={{ width: '2px', height: '50px', background: containerBorder, opacity: 0.4, flexShrink: 0 }}></div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '70px', overflowY: 'auto', paddingRight: '10px' }} className="hide-scrollbar">
                        {currentItem.variants.map((v, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span style={{ 
                                    background: status==='LIVE NOW' ? '#d1fae5' : (status==='UPCOMING' ? '#dbeafe' : '#e2e8f0'), 
                                    color: status==='LIVE NOW' ? '#065f46' : (status==='UPCOMING' ? '#1e40af' : '#475569'), 
                                    padding: '4px 10px', fontSize: '0.65rem', fontWeight: '950', borderRadius: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' 
                                }}>
                                    {v.group}
                                </span>
                                {!isSidebarOpen && (
                                    <span style={{ fontSize: '0.8rem', fontWeight: '800', color: 'var(--text-bold)', whiteSpace: 'nowrap' }}>
                                        {formatT(v.fromStr)} - {formatT(v.toStr)}
                                    </span>
                                )}
                            </div>
                        ))}
                    </div>
                </>
            ) : (
                <span style={{ fontSize: '0.9rem', fontWeight: '800', color: '#94a3b8' }}>No Assigned Items Found</span>
            )}
        </div>

        <div style={{ 
            display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto',
            background: '#0f172a', borderRadius: '20px', padding: '12px 35px', gap: '15px',
            boxShadow: '0 15px 35px rgba(0,0,0,0.25)', border: '1.5px solid rgba(255,255,255,0.1)', zIndex: 10
        }}>
            <span className="live-indicator-text" style={{ background: isLiveDate ? '#ef4444' : '#64748b', fontSize: '0.75rem', padding: '4px 12px' }}>
                {isLiveDate ? 'LIVE' : 'HISTORY'}
            </span>
            <span style={{ fontSize: '1.8rem', fontWeight: '950', color: '#ffffff', lineHeight: '1', fontVariantNumeric: 'tabular-nums', width: '120px', textAlign: 'center', display: 'inline-block', letterSpacing: '1px' }}>
                {currentTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}
            </span>
            <div style={{ width: '2px', height: '30px', background: 'rgba(255,255,255,0.2)', margin: '0 2px' }}></div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center' }}>
                <span style={{ color: '#e2e8f0', fontSize: '0.9rem', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '1px', lineHeight: '1' }}>
                    {currentTime.toLocaleDateString(undefined, { weekday: "long" })}
                </span>
                <span style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: '800', marginTop: '4px', lineHeight: '1' }}>
                    {currentTime.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                </span>
            </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', flexShrink: 0, paddingLeft: '10px', zIndex: 5 }}>
            <button 
              onClick={handlePrev} disabled={isFirst}
              style={{ 
                  background: isFirst ? '#f1f5f9' : 'white', border: `2px solid ${isFirst ? '#e2e8f0' : '#cbd5e1'}`, 
                  borderRadius: '16px', padding: '10px 22px', fontSize: '0.75rem', 
                  fontWeight: '950', color: isFirst ? '#94a3b8' : 'var(--text-bold)', 
                  cursor: isFirst ? 'not-allowed' : 'pointer', transition: 'all 0.3s', 
                  boxShadow: isFirst ? 'none' : '0 4px 10px rgba(0,0,0,0.04)', opacity: isFirst ? 0.6 : 1
              }} 
            >◀ PREV</button>
            <button 
              onClick={handleNext} disabled={isLast}
              style={{ 
                  background: isLast ? '#f1f5f9' : 'white', border: `2px solid ${isLast ? '#e2e8f0' : '#cbd5e1'}`, 
                  borderRadius: '16px', padding: '10px 22px', fontSize: '0.75rem', 
                  fontWeight: '950', color: isLast ? '#94a3b8' : 'var(--text-bold)', 
                  cursor: isLast ? 'not-allowed' : 'pointer', transition: 'all 0.3s', 
                  boxShadow: isLast ? 'none' : '0 4px 10px rgba(0,0,0,0.04)', opacity: isLast ? 0.6 : 1
              }}
            >NEXT ▶</button>
        </div>
        <style>{`.hide-scrollbar::-webkit-scrollbar { display: none; } .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }`}</style>
    </div>
  );
};

const GodLevelLoader = () => (
  <div className="loading-screen fade-in" style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: '#0f172a', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
     <div className="loading-logo" style={{ fontSize: '6rem', marginBottom: '20px', animation: 'float 2s ease-in-out infinite' }}>🍽️</div>
     <h2 style={{ letterSpacing: '10px', color: 'white', fontWeight: 950, fontSize: '2rem', margin: 0 }}>EATSYNC CORE</h2>
     <div style={{ width: '300px', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '10px', overflow: 'hidden', marginTop: '30px', position: 'relative' }}>
         <div style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: '40%', background: 'linear-gradient(90deg, #4f46e5, #38bdf8)', animation: 'shimmer 1.5s infinite linear' }}></div>
     </div>
     <p style={{ marginTop: '20px', color: '#94a3b8', fontWeight: 800, fontSize: '0.8rem', letterSpacing: '3px' }}>
        ESTABLISHING SECURE CONNECTION...
     </p>
     <style>{`@keyframes shimmer { 0% { left: -40%; } 100% { left: 100%; } }`}</style>
  </div>
);

function App() {
  const [canteensData, setCanteensData] = useState([]);
  
  // eslint-disable-next-line no-unused-vars
  const [users, setUsers] = useState([]);
  
  const [itemsMaster, setItemsMaster] = useState([]); 
  const [loading, setLoading] = useState(true);
  const [isSocketConnected, setIsSocketConnected] = useState(false);
  
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem("eatsync_user");
    return savedUser ? JSON.parse(savedUser) : null;
  });
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    const saved = sessionStorage.getItem("sidebarOpen");
    return saved !== null ? JSON.parse(saved) : true;
  });

  useEffect(() => sessionStorage.setItem("sidebarOpen", JSON.stringify(isSidebarOpen)), [isSidebarOpen]);
  
  const [selectedDate, setSelectedDate] = useState(() => sessionStorage.getItem("dashboardSelectedDate") || "");
  useEffect(() => sessionStorage.setItem("dashboardSelectedDate", selectedDate), [selectedDate]);

  const [activeDates, setActiveDates] = useState([]);

  useEffect(() => {
    if (!user) return;
    
    let isMounted = true;
    const abortController = new AbortController();
    const signal = abortController.signal;
    const token = localStorage.getItem('eatsync_token');
    const authHeaders = { 'Authorization': `Bearer ${token}` };

    fetch(`${API_BASE_URL}/api/users`, { signal, headers: authHeaders })
        .then(res => res.json())
        .then(data => { if (isMounted) setUsers(Array.isArray(data) ? data : []); })
        .catch(err => { if(err.name !== 'AbortError') console.error("User fetch error:", err)});

    fetch(`${API_BASE_URL}/api/all-items`, { signal, headers: authHeaders })
        .then(res => res.json())
        .then(data => { if (isMounted) setItemsMaster(Array.isArray(data) ? data : []); })
        .catch(err => { if(err.name !== 'AbortError') console.error("Items fetch error:", err)});

    fetch(`${API_BASE_URL}/api/all-active-dates`, { signal, headers: authHeaders })
        .then(res => res.json())
        .then(data => { if (isMounted) setActiveDates(Array.isArray(data) ? data : []); })
        .catch(err => { if(err.name !== 'AbortError') console.error("Dates fetch error:", err)});

    const fetchDashboard = async (silent = false) => {
        if (isMounted && !silent) setLoading(true); 
        try {
            const url = selectedDate ? `/api/dashboard?date=${selectedDate}` : `/api/dashboard`;
            const res = await fetch(`${API_BASE_URL}${url}`, { signal, headers: authHeaders });
            if (!res.ok) throw new Error("Dashboard API failed.");
            
            const data = await res.json();
            if (isMounted) {
                setCanteensData(data.canteens || []);
                if (!silent) setLoading(false);
            }
        } catch (err) {
            if (err.name !== 'AbortError') {
                console.error("Dashboard failed:", err);
                if (isMounted && !silent) setLoading(false);
            }
        }
    };

    fetchDashboard(false);

    let pollingInterval;
    if (!selectedDate) {
        pollingInterval = setInterval(() => {
            fetchDashboard(true);
        }, 5000);
    }

    return () => {
      isMounted = false;
      abortController.abort();
      if (pollingInterval) clearInterval(pollingInterval);
    };
  }, [selectedDate, user]);

  useEffect(() => {
      if (!user || selectedDate) {
          setIsSocketConnected(false);
          return;
      }

      const socket = io(API_BASE_URL, {
          transports: ['polling', 'websocket']
      });

      socket.on('connect', () => {
          console.log("Connected to EatSync Real-Time Engine");
          setIsSocketConnected(true);
      });

      socket.on('disconnect', () => {
          setIsSocketConnected(false);
      });

      socket.on('dashboard_update', (data) => {
          if (data && data.canteens) {
              setCanteensData(data.canteens);
          }
      });

      return () => {
          socket.disconnect();
      };
  }, [user, selectedDate]);

  const handleLogin = (userData) => {
    setUser(userData);
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem("eatsync_user");
    localStorage.removeItem("eatsync_token");
  };

  const role = (user?.Role || user?.role || "").toLowerCase();

  const visibleCanteens = useMemo(() => {
    if (!user) return [];
    if (role === "admin") return canteensData;
    const assignedIds = String(user.CanteenID || "").split(",").map(id => id.trim()).filter(id => id);
    return canteensData.filter(c => assignedIds.includes(String(c.id)));
  }, [role, canteensData, user]);

  const userItems = useMemo(() => {
      if (!visibleCanteens || visibleCanteens.length === 0) return [];
      const assignedItemIds = new Set();
      visibleCanteens.forEach(c => {
          const itemIdsStr = String(c.itemid || c.ItemID || '');
          itemIdsStr.split(',').forEach(id => { if (id.trim()) assignedItemIds.add(id.trim()); });
      });
      return itemsMaster.filter(item => assignedItemIds.has(String(item.ItemID || item.itemid || item.ItemId)));
  }, [visibleCanteens, itemsMaster]);

  const globalStats = useMemo(() => {
    let totalExpected = 0; let currentlyInside = 0; let completedLunch = 0; let nextBatchCount = 0; let maxCapacity = 0;
    visibleCanteens.forEach(c => {
      totalExpected += c.stats?.totalExpected || 0;
      currentlyInside += c.stats?.currentlyInside || 0;
      completedLunch += c.stats?.completedLunch || 0;
      nextBatchCount += c.stats?.nextBatchCount || 0;
      maxCapacity += c.stats?.maxCapacity || 0;
    });
    return { totalExpected, currentlyInside, completedLunch, nextBatchCount, maxCapacity };
  }, [visibleCanteens]);

  const globalData = { stats: globalStats };

  if (!user) return <Login onLogin={handleLogin} />;

  return (
    <Router>
      <div className="global-layout">
        <Sidebar user={user} isOpen={isSidebarOpen} />

        <div className="global-main-85">
          {/* 🟢 ULTRAVIEWER FIX: Removed backdropFilter, added solid white background, flat composite layer */}
          <nav className="top-navbar" style={{ minHeight: '125px', height: 'auto', padding: '15px 40px', gap: '15px', background: '#ffffff', borderBottom: '1px solid #e2e8f0', boxShadow: '0 4px 15px rgba(0,0,0,0.03)', transform: 'translateZ(0)', backfaceVisibility: 'hidden' }}>
            <div className="navbar-left" style={{ flexShrink: 0, flex: 'none' }}>
              <button
                className={`sidebar-toggle-btn ${!isSidebarOpen ? "active" : ""}`}
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              >
                <span style={{ fontSize: '1.2rem', marginRight: '8px' }}>{isSidebarOpen ? "◀" : "☰"}</span>
                {isSidebarOpen ? "CLOSE" : "MENU"}
              </button>
            </div>

            <div className="navbar-center" style={{ flex: 1, margin: '0 10px', minWidth: 0 }}>
              <LiveMenuPreview items={userItems} isLiveDate={!selectedDate} isSidebarOpen={isSidebarOpen} />
            </div>

            <div className="navbar-right" style={{ flexShrink: 0, flex: 'none' }}>
              <div className="user-profile-header" style={{ display: "flex", alignItems: "center", gap: "25px", background: 'white', padding: '8px 8px 8px 25px', borderRadius: '100px', border: '1px solid #e2e8f0', boxShadow: '0 4px 15px rgba(0,0,0,0.02)' }}>
                
                {!selectedDate && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                     <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: isSocketConnected ? '#10b981' : '#f59e0b', boxShadow: isSocketConnected ? '0 0 10px #10b981' : 'none', animation: isSocketConnected ? 'pulseAlert 2s infinite' : 'none' }}></span>
                     <span style={{ fontSize: '0.65rem', fontWeight: '900', color: isSocketConnected ? '#059669' : '#d97706', letterSpacing: '1px' }}>
                        {isSocketConnected ? 'LIVE SYNC' : 'CONNECTING...'}
                     </span>
                  </div>
                )}
                {selectedDate && (
                   <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                     <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#64748b' }}></span>
                     <span style={{ fontSize: '0.65rem', fontWeight: '900', color: '#475569', letterSpacing: '1px' }}>HISTORY MODE</span>
                  </div>
                )}

                <div style={{ width: '1px', height: '25px', background: '#e2e8f0' }}></div>

                <div className="user-identity-text" style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", textAlign: "right" }}>
                  <span className="role-label">{role === "admin" ? "System Administrator" : "Facility Manager"}</span>
                  <span className="user-name">{user.Name}</span>
                </div>
                
                <button onClick={handleLogout} className="btn-logout" style={{ background: '#f1f5f9', color: '#0f172a', border: '1px solid #cbd5e1' }} onMouseOver={(e) => { e.currentTarget.style.background = '#dc2626'; e.currentTarget.style.color = 'white'; e.currentTarget.style.borderColor = '#dc2626'; }} onMouseOut={(e) => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.color = '#0f172a'; e.currentTarget.style.borderColor = '#cbd5e1'; }}>
                  LOGOUT
                </button>
              </div>
            </div>
          </nav>

          <div className="content-transition-wrapper" style={{ flex: 1, position: "relative", overflow: "hidden" }}>
            {loading && <GodLevelLoader />}
            <div className="routes-container" style={{ height: "100%", opacity: loading ? 0 : 1, transition: 'opacity 0.5s ease' }}>
              <Routes>
                <Route path="/" element={<Home visibleCanteens={visibleCanteens} itemsMaster={itemsMaster} globalData={globalData} role={role} selectedDate={selectedDate} setSelectedDate={setSelectedDate} activeDates={activeDates} />} />
                
                <Route path="/reports" element={role === "admin" ? <Reports role={role} /> : <Navigate to="/" />} />

                <Route path="/canteen/:id" element={<CanteenDetail selectedDate={selectedDate} />} />
                <Route path="/canteen/:id/employees" element={<CanteenEmployees />} />
                <Route path="/canteen/:canteenId/items" element={<ItemDetail selectedDate={selectedDate} />} />
                <Route path="/manage-canteens" element={role === "admin" ? <ManageCanteens canteensData={canteensData} setCanteensData={setCanteensData} role={role} setManagers={setUsers} /> : <Navigate to="/" />} />
                <Route path="/manage-items" element={role === "admin" ? <ManageItems role={role} /> : <Navigate to="/" />} />
                <Route path="/manage-users" element={role === "admin" ? <ManageUser role={role} /> : <Navigate to="/" />} />
                <Route path="/manage-tickers" element={role === "admin" ? <ManageTickers role={role} /> : <Navigate to="/" />} />
              </Routes>
            </div>
          </div>
        </div>
      </div>
    </Router>
  );
}

export default App;