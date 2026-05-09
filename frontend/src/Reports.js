// src/Reports.js
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import API_BASE_URL from './config';
import * as XLSX from 'xlsx-js-style';

// ==========================================
// 🇮🇳 INDIAN NUMBER & WORDS FORMATTER
// ==========================================
const formatINR = (amount) => {
    return new Intl.NumberFormat('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount);
};

const numberToWordsIndian = (num) => {
    const a = ['','One ','Two ','Three ','Four ', 'Five ','Six ','Seven ','Eight ','Nine ','Ten ','Eleven ','Twelve ','Thirteen ','Fourteen ','Fifteen ','Sixteen ','Seventeen ','Eighteen ','Nineteen '];
    const b = ['', '', 'Twenty','Thirty','Forty','Fifty', 'Sixty','Seventy','Eighty','Ninety'];
    
    let parsedNum = Math.floor(num); 
    if (parsedNum === 0) return 'Zero';
    if ((parsedNum = parsedNum.toString()).length > 9) return 'Overflow';
    
    const n = ('000000000' + parsedNum).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
    if (!n) return;
    
    let str = '';
    str += (n[1] != 0) ? (a[Number(n[1])] || b[n[1][0]] + ' ' + a[n[1][1]]) + 'Crore ' : '';
    str += (n[2] != 0) ? (a[Number(n[2])] || b[n[2][0]] + ' ' + a[n[2][1]]) + 'Lakh ' : '';
    str += (n[3] != 0) ? (a[Number(n[3])] || b[n[3][0]] + ' ' + a[n[3][1]]) + 'Thousand ' : '';
    str += (n[4] != 0) ? (a[Number(n[4])] || b[n[4][0]] + ' ' + a[n[4][1]]) + 'Hundred ' : '';
    str += (n[5] != 0) ? ((str != '') ? 'and ' : '') + (a[Number(n[5])] || b[n[5][0]] + ' ' + a[n[5][1]]) : '';
    
    return str.trim() + ' Rupees';
};

// ==========================================
// 📅 GOD CALENDAR MODULE (FOR REPORTS)
// ==========================================
const ReportsCalendarSelect = ({ value, onChange, options = [], hasDataFn }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClick = (e) => { if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setIsOpen(false); };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const selectedLabel = options.find(opt => String(opt.value) === String(value))?.label;

  return (
    <div className="calendar-selector-wrapper" ref={dropdownRef}>
      <div 
        className={`calendar-selector-custom ${isOpen ? 'open' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        style={{ background: hasDataFn(value) ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'white', color: hasDataFn(value) ? 'white' : 'var(--cal-primary)', boxShadow: hasDataFn(value) ? '0 8px 15px rgba(16, 185, 129, 0.25)' : '0 4px 12px rgba(0,0,0,0.08)', minHeight: '38px' }}
      >
        <span>{selectedLabel}</span><span className="selector-arrow">▼</span>
      </div>
      {isOpen && (
        <div className="calendar-dropdown-list">
          {options.map(opt => {
            const hasData = hasDataFn(opt.value);
            return (
              <div 
                key={opt.value} 
                className={`calendar-dropdown-item ${String(opt.value) === String(value) ? 'selected' : ''} ${hasData ? 'has-data' : ''}`}
                style={{ background: hasData ? '#f0fdf4' : '', color: hasData ? '#10b981' : '' }}
                onClick={() => { onChange(opt.value); setIsOpen(false); }}
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

const ReportsCalendar = ({ label, selectedDate, onDateSelect, activeDates = [] }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [viewDate, setViewDate] = useState(selectedDate ? new Date(selectedDate) : new Date());
  const calendarRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => { if (calendarRef.current && !calendarRef.current.contains(event.target)) setIsOpen(false); };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const calendarData = useMemo(() => {
    const year = viewDate.getFullYear(); const month = viewDate.getMonth();
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();
    
    const days = [];
    for (let i = firstDayOfMonth - 1; i >= 0; i--) { days.push({ day: daysInPrevMonth - i, month: month - 1, year: year, otherMonth: true }); }
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({ day: d, month: month, year: year, dateStr, isActive: activeDates && activeDates.includes(dateStr), isSelected: selectedDate === dateStr, otherMonth: false });
    }
    const remainingSlots = 42 - days.length;
    for (let d = 1; d <= remainingSlots; d++) { days.push({ day: d, month: month + 1, year: year, otherMonth: true }); }
    return days;
  }, [viewDate, selectedDate, activeDates]);

  const changeMonth = (offset) => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + offset, 1));
  const setMonth = (m) => setViewDate(new Date(viewDate.getFullYear(), parseInt(m), 1));
  const setYear = (y) => setViewDate(new Date(parseInt(y), viewDate.getMonth(), 1));

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 11 }, (_, i) => currentYear - 5 + i);
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  const hasDataInYear = (year) => activeDates && activeDates.some(d => d.startsWith(String(year)));
  const hasDataInMonth = (month) => activeDates && activeDates.some(d => d.startsWith(`${viewDate.getFullYear()}-${String(parseInt(month) + 1).padStart(2, '0')}`));

  return (
    <div style={{ position: 'relative', flex: 1 }} ref={calendarRef}>
      <label style={{ fontSize: '0.8rem', fontWeight: '800', marginBottom: '8px', color: '#64748b', display: 'block' }}>{label}</label>
      <div 
        className="manager-input" 
        onClick={() => setIsOpen(!isOpen)}
        style={{ height: '50px', fontSize: '1rem', fontWeight: '700', border: isOpen ? '2px solid var(--primary)' : '1px solid #cbd5e1', borderRadius: '12px', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', background: 'white' }}
      >
        <span style={{ color: selectedDate ? 'var(--text-bold)' : '#94a3b8' }}>{selectedDate || 'Select Date'}</span>
        <span style={{ fontSize: '1.2rem' }}>📅</span>
      </div>

      {isOpen && (
        <div className="calendar-dropdown-container" style={{ top: 'calc(100% + 10px)', right: 'auto', left: 0, zIndex: 100 }}>
          <div className="calendar-header">
            <button className="calendar-nav-btn" onClick={() => changeMonth(-1)}>←</button>
            <div className="calendar-select-group">
              <ReportsCalendarSelect value={viewDate.getMonth()} onChange={setMonth} options={months.map((m, i) => ({ value: i, label: m }))} hasDataFn={hasDataInMonth} />
              <ReportsCalendarSelect value={viewDate.getFullYear()} onChange={setYear} options={years.map(y => ({ value: y, label: y }))} hasDataFn={hasDataInYear} />
            </div>
            <button className="calendar-nav-btn" onClick={() => changeMonth(1)}>→</button>
          </div>
          <div className="calendar-grid">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(d => (<div key={d} className="calendar-day-label">{d}</div>))}
            {calendarData.map((d, i) => (
              <div 
                key={i} 
                className={`calendar-date-cell ${d.otherMonth ? 'other-month' : ''} ${d.isActive ? 'is-active-data' : ''} ${d.isSelected ? 'is-selected' : ''}`}
                onClick={() => {
                  if (!d.otherMonth) { onDateSelect(d.dateStr); setIsOpen(false); } 
                  else { setViewDate(new Date(d.year, d.month, d.day)); }
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


// ==========================================
// 🏢 CANTEEN MULTI-SELECT COMPONENT
// ==========================================
const CanteenMultiSelect = ({ options = [], selectedValues = [], onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => { if (containerRef.current && !containerRef.current.contains(event.target)) setIsOpen(false); };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleOption = (canteenId) => {
    const strId = String(canteenId);
    const updated = selectedValues.includes(strId) ? selectedValues.filter(v => v !== strId) : [...selectedValues, strId];
    onChange(updated);
  };

  const selectAll = (e) => {
      e.stopPropagation();
      onChange(options.map(o => String(o.CanteenID || o.canteenid || o.id)));
  };

  return (
    <div className="custom-select-wrapper" ref={containerRef} style={{ width: '100%', position: 'relative' }}>
      <label style={{ fontSize: '0.8rem', fontWeight: '800', marginBottom: '8px', color: '#64748b', display: 'block' }}>Select Canteens</label>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="manager-input"
        style={{
          minHeight: '50px', height: 'auto', padding: '10px 15px', background: 'white',
          border: isOpen ? '2px solid var(--primary)' : '1px solid #cbd5e1', borderRadius: '12px', 
          display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center', cursor: 'pointer', 
          transition: 'all 0.3s ease', width: '100%', boxSizing: 'border-box'
        }}
      >
        {selectedValues.length === 0 ? (
          <span style={{ color: '#94a3b8', fontSize: '0.9rem', fontWeight: '600' }}>Choose canteens...</span>
        ) : (
          <span style={{ fontSize: '0.9rem', fontWeight: '800', color: 'var(--primary)', letterSpacing: '0.5px' }}>
            🏢 {selectedValues.length} Selected
          </span>
        )}
        <span style={{ marginLeft: 'auto', fontSize: '0.8rem', color: '#94a3b8', transition: 'transform 0.3s', transform: isOpen ? 'rotate(180deg)' : 'none' }}>▼</span>
      </div>

      {isOpen && (
        <div className="fade-in" style={{ 
            position: 'absolute', top: 'calc(100% + 8px)', left: 0, width: '100%', background: 'white', borderRadius: '16px', boxShadow: '0 20px 40px rgba(0,0,0,0.2)', border: '1px solid #e2e8f0', zIndex: 9999, maxHeight: '260px', overflowY: 'auto', padding: '0', boxSizing: 'border-box'
        }}>
          <div style={{ position: 'sticky', top: 0, background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(10px)', display: 'flex', justifyContent: 'space-between', padding: '12px 15px', borderBottom: '1px solid #f1f5f9', zIndex: 2 }}>
            <span onClick={selectAll} style={{ fontSize: '0.75rem', fontWeight: '900', color: 'var(--primary)', cursor: 'pointer' }}>Select All</span>
            <span onClick={(e) => { e.stopPropagation(); onChange([]); }} style={{ fontSize: '0.75rem', fontWeight: '900', color: 'var(--danger)', cursor: 'pointer' }}>Clear All</span>
          </div>
          <div style={{ padding: '8px' }}>
            {options?.map(opt => {
              const optId = opt.CanteenID || opt.canteenid || opt.id;
              const optName = opt.CanteenName || opt.canteenname || opt.name;
              const isSelected = selectedValues.includes(String(optId));

              return (
                <div key={optId} onClick={(e) => { e.stopPropagation(); toggleOption(optId); }} style={{
                    padding: '12px 15px', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', transition: 'all 0.2s', background: isSelected ? '#f0fdf4' : 'transparent', marginBottom: '2px'
                }}>
                  <div style={{ width: '20px', height: '20px', border: isSelected ? '2px solid #10b981' : '2px solid #cbd5e1', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: isSelected ? '#10b981' : 'transparent', flexShrink: 0 }}>
                    {isSelected && <span style={{ color: 'white', fontSize: '0.8rem', fontWeight: '900' }}>✓</span>}
                  </div>
                  <span style={{ fontSize: '0.95rem', fontWeight: isSelected ? '800' : '600', color: isSelected ? '#065f46' : 'var(--text-main)' }}>{optName}</span>
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
// 🏢 PREMIUM MULTI-SELECT COMPONENT
// ==========================================
const PremiumMultiSelect = ({ options = [], selectedValues = [], onChange, placeholder, idKey, labelKey, icon }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => { if (containerRef.current && !containerRef.current.contains(event.target)) setIsOpen(false); };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleOption = (id) => {
    const strId = String(id);
    const updated = selectedValues.includes(strId) ? selectedValues.filter(v => v !== strId) : [...selectedValues, strId];
    onChange(updated);
  };

  const selectAll = (e) => {
      e.stopPropagation();
      onChange(options.map(o => String(o[idKey])));
  };

  return (
    <div className="custom-select-wrapper" ref={containerRef} style={{ width: '100%', position: 'relative' }}>
      <label style={{ fontSize: '0.8rem', fontWeight: '800', marginBottom: '8px', color: '#64748b', display: 'block' }}>{placeholder}</label>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="manager-input"
        style={{
          minHeight: '50px', height: 'auto', padding: '10px 15px', background: 'white',
          border: isOpen ? '2px solid var(--primary)' : '1px solid #cbd5e1', borderRadius: '12px', 
          display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center', cursor: 'pointer', 
          transition: 'all 0.3s ease', width: '100%', boxSizing: 'border-box'
        }}
      >
        {selectedValues.length === 0 ? (
          <span style={{ color: '#94a3b8', fontSize: '0.9rem', fontWeight: '600' }}>Choose options...</span>
        ) : (
          <span style={{ fontSize: '0.9rem', fontWeight: '800', color: 'var(--primary)', letterSpacing: '0.5px' }}>
            {icon} {selectedValues.length} Selected
          </span>
        )}
        <span style={{ marginLeft: 'auto', fontSize: '0.8rem', color: '#94a3b8', transition: 'transform 0.3s', transform: isOpen ? 'rotate(180deg)' : 'none' }}>▼</span>
      </div>

      {isOpen && (
        <div className="fade-in" style={{ 
            position: 'absolute', top: 'calc(100% + 8px)', left: 0, width: '100%', background: 'white', borderRadius: '16px', boxShadow: '0 20px 40px rgba(0,0,0,0.2)', border: '1px solid #e2e8f0', zIndex: 9999, maxHeight: '260px', overflowY: 'auto', padding: '0', boxSizing: 'border-box'
        }}>
          <div style={{ position: 'sticky', top: 0, background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(10px)', display: 'flex', justifyContent: 'space-between', padding: '12px 15px', borderBottom: '1px solid #f1f5f9', zIndex: 2 }}>
            <span onClick={selectAll} style={{ fontSize: '0.75rem', fontWeight: '900', color: 'var(--primary)', cursor: 'pointer' }}>Select All</span>
            <span onClick={(e) => { e.stopPropagation(); onChange([]); }} style={{ fontSize: '0.75rem', fontWeight: '900', color: 'var(--danger)', cursor: 'pointer' }}>Clear All</span>
          </div>
          <div style={{ padding: '8px' }}>
            {options?.map(opt => {
              const optId = opt[idKey];
              const optName = opt[labelKey];
              const isSelected = selectedValues.includes(String(optId));

              return (
                <div key={optId} onClick={(e) => { e.stopPropagation(); toggleOption(optId); }} style={{
                    padding: '12px 15px', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', transition: 'all 0.2s', background: isSelected ? '#f0fdf4' : 'transparent', marginBottom: '2px'
                }}>
                  <div style={{ width: '20px', height: '20px', border: isSelected ? '2px solid #10b981' : '2px solid #cbd5e1', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: isSelected ? '#10b981' : 'transparent', flexShrink: 0 }}>
                    {isSelected && <span style={{ color: 'white', fontSize: '0.8rem', fontWeight: '900' }}>✓</span>}
                  </div>
                  <span style={{ fontSize: '0.95rem', fontWeight: isSelected ? '800' : '600', color: isSelected ? '#065f46' : 'var(--text-main)' }}>{optName}</span>
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
// MAIN REPORTS COMPONENT
// ==========================================
function Reports() {
  const navigate = useNavigate();

  // Core State
  const [activeTab, setActiveTab] = useState('canteen');
  const [canteensList, setCanteensList] = useState([]);
  const [itemsList, setItemsList] = useState([]);
  const [activeDates, setActiveDates] = useState([]);
  const [loading, setLoading] = useState(false);

  // Filter State
  const [dateMode, setDateMode] = useState('day'); 
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  // Specific Tab Selections
  const [selectedCanteens, setSelectedCanteens] = useState([]);
  const [selectedItems, setSelectedItems] = useState([]);
  const [empSearchInput, setEmpSearchInput] = useState('');

  // Results State
  const [rawReportData, setRawReportData] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'inTime', direction: 'asc' });

  // Load initial resources
  useEffect(() => {
    const fetchDependencies = async () => {
      try {
        const token = localStorage.getItem('eatsync_token');
        const authHeaders = { 'Authorization': `Bearer ${token}` };
        const [canteensRes, datesRes, itemsRes] = await Promise.all([
            fetch(`${API_BASE_URL}/api/canteens-list`, { headers: authHeaders }),
            fetch(`${API_BASE_URL}/api/all-active-dates`, { headers: authHeaders }),
            fetch(`${API_BASE_URL}/api/all-items`, { headers: authHeaders })
        ]);
        
        if (canteensRes.ok) {
           const data = await canteensRes.json();
           setCanteensList(Array.isArray(data) ? data : []);
        }
        if (datesRes.ok) {
           const data = await datesRes.json();
           setActiveDates(Array.isArray(data) ? data : []);
        }
        if (itemsRes.ok) {
           const data = await itemsRes.json();
           setItemsList(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        console.error("Failed to load reports dependencies");
      }
    };
    fetchDependencies();
    
    const today = new Date().toISOString().split('T')[0];
    setStartDate(today);
    setEndDate(today);
  }, []);

  const handleDateSelect = (dateStr, type = 'start') => {
      if (!dateStr) return;
      const d = new Date(dateStr);

      if (dateMode === 'day') {
          setStartDate(dateStr); setEndDate(dateStr);
      } else if (dateMode === 'week') {
          setStartDate(dateStr);
          const endD = new Date(d); endD.setDate(d.getDate() + 6);
          setEndDate(endD.toISOString().split('T')[0]);
      } else if (dateMode === 'month') {
          const year = d.getFullYear(); const month = d.getMonth();
          const firstDay = new Date(year, month, 1).toISOString().split('T')[0];
          const lastDay = new Date(year, month + 1, 0).toISOString().split('T')[0];
          setStartDate(firstDay); setEndDate(lastDay);
      } else if (dateMode === 'custom') {
          if (type === 'start') setStartDate(dateStr);
          if (type === 'end') setEndDate(dateStr);
      }
  };

  const handleModeSwitch = (mode) => {
      setDateMode(mode);
      const today = new Date();
      let start = new Date();

      if (mode === 'day') {
          start = today;
          setStartDate(start.toISOString().split('T')[0]); setEndDate(start.toISOString().split('T')[0]);
      } else if (mode === 'week') {
          start.setDate(today.getDate() - 7);
          setStartDate(start.toISOString().split('T')[0]); setEndDate(today.toISOString().split('T')[0]);
      } else if (mode === 'month') {
          const year = today.getFullYear(); const month = today.getMonth();
          const firstDay = new Date(year, month, 1).toISOString().split('T')[0];
          const lastDay = new Date(year, month + 1, 0).toISOString().split('T')[0];
          setStartDate(firstDay); setEndDate(lastDay);
      }
  };

  // ==========================================
  // 🧠 CORE DATA PROCESSOR (CROSS-SHIFT OVERTIME LOGIC)
  // ==========================================
  const processReportData = (rawData, currentTab) => {
      const sorted = [...rawData].sort((a, b) => new Date(a.inTime) - new Date(b.inTime));
      const firstShiftMap = {}; 
      
      return sorted.map(row => {
          const dayKey = `${row.empId}_${row.processedDate}`;
          
          if (!firstShiftMap[dayKey]) {
              firstShiftMap[dayKey] = row.shiftGroup; 
          }
          
          let isOvertime = false;
          
          // 🚨 CRITICAL FIX: Only apply the zero-price overtime logic IF we are on the Employee Summary tab!
          // Canteen and Item Summaries charge full price regardless of shift grouping.
          if (currentTab === 'employee') {
              isOvertime = row.shiftGroup !== firstShiftMap[dayKey];
          }
          
          return {
              ...row,
              isOvertime,
              finalEmpRate: isOvertime ? 0 : parseFloat(row.empRate || 0),
              finalEmployeerRate: isOvertime ? 0 : parseFloat(row.employeerRate || 0),
              finalTotalAmount: isOvertime ? 0 : parseFloat(row.totalAmount || 0)
          };
      });
  };

  const generateReport = async () => {
      if (activeTab === 'canteen' && selectedCanteens.length === 0) { alert("Please select at least one canteen."); return; }
      if (activeTab === 'item' && selectedItems.length === 0) { alert("Please select at least one item."); return; }
      if (!startDate || !endDate) { alert("Please define a valid date range."); return; }

      setLoading(true);
      try {
          const token = localStorage.getItem('eatsync_token');
          const targetCanteens = activeTab === 'canteen' ? selectedCanteens : ["ALL"];

          const res = await fetch(`${API_BASE_URL}/api/reports/canteen-summary`, {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ startDate, endDate, canteenIds: targetCanteens })
          });

          const data = await res.json();
          if (data.success) {
              const processed = processReportData(data.data, activeTab);
              setRawReportData(processed);
          } else {
              alert(`Report Generation Failed: ${data.error}`);
          }
      } catch (err) {
          alert("Network error generating report.");
      } finally {
          setLoading(false);
      }
  };

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const filteredList = useMemo(() => {
      let list = rawReportData;

      if (activeTab === 'item') {
          const selectedItemNames = itemsList.filter(i => selectedItems.includes(String(i.ItemID || i.itemid || i.ItemId))).map(i => String(i.ItemName || i.itemname || i.itemName).trim().toLowerCase());
          list = list.filter(r => selectedItemNames.includes(String(r.itemName).trim().toLowerCase()));
      }

      if (activeTab === 'employee' && empSearchInput) {
          const sq = empSearchInput.toLowerCase();
          list = list.filter(r => String(r.empName).toLowerCase().includes(sq) || String(r.empId).includes(sq));
      }

      if (searchQuery) {
          const sq = searchQuery.toLowerCase();
          list = list.filter(r => 
              (r.empName || '').toLowerCase().includes(sq) || 
              String(r.empId).includes(sq) ||
              (r.canteenName || '').toLowerCase().includes(sq) ||
              (r.itemName || '').toLowerCase().includes(sq) ||
              (r.dept || '').toLowerCase().includes(sq)
          );
      }

      return list.sort((a, b) => {
          let valA = a[sortConfig.key] || ''; let valB = b[sortConfig.key] || '';
          if (sortConfig.key === 'inTime' || sortConfig.key === 'outTime' || sortConfig.key === 'processedDate') {
             valA = new Date(valA).getTime() || 0; valB = new Date(valB).getTime() || 0;
          }
          if (sortConfig.key === 'finalTotalAmount' || sortConfig.key === 'finalEmpRate' || sortConfig.key === 'finalEmployeerRate' || sortConfig.key === 'empId') {
              valA = parseFloat(valA) || 0; valB = parseFloat(valB) || 0;
          }
          if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
          if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
          return 0;
      });
  }, [rawReportData, activeTab, selectedItems, itemsList, empSearchInput, searchQuery, sortConfig]);


  // Calculation Engine
  const totals = useMemo(() => {
      let totalAmount = 0;
      let totalEmpRate = 0;
      let totalEmployeerRate = 0;
      let overtimeMeals = 0;
      let deductedOvertimeValue = 0;
      const itemCounts = {};

      filteredList.forEach(item => {
          totalAmount += item.finalTotalAmount;
          totalEmpRate += item.finalEmpRate;
          totalEmployeerRate += item.finalEmployeerRate;
          
          if (item.isOvertime) {
              overtimeMeals++;
              deductedOvertimeValue += parseFloat(item.totalAmount || 0); 
          }

          const mealName = item.itemName || 'Unknown Meal';
          itemCounts[mealName] = (itemCounts[mealName] || 0) + 1;
      });

      const uniqueItemString = Object.entries(itemCounts).map(([name, count]) => `${name}: ${count}`).join(' | ');

      return { totalAmount, totalEmpRate, totalEmployeerRate, overtimeMeals, deductedOvertimeValue, uniqueItemString };
  }, [filteredList]);

  // ==========================================
  // 📊 EXCEL EXPORT MASTER
  // ==========================================
  const executeExport = () => {
    if (filteredList.length === 0) { alert("No data available to export."); return; }

    const formatTimeForExcel = (isoStr) => {
        if(!isoStr) return '---';
        const d = new Date(isoStr);
        return isNaN(d) ? '---' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    let exportData = [];

    if (activeTab === 'employee') {
        exportData = filteredList.map(r => ({
            'Canteen Name': r.canteenName,
            'Date': r.processedDate,
            'Emp ID': r.empId,
            'Employee Name': r.empName,
            'Shift Group': r.shiftGroup,
            'Meal / Item': r.itemName,
            'In Time': formatTimeForExcel(r.inTime),
            'Out Time': formatTimeForExcel(r.outTime),
            'Emp Rate (₹)': r.finalEmpRate,
            'Employer Rate (₹)': r.finalEmployeerRate,
            'Total (₹)': r.finalTotalAmount,
            'Remarks': r.isOvertime ? 'Overtime (Zeroed)' : 'Standard'
        }));
    } else {
        exportData = filteredList.map(r => ({
            'Canteen Name': r.canteenName,
            'Date': r.processedDate,
            'Emp ID': r.empId,
            'Employee Name': r.empName,
            'Category': r.category,
            'Department': r.dept,
            'Meal / Item Name': r.itemName,
            'In Time': formatTimeForExcel(r.inTime),
            'Out Time': formatTimeForExcel(r.outTime),
            'Amount (₹)': r.finalTotalAmount,
            'Status': r.isOvertime ? 'Overtime' : 'Standard'
        }));
    }

    const titleRows = [
      [`EatSync OS - ${activeTab.toUpperCase()} SUMMARY REPORT`],
      [`Reporting Period: ${startDate} to ${endDate}`],
      [`Generated On: ${new Date().toLocaleString()}`],
      [`Total Meals Consumed: ${filteredList.length} [ ${totals.uniqueItemString} ]`],
      [`Total Revenue: ₹${formatINR(totals.totalAmount)}  (${numberToWordsIndian(totals.totalAmount)})`],
      [`Total Overtime Meals: ${totals.overtimeMeals} (₹${formatINR(totals.deductedOvertimeValue)} Deducted)`],
      [] 
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(titleRows);
    XLSX.utils.sheet_add_json(worksheet, exportData, { origin: "A8" });
    
    const headers = Object.keys(exportData[0]);
    
    // Formatting Top Rows & Centering text
    const alignCenter = { alignment: { horizontal: "center", vertical: "center" } };

    worksheet['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: headers.length - 1 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: headers.length - 1 } },
      { s: { r: 3, c: 0 }, e: { r: 3, c: headers.length - 1 } },
      { s: { r: 4, c: 0 }, e: { r: 4, c: headers.length - 1 } },
      { s: { r: 5, c: 0 }, e: { r: 5, c: headers.length - 1 } }
    ];

    if (worksheet['A1']) worksheet['A1'].s = { font: { bold: true, sz: 14 }, ...alignCenter };
    if (worksheet['A2']) worksheet['A2'].s = { font: { bold: true, color: { rgb: "4F46E5" } }, ...alignCenter };
    if (worksheet['A3']) worksheet['A3'].s = { font: { italic: true }, ...alignCenter };
    if (worksheet['A4']) worksheet['A4'].s = { font: { bold: true, color: { rgb: "10B981" } }, ...alignCenter };
    if (worksheet['A5']) worksheet['A5'].s = { font: { bold: true, color: { rgb: "10B981" } }, ...alignCenter };
    if (worksheet['A6']) worksheet['A6'].s = { font: { bold: true, color: { rgb: "E11D48" } }, ...alignCenter };

    // Format Table Headers
    const range = XLSX.utils.decode_range(worksheet['!ref']);
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cellAddress = XLSX.utils.encode_cell({ r: 7, c: C });
      if (worksheet[cellAddress]) {
        worksheet[cellAddress].s = { font: { bold: true }, fill: { fgColor: { rgb: "F1F5F9" } }, ...alignCenter };
      }
    }

    const colWidths = headers.map(header => {
      let maxLen = header.length;
      exportData.forEach(row => {
        const val = row[header];
        const len = val ? String(val).length : 0;
        if (len > maxLen) maxLen = len;
      });
      return { wch: maxLen + 4 };
    });

    worksheet['!cols'] = colWidths;
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Report");
    XLSX.writeFile(workbook, `EatSync_${activeTab}_Report_${startDate}_to_${endDate}.xlsx`);
  };

  const formatT = (isoStr) => {
      if(!isoStr) return '---';
      const d = new Date(isoStr);
      return isNaN(d) ? '---' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const navTabStyle = (tabName) => ({
      padding: '12px 25px', fontSize: '0.9rem', fontWeight: '900', cursor: 'pointer', borderRadius: '12px', border: 'none', transition: 'all 0.3s',
      background: activeTab === tabName ? 'var(--primary)' : 'transparent', color: activeTab === tabName ? 'white' : '#64748b',
      boxShadow: activeTab === tabName ? '0 10px 20px var(--primary-glow)' : 'none'
  });

  return (
    <div className="main-pane-100">
      <div className="top-navbar premium-alt">
        <div className="navbar-left">
          <div className="global-breadcrumb dark-mode" onClick={() => navigate('/')}>
            <span className="home-icon">🏠</span><span className="breadcrumb-text">Home</span>
          </div>
        </div>
        <div className="navbar-center"><h1 className="m-0" style={{ fontSize: '1.6rem', fontWeight: '800', letterSpacing: '-0.5px' }}>Reports Engine</h1></div>
        <div className="navbar-right"></div>
      </div>

      <main className="main-scrollable-content fade-in" style={{ paddingBottom: '100px' }}>
        
        <div style={{ display: 'flex', gap: '10px', background: 'white', padding: '10px', borderRadius: '16px', border: '1px solid #e2e8f0', marginBottom: '30px', width: 'fit-content', boxShadow: '0 4px 15px rgba(0,0,0,0.02)' }}>
            <button style={navTabStyle('canteen')} onClick={() => { setActiveTab('canteen'); setRawReportData([]); }}>🏢 CANTEEN SUMMARY</button>
            <button style={navTabStyle('item')} onClick={() => { setActiveTab('item'); setRawReportData([]); }}>🍔 ITEM SUMMARY</button>
            <button style={navTabStyle('employee')} onClick={() => { setActiveTab('employee'); setRawReportData([]); }}>👥 EMPLOYEE SUMMARY</button>
        </div>

        {/* 🎛️ SHARED FILTERS HEADER */}
        <div style={{ background: 'white', padding: '25px 30px', borderRadius: '24px', marginBottom: '40px', border: '1px solid #e2e8f0', boxShadow: '0 10px 30px rgba(0,0,0,0.03)' }}>
            <div style={{ marginBottom: '25px' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: '800', color: '#64748b', display: 'block', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '1px' }}>1. Select Period Mode</span>
                <div style={{ display: 'flex', gap: '10px' }}>
                    {['day', 'week', 'month', 'custom'].map(m => (
                        <button 
                            key={m} onClick={() => handleModeSwitch(m)}
                            style={{ padding: '12px 24px', borderRadius: '12px', fontWeight: '800', fontSize: '0.85rem', cursor: 'pointer', transition: 'all 0.2s', textTransform: 'capitalize', border: dateMode === m ? '2px solid var(--primary)' : '1px solid #cbd5e1', background: dateMode === m ? '#f0f9ff' : 'white', color: dateMode === m ? 'var(--primary)' : '#64748b', boxShadow: dateMode === m ? '0 4px 10px rgba(14, 165, 233, 0.15)' : 'none' }}
                        >
                            {m === 'day' ? 'Particular Day' : m === 'week' ? 'Weekly' : m === 'month' ? 'Monthly' : 'Custom Range'}
                        </button>
                    ))}
                </div>
            </div>

            <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: '15px', flex: 2, minWidth: '350px' }}>
                    <ReportsCalendar label={dateMode === 'day' ? 'Select Date' : dateMode === 'week' ? 'Select Week (Starts from)' : dateMode === 'month' ? 'Select Month (Any date)' : 'Start Date'} selectedDate={startDate} onDateSelect={(d) => handleDateSelect(d, 'start')} activeDates={activeDates} />
                    {dateMode === 'custom' && (<ReportsCalendar label="End Date" selectedDate={endDate} onDateSelect={(d) => handleDateSelect(d, 'end')} activeDates={activeDates} />)}
                    {(dateMode === 'week' || dateMode === 'month') && (
                        <div style={{ flex: 1, opacity: 0.7 }}>
                            <label style={{ fontSize: '0.8rem', fontWeight: '800', marginBottom: '8px', color: '#64748b', display: 'block' }}>Auto End Date</label>
                            <div className="manager-input" style={{ height: '50px', fontSize: '1rem', fontWeight: '700', border: '1px dashed #cbd5e1', borderRadius: '12px', width: '100%', display: 'flex', alignItems: 'center', background: '#f8fafc', color: '#94a3b8', padding: '0 15px', cursor: 'not-allowed' }}>{endDate || '---'}</div>
                        </div>
                    )}
                </div>

                {/* Dynamic Configuration based on Tab */}
                <div style={{ flex: 1.5, minWidth: '250px' }}>
                    {activeTab === 'canteen' && (
                        <CanteenMultiSelect options={canteensList} selectedValues={selectedCanteens} onChange={setSelectedCanteens} />
                    )}
                    {activeTab === 'item' && (
                        <PremiumMultiSelect options={itemsList} selectedValues={selectedItems} onChange={setSelectedItems} placeholder="Select Target Items" idKey="ItemID" labelKey="ItemName" icon="🍔" />
                    )}
                    {activeTab === 'employee' && (
                        <div>
                            <label style={{ fontSize: '0.8rem', fontWeight: '800', marginBottom: '8px', color: '#64748b', display: 'block' }}>Target Employee (ID or Name)</label>
                            <input 
                                className="manager-input" 
                                placeholder="E.g., John Doe or 1045..." 
                                value={empSearchInput} 
                                onChange={e => setEmpSearchInput(e.target.value)} 
                                style={{ height: '50px', fontSize: '1rem', fontWeight: '700', border: '1px solid #cbd5e1', borderRadius: '12px', width: '100%' }}
                            />
                        </div>
                    )}
                </div>

                <button className="btn-primary" onClick={generateReport} disabled={loading} style={{ height: '50px', padding: '0 40px', fontSize: '0.95rem', fontWeight: '900', borderRadius: '12px', letterSpacing: '1px', boxShadow: '0 10px 20px var(--primary-glow)', flexShrink: 0 }}>
                    {loading ? '⏳ GENERATING...' : '📊 GENERATE REPORT'}
                </button>
            </div>
        </div>

        {/* 📊 UNIVERSAL RESULTS SECTION */}
        {rawReportData.length > 0 && (
            <div className="table-section mb-60 fade-in">
                <div className="flex-between mb-20 flex-align-center" style={{ background: 'white', padding: '20px 25px', borderRadius: '20px', border: '1px solid #e2e8f0', boxShadow: '0 4px 15px rgba(0,0,0,0.02)' }}>
                    <div>
                        <h2 className="section-title m-0" style={{fontSize: '1.4rem', color: 'var(--text-bold)', fontWeight: '900'}}>📋 {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Report Logs</h2>
                        
                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginTop: '12px', flexWrap: 'wrap' }}>
                           <span style={{ fontSize: '0.8rem', fontWeight: '800', background: '#f1f5f9', color: '#475569', padding: '4px 10px', borderRadius: '8px' }}>Records: {filteredList.length}</span>
                           <span style={{ fontSize: '0.8rem', fontWeight: '900', background: '#ecfdf5', color: '#059669', padding: '4px 10px', borderRadius: '8px' }}>
                               Total Revenue: ₹{formatINR(totals.totalAmount)}
                           </span>
                           {activeTab === 'employee' && (
                               <>
                                   <span style={{ fontSize: '0.8rem', fontWeight: '900', background: '#eff6ff', color: '#1d4ed8', padding: '4px 10px', borderRadius: '8px' }}>
                                       Emp Total: ₹{formatINR(totals.totalEmpRate)}
                                   </span>
                                   <span style={{ fontSize: '0.8rem', fontWeight: '900', background: '#faf5ff', color: '#4338ca', padding: '4px 10px', borderRadius: '8px' }}>
                                       Co. Total: ₹{formatINR(totals.totalEmployeerRate)}
                                   </span>
                               </>
                           )}
                           {activeTab === 'employee' && totals.overtimeMeals > 0 && (
                               <span style={{ fontSize: '0.8rem', fontWeight: '900', background: '#fef2f2', color: '#e11d48', padding: '4px 10px', borderRadius: '8px', border: '1px solid #fca5a5' }}>
                                   ⚠️ Overtime Meals: {totals.overtimeMeals} (-₹{formatINR(totals.deductedOvertimeValue)})
                               </span>
                           )}
                           <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#10b981', fontStyle: 'italic', width: '100%' }}>
                               ({numberToWordsIndian(totals.totalAmount)})
                           </span>
                        </div>
                        
                        <div style={{ marginTop: '10px', fontSize: '0.75rem', fontWeight: '800', color: '#64748b' }}>
                            {totals.uniqueItemString}
                        </div>
                    </div>
                    
                    <div className="flex-align-center gap-15">
                        <div className="search-container-premium">
                            <span style={{ fontSize: '1.2rem', opacity: 0.5 }}>🔍</span>
                            <input className="search-input-premium" placeholder="Filter list..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                        </div>
                        <button className="btn-god-configure" style={{ height: '48px', borderRadius: '12px', margin: 0 }} onClick={executeExport}>
                            <span>📊</span> EXPORT EXCEL
                        </button>
                    </div>
                </div>
                
                <div className="stable-table-container fade-in" style={{ overflowX: 'auto', position: 'relative', borderRadius: '24px', border: '1px solid #e2e8f0', boxShadow: '0 15px 40px rgba(0,0,0,0.04)' }}>
                    <table className="stable-modern-table" style={{ minWidth: '1200px', width: '100%' }}>
                        <thead>
                            <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                                <th onClick={() => handleSort('canteenName')} style={{cursor:'pointer', userSelect: 'none', padding: '20px', color: '#64748b', fontSize: '0.8rem', fontWeight: '900'}}>📍 CANTEEN {sortConfig.key==='canteenName'?'▲':''}</th>
                                <th onClick={() => handleSort('processedDate')} style={{cursor:'pointer', userSelect: 'none', padding: '20px', color: '#64748b', fontSize: '0.8rem', fontWeight: '900'}}>📅 DATE {sortConfig.key==='processedDate'?'▲':''}</th>
                                <th onClick={() => handleSort('empId')} style={{cursor:'pointer', userSelect: 'none', padding: '20px', color: '#64748b', fontSize: '0.8rem', fontWeight: '900'}}>🏷️ EMP ID {sortConfig.key==='empId'?'▲':''}</th>
                                <th onClick={() => handleSort('empName')} style={{cursor:'pointer', userSelect: 'none', padding: '20px', color: '#64748b', fontSize: '0.8rem', fontWeight: '900'}}>👤 NAME {sortConfig.key==='empName'?'▲':''}</th>
                                
                                {activeTab === 'employee' && (
                                    <th onClick={() => handleSort('shiftGroup')} style={{cursor:'pointer', userSelect: 'none', padding: '20px', color: '#64748b', fontSize: '0.8rem', fontWeight: '900'}}>🕒 SHIFT {sortConfig.key==='shiftGroup'?'▲':''}</th>
                                )}
                                
                                <th onClick={() => handleSort('itemName')} style={{cursor:'pointer', userSelect: 'none', padding: '20px', color: '#64748b', fontSize: '0.8rem', fontWeight: '900'}}>🍔 MEAL {sortConfig.key==='itemName'?'▲':''}</th>
                                <th onClick={() => handleSort('inTime')} style={{cursor:'pointer', userSelect: 'none', padding: '20px', color: '#64748b', fontSize: '0.8rem', fontWeight: '900'}}>📥 IN {sortConfig.key==='inTime'?'▲':''}</th>
                                <th onClick={() => handleSort('outTime')} style={{cursor:'pointer', userSelect: 'none', padding: '20px', color: '#64748b', fontSize: '0.8rem', fontWeight: '900'}}>📤 OUT {sortConfig.key==='outTime'?'▲':''}</th>
                                
                                {activeTab === 'employee' && (
                                    <>
                                        <th onClick={() => handleSort('finalEmpRate')} style={{cursor:'pointer', userSelect: 'none', padding: '20px', color: '#64748b', fontSize: '0.8rem', fontWeight: '900'}}>👤 EMP ₹ {sortConfig.key==='finalEmpRate'?'▲':''}</th>
                                        <th onClick={() => handleSort('finalEmployeerRate')} style={{cursor:'pointer', userSelect: 'none', padding: '20px', color: '#64748b', fontSize: '0.8rem', fontWeight: '900'}}>🏢 CO ₹ {sortConfig.key==='finalEmployeerRate'?'▲':''}</th>
                                    </>
                                )}
                                
                                <th onClick={() => handleSort('finalTotalAmount')} style={{cursor:'pointer', userSelect: 'none', padding: '20px', color: '#64748b', fontSize: '0.8rem', fontWeight: '900'}}>💰 TOTAL (₹) {sortConfig.key==='finalTotalAmount'?'▲':''}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredList.map((r, idx) => (
                                <tr key={`${r.empId}-${r.inTime}-${idx}`} style={{ borderBottom: '1px solid #f1f5f9', background: (activeTab === 'employee' && r.isOvertime) ? '#fef2f2' : 'white' }}>
                                    <td style={{fontWeight: '800', color: '#334155', padding: '20px'}}>{r.canteenName}</td>
                                    <td style={{fontSize: '0.85rem', fontWeight: '700', color: '#64748b', padding: '20px'}}>{r.processedDate}</td>
                                    <td style={{ padding: '20px' }}>
                                       <span style={{ background: '#f1f5f9', color: 'var(--primary)', padding: '6px 12px', borderRadius: '8px', fontSize: '0.85rem', fontWeight: '900' }}>#{r.empId}</span>
                                    </td>
                                    <td style={{fontWeight: '800', fontSize: '0.95rem', padding: '20px'}}>{r.empName}</td>
                                    
                                    {activeTab === 'employee' && (
                                        <td style={{ padding: '20px' }}>
                                            <span style={{fontSize: '0.75rem', fontWeight: '800', background: '#f8fafc', color: '#475569', padding: '4px 8px', borderRadius: '6px', border: '1px solid #e2e8f0'}}>
                                                {r.shiftGroup}
                                            </span>
                                        </td>
                                    )}

                                    <td style={{ padding: '20px' }}>
                                        <span style={{fontSize: '0.75rem', fontWeight: '900', background: '#e0e7ff', color: '#4338ca', padding: '6px 10px', borderRadius: '8px'}}>
                                            {r.itemName}
                                        </span>
                                    </td>

                                    <td style={{ padding: '20px' }}>
                                        <span style={{fontSize: '0.75rem', fontWeight: '800', color: '#059669', background: '#d1fae5', padding: '6px 10px', borderRadius: '8px'}}>
                                            {formatT(r.inTime)}
                                        </span>
                                    </td>
                                    <td style={{ padding: '20px' }}>
                                        <span style={{fontSize: '0.75rem', fontWeight: '800', color: '#e11d48', background: '#ffe4e6', padding: '6px 10px', borderRadius: '8px'}}>
                                            {formatT(r.outTime)}
                                        </span>
                                    </td>
                                    
                                    {activeTab === 'employee' && (
                                        <>
                                            <td style={{ padding: '20px' }}><strong style={{color: '#2563eb'}}>₹{formatINR(r.finalEmpRate)}</strong></td>
                                            <td style={{ padding: '20px' }}><strong style={{color: '#4f46e5'}}>₹{formatINR(r.finalEmployeerRate)}</strong></td>
                                        </>
                                    )}

                                    <td style={{ padding: '20px' }}>
                                        {(activeTab === 'employee' && r.isOvertime) ? (
                                            <span style={{fontSize: '0.8rem', fontWeight: '900', color: '#e11d48', background: '#ffe4e6', padding: '4px 8px', borderRadius: '6px', border: '1px solid #fecdd3'}}>
                                                0 (OVERTIME)
                                            </span>
                                        ) : (
                                            <strong style={{color: 'var(--success)', fontSize: '1.1rem'}}>₹{formatINR(r.finalTotalAmount)}</strong>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {filteredList.length === 0 && (
                        <div style={{ padding: '80px', textAlign: 'center', color: '#64748b' }}>
                           <div style={{ fontSize: '4rem', marginBottom: '15px' }}>📭</div>
                           <h3 style={{ fontSize: '1.4rem', color: 'var(--text-bold)', margin: '0 0 10px 0', fontWeight: '800' }}>No Records Found</h3>
                           <p style={{ margin: 0, fontSize: '1rem' }}>Try adjusting your search criteria or date range.</p>
                        </div>
                    )}
                </div>
            </div>
        )}
      </main>
    </div>
  );
}

export default Reports;