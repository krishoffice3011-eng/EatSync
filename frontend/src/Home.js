// src/Home.js
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import API_BASE_URL from './config';

// ⏱️ Helper Function: Convert Minutes to HH:MM Format
const formatMinsToHHMM = (totalMins) => {
    if (!totalMins || isNaN(totalMins)) return '0m';
    const h = Math.floor(totalMins / 60);
    const m = totalMins % 60;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
};

const GodCalendarSelect = ({ value, onChange, options, hasDataFn }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const selectedLabel = options.find(opt => String(opt.value) === String(value))?.label;

  return (
    <div className="calendar-selector-wrapper" ref={dropdownRef} style={{ position: 'relative' }}>
      <div 
        className={`calendar-selector-custom ${isOpen ? 'open' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        style={{ 
            background: hasDataFn(value) ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'white',
            color: hasDataFn(value) ? 'white' : 'var(--cal-primary)',
            boxShadow: hasDataFn(value) ? '0 8px 15px rgba(16, 185, 129, 0.25)' : '0 4px 12px rgba(0,0,0,0.08)'
        }}
      >
        <span>{selectedLabel}</span>
        <span className="selector-arrow">▼</span>
      </div>
      {isOpen && (
        <div className="calendar-dropdown-list" style={{ position: 'absolute', top: '100%', left: 0, zIndex: 10000, width: '100%', minWidth: '120px' }}>
          {options.map(opt => {
            const hasData = hasDataFn(opt.value);
            return (
              <div 
                key={opt.value} 
                className={`calendar-dropdown-item ${String(opt.value) === String(value) ? 'selected' : ''} ${hasData ? 'has-data' : ''}`}
                style={{
                  background: hasData ? '#f0fdf4' : '',
                  color: hasData ? '#10b981' : ''
                }}
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
              >
                {opt.label}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const GodCalendar = ({ selectedDate, setSelectedDate, activeDates }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [viewDate, setViewDate] = useState(selectedDate ? new Date(selectedDate) : new Date());
  const calendarRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (calendarRef.current && !calendarRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const todayDateObj = new Date();
  const todayStr = `${todayDateObj.getFullYear()}-${String(todayDateObj.getMonth() + 1).padStart(2, '0')}-${String(todayDateObj.getDate()).padStart(2, '0')}`;

  const calendarData = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();
    
    const days = [];
    
    for (let i = firstDayOfMonth - 1; i >= 0; i--) {
      days.push({ day: daysInPrevMonth - i, month: month - 1, year: year, otherMonth: true });
    }
    
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({
        day: d, month: month, year: year, dateStr,
        isActive: activeDates && activeDates.includes(dateStr),
        isSelected: selectedDate === dateStr,
        isToday: dateStr === todayStr,
        otherMonth: false
      });
    }
    
    const remainingSlots = 42 - days.length;
    for (let d = 1; d <= remainingSlots; d++) {
      days.push({ day: d, month: month + 1, year: year, otherMonth: true });
    }
    
    return days;
  }, [viewDate, selectedDate, activeDates, todayStr]);

  const changeMonth = (offset) => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + offset, 1));
  const setMonth = (m) => setViewDate(new Date(viewDate.getFullYear(), parseInt(m), 1));
  const setYear = (y) => setViewDate(new Date(parseInt(y), viewDate.getMonth(), 1));

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 11 }, (_, i) => currentYear - 5 + i);
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  const hasDataInYear = (year) => activeDates && activeDates.some(d => d.startsWith(String(year)));
  const hasDataInMonth = (month) => activeDates && activeDates.some(d => d.startsWith(`${viewDate.getFullYear()}-${String(parseInt(month) + 1).padStart(2, '0')}`));

  return (
    <div className="flex-align-center gap-10" style={{ position: 'relative', zIndex: 1000 }} ref={calendarRef}>
      <div className="flex-align-center gap-15">
        {selectedDate && (
          <button 
            className="btn-calendar-reset" 
            onClick={(e) => { e.stopPropagation(); setSelectedDate(''); }}
          >
            RESET TO LIVE
          </button>
        )}

        <div className="date-trigger-container" onClick={() => setIsOpen(!isOpen)}>
          <span className="text-slate text-xs-bold" style={{fontSize: '0.75rem', whiteSpace: 'nowrap'}}>History Data:</span>
          <span style={{ fontWeight: '950', fontSize: '0.85rem', color: 'var(--cal-primary)', marginLeft: '10px', marginRight: '10px' }}>
            {selectedDate || 'Select Date'}
          </span>
          <span style={{ fontSize: '1rem' }}>📅</span>
        </div>
      </div>

      {isOpen && (
        <div className="calendar-dropdown-container" style={{ position: 'absolute', top: '120%', right: 0, zIndex: 9999 }}>
          <div className="calendar-header">
            <button className="calendar-nav-btn" onClick={() => changeMonth(-1)}>←</button>
            <div className="calendar-select-group">
              <GodCalendarSelect value={viewDate.getMonth()} onChange={setMonth} options={months.map((m, i) => ({ value: i, label: m }))} hasDataFn={hasDataInMonth} />
              <GodCalendarSelect value={viewDate.getFullYear()} onChange={setYear} options={years.map(y => ({ value: y, label: y }))} hasDataFn={hasDataInYear} />
            </div>
            <button className="calendar-nav-btn" onClick={() => changeMonth(1)}>→</button>
          </div>
          <div className="calendar-grid">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(d => (
              <div key={d} className="calendar-day-label">{d}</div>
            ))}
            {calendarData.map((d, i) => (
              <div 
                key={i} 
                className={`calendar-date-cell ${d.otherMonth ? 'other-month' : ''} ${d.isActive ? 'is-active-data' : ''} ${d.isSelected ? 'is-selected' : ''} ${d.isToday ? 'is-today' : ''}`}
                onClick={() => {
                  if (!d.otherMonth) { 
                    if (d.isToday) return; 
                    setSelectedDate(d.dateStr); 
                    setIsOpen(false); 
                  } else { 
                    setViewDate(new Date(d.year, d.month, d.day)); 
                  }
                }}
              >
                {d.day}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const PremiumStatCard = ({ icon, title, value, subtitle, gradient, shadowColor, valueSize = '3rem' }) => (
  <div style={{
    background: gradient,
    borderRadius: '24px',
    padding: 'clamp(15px, 2vh, 24px)',
    color: 'white',
    position: 'relative',
    overflow: 'hidden',
    boxShadow: `0 15px 30px -10px ${shadowColor}`,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    flex: 1,
    minHeight: 0, 
    border: '1px solid rgba(255,255,255,0.15)',
    transition: 'all 0.3s ease',
    cursor: 'default'
  }}
  onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-5px)'; e.currentTarget.style.boxShadow = `0 20px 40px -10px ${shadowColor}`; }}
  onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = `0 15px 30px -10px ${shadowColor}`; }}
  >
    <span style={{ position: 'absolute', top: '50%', right: '15px', transform: 'translateY(-50%)', fontSize: 'clamp(3rem, 5vh, 4rem)', opacity: 0.15, pointerEvents: 'none' }}>
      {icon}
    </span>
    <h3 style={{ margin: '0 0 8px 0', fontSize: 'clamp(0.7rem, 1.2vh, 0.85rem)', fontWeight: '800', letterSpacing: '1px', textTransform: 'uppercase', opacity: 0.9 }}>{title}</h3>
    <p style={{ margin: 0, fontSize: valueSize, fontWeight: '950', letterSpacing: '-1px', lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</p>
    {subtitle && <p style={{ margin: '6px 0 0 0', fontSize: '0.80rem', fontWeight: '800', opacity: 0.85 }}>{subtitle}</p>}
  </div>
);

function Home({ visibleCanteens, itemsMaster, globalData, role, selectedDate, setSelectedDate, activeDates }) {
  const navigate = useNavigate();
  
  const [tickerData, setTickerData] = useState([]);
  const [nowTicker, setNowTicker] = useState(Date.now());
  const [showExtendedStayModal, setShowExtendedStayModal] = useState(false);
  
  // 🚨 Add new default states to ensure stability if API takes a second
  const [tickerSettings, setTickerSettings] = useState({
    tickers: [],
    overtimeLimit: 30,
    tickerSpeed: 60,
    alertTickerSpeed: 50,
    tickerDirection: 'rtl',
    tickerColor: '#38bdf8'
  });

  const [viewMode, setViewMode] = useState(() => {
    return sessionStorage.getItem('dashboardViewMode') || 'canteen';
  });

  useEffect(() => {
    sessionStorage.setItem('dashboardViewMode', viewMode);
  }, [viewMode]);

  useEffect(() => {
    const interval = setInterval(() => setNowTicker(Date.now()), 15000); 
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const abortController = new AbortController();
    const fetchTickers = async () => {
        try {
            const token = localStorage.getItem('eatsync_token');
            const res = await fetch(`${API_BASE_URL}/api/ticker-settings`, { 
                signal: abortController.signal,
                headers: { 'Authorization': `Bearer ${token}` } 
            });
            if (!res.ok) throw new Error("Ticker fetch failed");
            const data = await res.json();
            if (!data.error) setTickerSettings(data);
        } catch (err) {
            if (err.name !== 'AbortError') console.warn("Ticker load delayed, using defaults.");
        }
    };
    fetchTickers();
    return () => abortController.abort();
  }, []);

  useEffect(() => {
    const calculateTickers = () => {
      const slogans = tickerSettings.tickers && tickerSettings.tickers.length > 0 
          ? tickerSettings.tickers 
          : ["🍽️ Fresh meals, happy employees!", "⚡ Real-time canteen monitoring system", "🍱 Hygiene & quality is our priority"];
      
      const randomSlogans = [...slogans, ...slogans]; 
      setTickerData(randomSlogans.map(text => ({ type: 'slogan', text })));
    };
    calculateTickers();
    const timeSyncInterval = setInterval(calculateTickers, 15000);
    return () => clearInterval(timeSyncInterval);
  }, [tickerSettings]);

  const extendedStayEmployees = useMemo(() => {
    const limit = tickerSettings?.overtimeLimit || 30; 
    const list = [];
    
    visibleCanteens.forEach(c => {
       const insideList = c.stats?.insideList || [];
       insideList.forEach(emp => {
          if (emp.processedDate) {
             const inTime = new Date(emp.processedDate).getTime();
             const diffMins = Math.floor((nowTicker - inTime) / 60000); 
             
             if (diffMins > limit) {
                list.push({
                   id: emp.id,
                   name: emp.name,
                   canteenName: c.name,
                   processedDate: emp.processedDate,
                   totalMins: diffMins,
                   exceededMins: diffMins - limit
                });
             }
          }
       });
    });
    return list.sort((a,b) => b.totalMins - a.totalMins);
  }, [visibleCanteens, tickerSettings, nowTicker]);

  const menuStats = useMemo(() => {
    let totalServed = 0;
    const itemLeaderboard = {};
    const uniqueGroups = new Set();
    
    visibleCanteens.forEach(canteen => {
        const itemIdsRaw = canteen.itemid || canteen.ItemID;
        const assignedItemIds = itemIdsRaw ? String(itemIdsRaw).split(',').map(s => s.trim()).filter(Boolean) : [];
        
        assignedItemIds.forEach(id => {
            const item = itemsMaster.find(i => String(i.ItemID || i.itemid || i.ItemId) === String(id));
            if(item) uniqueGroups.add(item.ItemGroup || item.itemgroup || 'Normal');
        });

        const counts = canteen.stats?.itemCounts || {};
        Object.entries(counts).forEach(([itemId, count]) => {
            totalServed += count;
            const itemMaster = itemsMaster.find(i => String(i.ItemID || i.itemid || i.ItemId) === String(itemId));
            const name = itemMaster ? (itemMaster.ItemName || itemMaster.itemname || 'Unknown') : 'Unknown';
            itemLeaderboard[name] = (itemLeaderboard[name] || 0) + count;
        });
    });
    
    let topItem = "No Data";
    let topItemCount = 0;
    Object.entries(itemLeaderboard).forEach(([name, count]) => {
        if (count > topItemCount) { topItemCount = count; topItem = name; }
    });

    return { totalServed, topItem, topItemCount, activeGroups: uniqueGroups.size };
  }, [visibleCanteens, itemsMaster]);

  const canteenCards = useMemo(() => {
    return visibleCanteens.map((canteen, index) => {
      
      const maxCap = parseInt(canteen.stats?.maxCapacity) || 0;
      const insideCount = parseInt(canteen.stats?.currentlyInside) || 0;
      let capPercent = maxCap > 0 ? Math.min(Math.round((insideCount / maxCap) * 100), 100) : (insideCount > 0 ? 100 : 0);
      
      let capColor = '#10b981';
      let statusText = 'STABLE FLOW';
      let glowColor = 'rgba(16, 185, 129, 0.15)';
      
      if (capPercent >= 90) { capColor = '#ef4444'; statusText = 'CRITICAL CAPACITY'; glowColor = 'rgba(239, 68, 68, 0.15)'; } 
      else if (capPercent >= 70) { capColor = '#f59e0b'; statusText = 'HIGH VOLUME'; glowColor = 'rgba(245, 158, 11, 0.15)'; }

      const itemIdsRaw = canteen.itemid || canteen.ItemID;
      const assignedItemIds = itemIdsRaw ? String(itemIdsRaw).split(',').map(s => s.trim()).filter(Boolean) : [];
      const assignedItems = itemsMaster.filter(item => assignedItemIds.includes(String(item.ItemID || item.itemid || item.ItemId)));
      
      const groupCounts = {};
      assignedItems.forEach(item => {
          const group = item.ItemGroup || item.itemgroup || item.Itemgroup || 'Other';
          if (!groupCounts[group]) groupCounts[group] = [];
          groupCounts[group].push(item.ItemName || item.itemname || item.itemName);
      });

      return (
        <div 
          key={canteen.id} 
          className="canteen-large-card clickable-card fade-in" 
          onClick={() => navigate(`/canteen/${canteen.id}`)}
          style={{ 
            animationDelay: `${index * 0.05}s`, 
            borderTop: `5px solid ${capColor}`,
            boxShadow: `0 15px 35px -10px ${glowColor}`,
            height: '420px',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          <div className="flex-between" style={{ alignItems: 'flex-start', marginBottom: '25px', gap: '15px' }}>
            <div className="flex-align-center gap-15">
              <div className="canteen-id-box" style={{ color: capColor, background: `${capColor}15`, border: `1px solid ${capColor}40`, flexShrink: 0 }}>
                {index + 1}
              </div>
              <div style={{ minWidth: 0 }}>
                <h3 className="m-0" style={{ fontSize: '1.4rem', fontWeight: '950', letterSpacing: '-0.5px', color: 'var(--text-bold)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{canteen.name}</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                  <span className="live-dot-pulse" style={{ background: capColor, width: '6px', height: '6px' }}></span>
                  <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px' }}>Active Canteen</span>
                </div>
              </div>
            </div>
            
            <div style={{ background: `${capColor}15`, color: capColor, padding: '8px 14px', borderRadius: '10px', fontSize: '0.7rem', fontWeight: '900', letterSpacing: '1px', border: `1px solid ${capColor}30`, whiteSpace: 'nowrap', flexShrink: 0 }}>
              {statusText}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '25px' }}>
            <div className="god-stat-box blue">
              <span className="stat-label">Expected</span>
              <span className="stat-value">{canteen.stats?.totalExpected || 0}</span>
            </div>
            <div className="god-stat-box yellow">
              <span className="stat-label">Inside</span>
              <span className="stat-value">{canteen.stats?.currentlyInside || 0}</span>
            </div>
            <div className="god-stat-box green">
              <span className="stat-label">Completed</span>
              <span className="stat-value">{canteen.stats?.completedLunch || 0}</span>
            </div>
            <div className="god-stat-box red">
              <span className="stat-label">Next Batch</span>
              <span className="stat-value">
                {canteen.stats?.nextBatchCount || 0}
              </span>
            </div>
          </div>

          <div className="bottom-service-section" style={{ marginTop: 'auto' }}>
            <div style={{ marginBottom: '20px' }}>
              <span style={{ fontSize: '0.7rem', fontWeight: '900', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px', display: 'block', marginBottom: '10px' }}>Assigned Menu</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', maxHeight: '65px', overflow: 'hidden' }}>
                  {assignedItemIds.length === 0 ? (
                      <span style={{ fontSize: '0.75rem', color: '#e11d48', fontWeight: '800', background: '#fff1f2', padding: '8px 14px', borderRadius: '8px', border: '1px dashed #fecdd3' }}>
                          🚫 NO ITEMS ASSIGNED
                      </span>
                  ) : (
                      Object.keys(groupCounts).sort().map(group => (
                          <div key={group} className="god-item-pill">
                              <span className="item-group-tag">{group}</span>
                              <span className="item-names-text">
                                  {groupCounts[group].join(', ')}
                              </span>
                          </div>
                      ))
                  )}
              </div>
            </div>

            <div className="flex-between mb-10">
              <span style={{ fontSize: '0.75rem', fontWeight: '900', color: 'var(--text-bold)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Live Occupancy</span>
              <span style={{ fontSize: '1.1rem', fontWeight: '950', color: capColor }}>{canteen.stats?.currentlyInside || 0} <span style={{fontSize:'0.8rem', color:'#94a3b8'}}>/ {maxCap}</span></span>
            </div>
            <div className="progress-bar-bg" style={{ height: '12px', background: 'rgba(0,0,0,0.05)', borderRadius: '20px', overflow: 'hidden' }}>
              <div 
                className="progress-bar-fill" 
                style={{ 
                  width: `${capPercent}%`, 
                  background: `linear-gradient(90deg, ${capColor}80, ${capColor})`,
                  boxShadow: `0 0 15px ${capColor}60`,
                  height: '100%',
                  borderRadius: '20px',
                  position: 'relative'
                }}
              >
                <div className="progress-shimmer"></div>
              </div>
            </div>
          </div>
        </div>
      );
    });
  }, [visibleCanteens, itemsMaster, navigate]);

  const itemCards = useMemo(() => {
    const groupedItems = {};

    itemsMaster.forEach(item => {
        const name = item.ItemName || item.itemname || item.itemName || 'Unknown Item';
        if (!groupedItems[name]) groupedItems[name] = { name, totalCount: 0, instances: [] };
        
        const itemId = item.ItemID || item.itemid || item.ItemId;
        
        visibleCanteens.forEach(canteen => {
            const count = canteen.stats?.itemCounts?.[itemId] || 0;
            const itemIdsRaw = canteen.itemid || canteen.ItemID;
            const assignedItemIds = itemIdsRaw ? String(itemIdsRaw).split(',').map(s => s.trim()).filter(Boolean) : [];
            
            if (assignedItemIds.includes(String(itemId))) {
                groupedItems[name].totalCount += count;
                groupedItems[name].instances.push({
                    ...item,
                    canteenName: canteen.name,
                    servedCount: count
                });
            }
        });
    });

    const sortedGroups = Object.values(groupedItems)
        .filter(g => g.instances.length > 0)
        .sort((a, b) => b.totalCount - a.totalCount);

    const formatTime = (timeStr) => {
        if (!timeStr) return '';
        let [h, m] = String(timeStr).split(':').map(Number);
        const ampm = h >= 12 && h < 24 ? 'PM' : 'AM';
        h = h % 12 || 12;
        return `${h}:${String(m).padStart(2, '0')} ${ampm}`;
    };

    return sortedGroups.map((group, index) => {
        return (
            <div 
                key={group.name} 
                className="canteen-large-card clickable-card fade-in" 
                onClick={() => navigate(`/canteen/${encodeURIComponent(group.name)}/items`)}
                style={{ 
                  animationDelay: `${index * 0.05}s`,
                  height: '420px',
                  display: 'flex',
                  flexDirection: 'column',
                  borderTop: '5px solid #8b5cf6',
                  boxShadow: '0 15px 35px -10px rgba(139, 92, 246, 0.15)'
                }}
            >
                <div className="flex-between" style={{ paddingBottom: '15px', marginBottom: '15px' }}>
                    <div className="flex-align-center gap-15" style={{ minWidth: 0 }}>
                        <div className="canteen-id-box" style={{ width: '46px', height: '46px', fontSize: '1.2rem', background: '#f3e8ff', color: '#7c3aed', flexShrink: 0, border: '1px solid #d8b4fe' }}>🍔</div>
                        <div>
                            <h3 className="m-0" style={{ fontSize: '1.4rem', fontWeight: '950', letterSpacing: '-0.5px', color: 'var(--text-bold)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{group.name}</h3>
                            <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px' }}>Menu Item</span>
                        </div>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
                    <div className="god-stat-box blue" style={{ background: '#f8fafc', borderColor: '#cbd5e1' }}>
                        <span className="stat-label">Active Canteens</span>
                        <span className="stat-value">{group.instances.length}</span>
                    </div>
                    <div className="god-stat-box green" style={{ background: '#f0fdf4', borderColor: '#10b981' }}>
                        <span className="stat-label">Total Consumed</span>
                        <span className="stat-value" style={{ color: '#059669' }}>{group.totalCount}</span>
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto', flex: 1, paddingRight: '5px' }}>
                    {group.instances.sort((a,b) => b.servedCount - a.servedCount).map((instance, idx) => {
                        const count = instance.servedCount;
                        const itemGroup = instance.ItemGroup || instance.itemgroup || instance.Itemgroup || 'Normal';
                        
                        return (
                            <div 
                                key={`${instance.ItemID}-${idx}`} 
                                style={{ 
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
                                    background: '#ffffff', padding: '12px 18px', borderRadius: '14px', 
                                    border: '1px solid #e2e8f0', transition: 'all 0.2s', flexShrink: 0,
                                    boxShadow: '0 2px 5px rgba(0,0,0,0.02)'
                                }}
                            >
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0, flex: 1, marginRight: '15px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span style={{ fontSize: '0.95rem', fontWeight: '900', color: 'var(--text-bold)' }}>{itemGroup}</span>
                                        <span style={{ fontSize: '0.65rem', fontWeight: '800', background: '#f1f5f9', color: '#475569', padding: '3px 8px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>📍 {instance.canteenName}</span>
                                    </div>
                                    <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#94a3b8' }}>
                                        {formatTime(instance.FromTime || instance.fromtime)} - {formatTime(instance.ToTime || instance.totime)}
                                    </span>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0 }}>
                                    <span style={{ fontSize: '0.65rem', fontWeight: '900', color: '#64748b', letterSpacing: '0.5px' }}>SERVED</span>
                                    <span style={{ fontSize: '1.4rem', fontWeight: '950', color: count > 0 ? '#10b981' : '#94a3b8', lineHeight: '1' }}>
                                        {count}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    });
  }, [visibleCanteens, itemsMaster, navigate]);

  // 🚨 NEW: Dynamic Keyframes based on Ticker Direction
  const animationKeyframes = useMemo(() => {
    const isLTR = tickerSettings.tickerDirection === 'ltr';
    const startX = isLTR ? '-50%' : '0%';
    const endX = isLTR ? '0%' : '-50%';
    
    return `
      @keyframes scrollTickerHome { 
        0% { transform: translateX(${startX}); } 
        100% { transform: translateX(${endX}); } 
      }
      @keyframes scrollAlertTicker { 
        0% { transform: translateX(${startX}); } 
        100% { transform: translateX(${endX}); } 
      }
      .ticker-scroll-container:hover .ticker-track { animation-play-state: paused; }
    `;
  }, [tickerSettings.tickerDirection]);

  return (
    <div className="split-layout-wrapper">
      <div className="main-pane-80" style={{ position: 'relative', display: 'flex', flexDirection: 'column', height: '100%', flex: 1, overflow: 'hidden' }}>
        
        <main className="main-scrollable-content fade-in" style={{ paddingBottom: '0px', flex: 1, overflowY: 'auto', height: '100%', display: 'flex', flexDirection: 'column' }}>
          
          <div className="section-header-premium mb-20" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative', zIndex: 100 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <h2 className="section-title m-0" style={{ fontSize: '1.6rem', fontWeight: '900', letterSpacing: '-0.4px', display: 'flex', alignItems: 'center' }}>
                  {selectedDate 
                    ? (viewMode === 'canteen' ? (role === 'admin' ? `Canteens Overview • ${selectedDate}` : `Assigned Canteens • ${selectedDate}`) : `Items Overview • ${selectedDate}`)
                    : (viewMode === 'canteen' ? (role === 'admin' ? "Live Canteens Overview" : "Live Assigned Canteens") : "Live Items Overview")}
                  
                  {extendedStayEmployees.length > 0 && (
                      <button 
                        onClick={() => setShowExtendedStayModal(true)}
                        style={{ 
                          marginLeft: '15px', 
                          background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', 
                          color: 'white', 
                          border: 'none', 
                          borderRadius: '8px', 
                          padding: '6px 14px', 
                          fontSize: '0.8rem', 
                          fontWeight: '800', 
                          cursor: 'pointer', 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '8px', 
                          boxShadow: '0 4px 12px rgba(239, 68, 68, 0.25)',
                          letterSpacing: '0.5px',
                          textTransform: 'uppercase',
                          transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 15px rgba(239, 68, 68, 0.35)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(239, 68, 68, 0.25)'; }}
                      >
                        <span className="live-dot-pulse" style={{ background: 'white', width: '6px', height: '6px' }}></span>
                        {extendedStayEmployees.length} EXTENDED STAY (&gt;{tickerSettings?.overtimeLimit || 30}m)
                      </button>
                  )}
                </h2>
              </div>

              <p className="text-slate" style={{ fontSize: '0.9rem', marginTop: '6px', fontWeight: '600' }}>
                {selectedDate ? `Historical Data for ${selectedDate}` : "Live system status and occupancy."}
              </p>
            </div>
            
            <div className="flex-align-center gap-15">
               <GodCalendar selectedDate={selectedDate} setSelectedDate={setSelectedDate} activeDates={activeDates} />
               <span className="badge info-badge" style={{fontSize: '0.8rem', padding: '10px 24px', fontWeight: '900'}}>
                  {viewMode === 'canteen' ? `TOTAL CANTEENS: ${visibleCanteens.length}` : `TOTAL ITEMS: ${itemCards.length}`}
               </span>
            </div>
          </div>

          <div style={{ 
            position: 'relative', display: 'flex', alignItems: 'center', background: '#0f172a',
            borderRadius: '16px', height: '56px', marginBottom: '30px', overflow: 'hidden',
            border: '1px solid #1e293b', flexShrink: 0
          }}>
            <div style={{
              position: 'absolute', left: 0, zIndex: 10,
              background: 'linear-gradient(90deg, #0f172a 85%, transparent)',
              padding: '0 25px 0 20px', display: 'flex', alignItems: 'center', height: '100%'
            }}>
              <div style={{
                background: '#38bdf8', color: '#0f172a',
                padding: '6px 14px', borderRadius: '8px',
                fontSize: '0.75rem', fontWeight: '900', letterSpacing: '1.5px'
              }}>
                BROADCAST
              </div>
            </div>

            <div className="ticker-scroll-container" style={{
              display: 'flex', whiteSpace: 'nowrap', paddingLeft: '160px', width: '100%'
            }}>
              {/* 🚨 DYNAMIC MAIN TICKER SPEED */}
              <div className="ticker-track" style={{
                display: 'flex', gap: '50px', animation: `scrollTickerHome ${tickerSettings.tickerSpeed || 60}s linear infinite`
              }}>
                {tickerData.length > 0 ? (
                  tickerData.map((item, idx) => (
                    <div key={idx} style={{ color: tickerSettings.tickerColor || '#38bdf8', fontWeight: '800', fontSize: '1.05rem' }}>
                      {item.text}
                    </div>
                  ))
                ) : (
                  <span style={{ color: '#64748b' }}>Awaiting system broadcast signals...</span>
                )}
              </div>
            </div>

            {/* 🚨 DYNAMIC CSS INJECTION */}
            <style dangerouslySetInnerHTML={{ __html: animationKeyframes }} />
            
          </div>
          
          {visibleCanteens.length === 0 ? (
            <div className="no-canteens-premium fade-in" style={{ flex: 1 }}>
              <div className="unauthorized-security-ring"></div>
              <span className="empty-state-badge">{role === 'admin' ? "System Status" : "Security & Compliance"}</span>
              <div className="empty-icon-large">{role === 'admin' ? "🏢" : "🛡️"}</div>
              <h3>{role === 'admin' ? "No Canteens Registered" : "No Canteens Assigned"}</h3>
              <p>
                {role === 'admin' 
                  ? "The system currently has no active canteens. Please proceed to the Canteen Master to onboard your first canteen."
                  : "Your account is currently not linked to any active canteens. Please contact the administrator to assign your clearance."}
              </p>
              <div className="flex-align-center gap-15 mt-30" style={{position: 'relative', zIndex: 10}}>
                {role === 'admin' ? (
                  <button className="btn-primary" onClick={() => navigate('/manage-canteens')}>GO TO CANTEEN MASTER</button>
                ) : (
                  <button className="btn-primary" onClick={() => window.location.reload()}>RE-AUTHENTICATE</button>
                )}
              </div>
            </div>
          ) : (viewMode === 'items' && itemCards.length === 0) ? (
            <div className="no-canteens-premium fade-in" style={{ flex: 1, borderColor: 'rgba(139, 92, 246, 0.2)' }}>
              <div className="unauthorized-security-ring" style={{ borderColor: 'rgba(139, 92, 246, 0.15)' }}></div>
              <span className="empty-state-badge" style={{ background: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6', borderColor: 'rgba(139, 92, 246, 0.2)' }}>Menu Registry</span>
              <div className="empty-icon-large" style={{ filter: 'drop-shadow(0 20px 40px rgba(139, 92, 246, 0.3))' }}>🍔</div>
              <h3>No Items Configured</h3>
              <p>There are currently no menu items mapped to the active canteens.</p>
              {role === 'admin' && (
                  <div className="flex-align-center gap-15 mt-30" style={{ position: 'relative', zIndex: 10 }}>
                    <button className="btn-primary" style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)' }} onClick={() => navigate('/manage-items')}>
                      GO TO ITEM MASTER
                    </button>
                  </div>
              )}
            </div>
          ) : (
            <div className="fade-in" style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))', 
              gap: '30px', 
              width: '100%',
              marginBottom: '30px',
              position: 'relative',
              zIndex: 1
            }} key={`${selectedDate || 'live'}-${viewMode}`}>
              {viewMode === 'canteen' ? canteenCards : itemCards}
            </div>
          )}

        </main>

        {/* 🚨 PREMIUM OVERTIME ALERT TICKER WITH CLEAN RED GRADIENT FADE */}
        {extendedStayEmployees.length > 0 && (
          <div className="fade-in" style={{ 
            position: 'sticky', bottom: '15px', zIndex: 50,
            display: 'flex', alignItems: 'center', 
            background: '#dc2626',
            borderRadius: '16px', height: '60px', overflow: 'hidden', flexShrink: 0,
            border: '1px solid #b91c1c', 
            boxShadow: '0 15px 35px rgba(220, 38, 38, 0.35), inset 0 2px 10px rgba(255,255,255,0.1)', 
            margin: '0 10px'
          }}>

            <div style={{
              position: 'absolute', left: 0, zIndex: 20,
              background: 'linear-gradient(90deg, #dc2626 90%, rgba(220,38,38,0))', 
              padding: '0 30px 0 20px', display: 'flex', alignItems: 'center', height: '100%'
            }}>
              <div style={{
                background: 'linear-gradient(135deg, #020617 0%, #0f172a 100%)', 
                color: '#ffffff', 
                padding: '8px 20px', borderRadius: '10px',
                fontSize: '0.8rem', fontWeight: '950', letterSpacing: '2px',
                display: 'flex', alignItems: 'center', gap: '12px',
                boxShadow: '0 8px 20px rgba(0, 0, 0, 0.4), inset 0 1px 1px rgba(255,255,255,0.2)',
                border: '1px solid #1e293b'
              }}>
                <span className="live-dot-pulse" style={{ background: '#ef4444', width: '8px', height: '8px', boxShadow: '0 0 10px #ef4444' }}></span>
                ACTION REQUIRED
              </div>
            </div>

            <div className="ticker-scroll-container" style={{
              display: 'flex', whiteSpace: 'nowrap', paddingLeft: '270px', width: '100%'
            }}>
              {/* 🚨 DYNAMIC ALERT TICKER SPEED */}
              <div className="ticker-track" style={{
                display: 'flex', gap: '40px', animation: `scrollAlertTicker ${tickerSettings.alertTickerSpeed || 50}s linear infinite`
              }}>
                {[...extendedStayEmployees, ...extendedStayEmployees].map((e, idx) => (
                  <div key={`${e.id}-${idx}`} style={{ 
                    color: '#ffffff', 
                    fontWeight: '800', fontSize: '1.05rem', 
                    display: 'flex', alignItems: 'center', gap: '12px',
                    background: 'rgba(0, 0, 0, 0.15)',
                    padding: '6px 16px', borderRadius: '100px',
                    border: '1px solid rgba(255, 255, 255, 0.1)'
                  }}>
                    <span style={{ fontSize: '1.2rem' }}>⚠️</span>
                    <span style={{ color: '#ffffff', letterSpacing: '0.5px' }}>{e.name}</span>
                    
                    <span style={{ color: 'rgba(255,255,255,0.3)', margin: '0 4px' }}>|</span>
                    
                    <span style={{ color: 'rgba(255,255,255,0.9)', fontSize: '0.95rem', fontWeight: '700' }}>
                      {e.canteenName}
                    </span>
                    
                    <span style={{ color: 'rgba(255,255,255,0.3)', margin: '0 4px' }}>|</span>
                    
                    <span style={{ color: '#fca5a5' }}>
                      {formatMinsToHHMM(e.totalMins)}
                    </span>
                    
                    <span style={{ 
                      background: '#ffffff', color: '#dc2626', 
                      padding: '4px 10px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: '950',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
                    }}>
                      +{formatMinsToHHMM(e.exceededMins)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <aside className="right-pane-20" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
        <div style={{ 
            background: 'white', 
            borderRadius: '24px', 
            padding: '20px 15px', 
            marginBottom: '30px', 
            border: '2px solid #e2e8f0',
            boxShadow: '0 10px 25px rgba(0,0,0,0.03)',
            textAlign: 'center',
            flexShrink: 0
        }}>
            <span style={{ 
              display: 'block', fontSize: '0.7rem', fontWeight: '950', color: '#64748b', 
              letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '15px' 
            }}>
              🔄 Switch Layout View
            </span>
            
            <div style={{ 
              display: 'flex', background: '#f1f5f9', borderRadius: '16px', 
              padding: '6px', position: 'relative', cursor: 'pointer',
              border: '1px solid #e2e8f0'
            }}>
                <div style={{
                    position: 'absolute', top: '6px', bottom: '6px', 
                    left: viewMode === 'canteen' ? '6px' : '50%', 
                    width: 'calc(50% - 6px)',
                    background: viewMode === 'canteen' ? 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)' : 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
                    borderRadius: '12px', transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)', 
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                }}></div>
                
                <button
                  onClick={() => setViewMode('canteen')}
                  style={{ 
                    flex: 1, position: 'relative', zIndex: 1, height: '42px', 
                    background: 'transparent', border: 'none', 
                    color: viewMode === 'canteen' ? 'white' : '#64748b', 
                    fontWeight: '950', fontSize: '0.7rem', letterSpacing: '0.5px',
                    cursor: 'pointer', transition: 'color 0.4s ease' 
                  }}
                >
                  🏢 CANTEEN
                </button>
                
                <button
                  onClick={() => setViewMode('items')}
                  style={{ 
                    flex: 1, position: 'relative', zIndex: 1, height: '42px', 
                    background: 'transparent', border: 'none', 
                    color: viewMode === 'items' ? 'white' : '#64748b', 
                    fontWeight: '950', fontSize: '0.7rem', letterSpacing: '0.5px',
                    cursor: 'pointer', transition: 'color 0.4s ease' 
                  }}
                >
                  🍔 ITEM
                </button>
            </div>
        </div>

        <div className="right-pane-header" style={{ flexShrink: 0 }}>
          <h2 style={{ fontWeight: '900', letterSpacing: '-0.5px' }}>
            {role === 'admin' ? (viewMode === 'items' ? "Menu Overview" : "Canteen Summary") : "My Dashboard"}
          </h2>
          <p style={{marginTop: '8px', fontSize: '0.75rem', fontWeight: '600', opacity: 0.7}}>
            {role === 'admin' 
              ? (viewMode === 'items' ? "Live overview of menu items and consumption." : "Live overview of employee traffic and status.")
              : "Overview of your assigned canteen performance."}
          </p>
        </div>
        
        <div className="global-stats-vertical">
          {viewMode === 'canteen' ? (
              <>
                <PremiumStatCard icon="👥" title="Expected" value={globalData?.stats?.totalExpected || 0} gradient="linear-gradient(135deg, #6366f1 0%, #4338ca 100%)" shadowColor="rgba(99, 102, 241, 0.4)" />
                <PremiumStatCard icon="🕒" title="Inside" value={globalData?.stats?.currentlyInside || 0} gradient="linear-gradient(135deg, #f59e0b 0%, #b45309 100%)" shadowColor="rgba(245, 158, 11, 0.4)" />
                <PremiumStatCard icon="✅" title="Completed" value={globalData?.stats?.completedLunch || 0} gradient="linear-gradient(135deg, #10b981 0%, #047857 100%)" shadowColor="rgba(16, 185, 129, 0.4)" />
                <PremiumStatCard icon="⏳" title="Next Batch" value={globalData?.stats?.nextBatchCount || 0} gradient="linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)" shadowColor="rgba(139, 92, 246, 0.4)" />
              </>
          ) : (
              <>
                <PremiumStatCard icon="🔥" title="Most Popular Item" value={menuStats.topItem} subtitle={`${menuStats.topItemCount} meals served`} valueSize={menuStats.topItem.length > 12 ? '1.8rem' : '2.5rem'} gradient="linear-gradient(135deg, #f43f5e 0%, #be123c 100%)" shadowColor="rgba(225, 29, 72, 0.4)" />
                <PremiumStatCard icon="🍽️" title="Total Meals Served" value={menuStats.totalServed} gradient="linear-gradient(135deg, #10b981 0%, #047857 100%)" shadowColor="rgba(16, 185, 129, 0.4)" />
                <PremiumStatCard icon="🏷️" title="Active Categories" value={menuStats.activeGroups} gradient="linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)" shadowColor="rgba(139, 92, 246, 0.4)" />
              </>
          )}
        </div>
      </aside>

      {showExtendedStayModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(15, 23, 42, 0.75)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)' }}>
            <div className="fade-in" style={{ background: 'white', borderRadius: '24px', width: '900px', maxWidth: '95%', maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.8), 0 0 40px rgba(239,68,68,0.2)', overflow: 'hidden', border: '1px solid #fecaca' }}>
                <div style={{ padding: '20px 25px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)', borderBottom: '1px solid #fca5a5' }}>
                    <div>
                        <h2 style={{ margin: 0, color: '#991b1b', fontSize: '1.4rem', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            ⚠️ Extended Stay Alerts
                        </h2>
                        <p style={{ margin: '5px 0 0 0', color: '#b91c1c', fontSize: '0.85rem', fontWeight: '700' }}>
                            Maximum allowed time in canteen: {tickerSettings?.overtimeLimit || 30} minutes
                        </p>
                    </div>
                    <button onClick={() => setShowExtendedStayModal(false)} style={{ background: '#ef4444', border: 'none', width: '36px', height: '36px', borderRadius: '50%', color: 'white', fontSize: '1.2rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 10px rgba(239,68,68,0.3)', transition: 'transform 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.transform='scale(1.1)'} onMouseLeave={(e) => e.currentTarget.style.transform='scale(1)'}>
                        ✖
                    </button>
                </div>
                <div style={{ padding: '0', overflowY: 'auto', flex: 1, background: '#f8fafc' }}>
                    <table className="modern-table" style={{ margin: 0 }}>
                        <thead>
                            <tr style={{ background: '#f1f5f9' }}>
                                <th style={{ color: '#475569' }}>📍 CANTEEN NAME</th>
                                <th style={{ color: '#475569' }}>🏷️ EMP ID</th>
                                <th style={{ color: '#475569' }}>👤 NAME</th>
                                <th style={{ color: '#475569' }}>📥 IN TIME</th>
                                <th style={{ color: '#475569' }}>⏱️ TOTAL TIME</th>
                                <th style={{ color: '#b91c1c' }}>🚨 EXCEEDED BY</th>
                            </tr>
                        </thead>
                        <tbody>
                            {extendedStayEmployees.map((e, idx) => (
                                <tr key={idx} style={{ background: 'white', borderBottom: '1px solid #f1f5f9' }}>
                                    <td><strong style={{ color: '#334155' }}>{e.canteenName}</strong></td>
                                    <td style={{ color: 'var(--primary)', fontWeight: '900' }}>#{e.id}</td>
                                    <td style={{ fontWeight: '800', color: '#1e293b' }}>{e.name}</td>
                                    <td>
                                      <span className="badge success-badge" style={{fontSize: '0.75rem', fontWeight: '800'}}>
                                          {new Date(e.processedDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                      </span>
                                    </td>
                                    <td><span className="badge info-badge" style={{fontSize: '0.75rem', fontWeight: '800'}}>{formatMinsToHHMM(e.totalMins)}</span></td>
                                    <td>
                                      <span className="badge danger-badge" style={{fontSize: '0.75rem', fontWeight: '900', background: '#fef2f2', border: '1px solid #fca5a5', color: '#b91c1c'}}>
                                        +{formatMinsToHHMM(e.exceededMins)}
                                      </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
      )}

    </div>
  );
}

export default Home;