// src/Reports.js
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import API_BASE_URL from './config';
import * as XLSX from 'xlsx-js-style';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable'; 
import './Reports.css'; 

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
    if (!n) return '';
    
    let str = '';
    str += (Number(n[1]) !== 0) ? (a[Number(n[1])] || b[n[1][0]] + ' ' + a[n[1][1]]) + 'Crore ' : '';
    str += (Number(n[2]) !== 0) ? (a[Number(n[2])] || b[n[2][0]] + ' ' + a[n[2][1]]) + 'Lakh ' : '';
    str += (Number(n[3]) !== 0) ? (a[Number(n[3])] || b[n[3][0]] + ' ' + a[n[3][1]]) + 'Thousand ' : '';
    str += (Number(n[4]) !== 0) ? (a[Number(n[4])] || b[n[4][0]] + ' ' + a[n[4][1]]) + 'Hundred ' : '';
    str += (Number(n[5]) !== 0) ? ((str !== '') ? 'and ' : '') + (a[Number(n[5])] || b[n[5][0]] + ' ' + a[n[5][1]]) : '';
    
    return str.trim() + ' Rupees Only';
};

const getLocalDateStr = (dateObj) => {
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

// ==========================================
// 📅 CALENDAR MODULE
// ==========================================
const ReportsCalendarSelect = ({ value, onChange, options = [], hasDataFn }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => { 
        if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setIsOpen(false); 
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
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
    <div className="rpt-cal-wrapper" ref={calendarRef}>
      <label className="rpt-label">{label}</label>
      <div 
        className={`rpt-cal-input ${isOpen ? 'open' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span style={{ color: selectedDate ? 'var(--text-bold)' : '#94a3b8' }}>{selectedDate || 'Select Date'}</span>
        <span style={{ fontSize: '1.2rem' }}>📅</span>
      </div>

      {isOpen && (
        <div className="calendar-dropdown-container rpt-cal-dropdown">
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
// 🧑‍💼 LIVE DATABASE EMPMST SEARCH AUTOCOMPLETE 
// ==========================================
const EmployeeSearchSelect = ({ value, onChange }) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setIsOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (query.trim().length === 0) {
            setResults([]);
            return;
        }
        const fetchEmps = async () => {
            setLoading(true);
            try {
                const token = localStorage.getItem('eatsync_token');
                const res = await fetch(`${API_BASE_URL}/api/search-employees?q=${encodeURIComponent(query)}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await res.json();
                if (data.success) setResults(data.data);
            } catch (err) {
                console.error("Employee search failed:", err);
            }
            setLoading(false);
        };
        
        const delay = setTimeout(fetchEmps, 400);
        return () => clearTimeout(delay);
    }, [query]);

    return (
        <div ref={wrapperRef} style={{ position: 'relative' }}>
            <label className="rpt-label">Search Database (Name or ID)</label>
            
            {value ? (
                <div className="rpt-emp-selected fade-in">
                    <span>✅ {value.empName} ({value.empId})</span>
                    <button onClick={() => { onChange(null); setQuery(''); }}>✖</button>
                </div>
            ) : (
                <div style={{ position: 'relative' }}>
                    <span className="rpt-search-icon">🔍</span>
                    <input 
                        className="rpt-search-input" 
                        placeholder="E.g., John Doe or 1045..." 
                        value={query} 
                        onChange={e => { setQuery(e.target.value); setIsOpen(true); }}
                        onFocus={() => setIsOpen(true)}
                    />
                </div>
            )}

            {isOpen && query.length > 0 && !value && (
                <div className="rpt-search-dropdown fade-in">
                    {loading ? (
                        <div className="rpt-search-msg">⏳ Searching Database...</div>
                    ) : results.length > 0 ? (
                        results.map(emp => (
                            <div key={emp.empId} className="rpt-search-item" onClick={() => { onChange(emp); setIsOpen(false); }}>
                                <span className="rpt-search-name">{emp.empName}</span>
                                <span className="rpt-search-id">Emp ID: {emp.empId}</span>
                            </div>
                        ))
                    ) : (
                        <div className="rpt-search-msg error">❌ No employees found.</div>
                    )}
                </div>
            )}
        </div>
    );
};

// ==========================================
// 🏢 CANTEEN MULTI-SELECT 
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
      <label className="rpt-label">Select Canteens</label>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className={`rpt-multi-input ${isOpen ? 'open' : ''}`}
      >
        {selectedValues.length === 0 ? (
          <span className="rpt-multi-placeholder">Choose canteens...</span>
        ) : (
          <span className="rpt-multi-count">🏢 {selectedValues.length} Selected</span>
        )}
        <span className={`rpt-multi-arrow ${isOpen ? 'open' : ''}`}>▼</span>
      </div>

      {isOpen && (
        <div className="rpt-multi-dropdown fade-in">
          <div className="rpt-multi-header">
            <span onClick={selectAll} className="rpt-multi-action">Select All</span>
            <span onClick={(e) => { e.stopPropagation(); onChange([]); }} className="rpt-multi-action danger">Clear All</span>
          </div>
          <div style={{ padding: '8px' }}>
            {options?.map(opt => {
              const optId = opt.CanteenID || opt.canteenid || opt.id;
              const optName = opt.CanteenName || opt.canteenname || opt.name;
              const isSelected = selectedValues.includes(String(optId));

              return (
                <div key={optId} className={`rpt-multi-item ${isSelected ? 'selected' : ''}`} onClick={(e) => { e.stopPropagation(); toggleOption(optId); }}>
                  <div className={`rpt-multi-checkbox ${isSelected ? 'checked' : ''}`}>
                    {isSelected && <span>✓</span>}
                  </div>
                  <span className="rpt-multi-name">{optName}</span>
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
// 🍔 HIERARCHICAL ITEM MULTI-SELECT
// ==========================================
const GroupedItemSelect = ({ options = [], selectedValues = [], onChange }) => {
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
      onChange(options.map(o => String(o.ItemID || o.itemid || o.ItemId)));
  };

  const groupedData = useMemo(() => {
      const groups = {};
      options.forEach(opt => {
          const sg = opt.ShiftGroup || opt.shiftGroup || opt.shiftgroup || 'Unassigned Shift';
          const ig = opt.ItemGroup || opt.itemgroup || opt.Itemgroup || 'Unassigned Group';
          if (!groups[sg]) groups[sg] = {};
          if (!groups[sg][ig]) groups[sg][ig] = [];
          groups[sg][ig].push(opt);
      });
      return groups;
  }, [options]);

  return (
    <div className="custom-select-wrapper" ref={containerRef} style={{ width: '100%', position: 'relative' }}>
      <label className="rpt-label">Select Target Items</label>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className={`rpt-multi-input ${isOpen ? 'open' : ''}`}
      >
        {selectedValues.length === 0 ? (
          <span className="rpt-multi-placeholder">Choose items...</span>
        ) : (
          <span className="rpt-multi-count">🍔 {selectedValues.length} Selected</span>
        )}
        <span className={`rpt-multi-arrow ${isOpen ? 'open' : ''}`}>▼</span>
      </div>

      {isOpen && (
        <div className="rpt-multi-dropdown fade-in" style={{ maxHeight: '350px' }}>
          <div className="rpt-multi-header">
            <span onClick={selectAll} className="rpt-multi-action">Select All</span>
            <span onClick={(e) => { e.stopPropagation(); onChange([]); }} className="rpt-multi-action danger">Clear All</span>
          </div>

          <div style={{ padding: '8px' }}>
             {Object.keys(groupedData).sort().map(sg => (
                <div key={sg} style={{ marginBottom: '10px' }}>
                   <div className="rpt-group-header">🕒 {sg}</div>
                   
                   {Object.keys(groupedData[sg]).sort().map(ig => (
                       <div key={ig} style={{ paddingLeft: '10px', marginBottom: '8px' }}>
                           <div className="rpt-subgroup-header">📁 {ig}</div>
                           
                           {groupedData[sg][ig].map(opt => {
                               const optId = String(opt.ItemID || opt.itemid || opt.ItemId);
                               const optName = opt.ItemName || opt.itemname || opt.itemName;
                               const isSelected = selectedValues.includes(optId);

                               return (
                                  <div key={optId} className={`rpt-multi-item ${isSelected ? 'selected' : ''}`} onClick={(e) => { e.stopPropagation(); toggleOption(optId); }}>
                                    <div className={`rpt-multi-checkbox ${isSelected ? 'checked' : ''}`}>
                                      {isSelected && <span>✓</span>}
                                    </div>
                                    <span className="rpt-multi-name">{optName}</span>
                                  </div>
                               );
                           })}
                       </div>
                   ))}
                </div>
             ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ==========================================
// MAIN REPORTS COMPONENT
// ==========================================
function Reports({ role }) {
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
  const [selectedEmployee, setSelectedEmployee] = useState(null);

  // Results State
  const [rawReportData, setRawReportData] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  const getAuthHeaders = useCallback(() => {
    const token = localStorage.getItem('eatsync_token');
    return { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
  }, []);

  // Load initial resources
  useEffect(() => {
    if (role !== 'admin') {
      navigate('/');
      return;
    }

    const fetchDependencies = async () => {
      try {
        const authHeaders = getAuthHeaders();
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
    
    const todayStr = getLocalDateStr(new Date());
    setStartDate(todayStr);
    setEndDate(todayStr);
  }, [role, navigate, getAuthHeaders]);

  const handleDateSelect = (dateStr, type = 'start') => {
      if (!dateStr) return;
      const [year, month, day] = dateStr.split('-').map(Number);

      if (dateMode === 'day') {
          setStartDate(dateStr); setEndDate(dateStr);
      } else if (dateMode === 'week') {
          setStartDate(dateStr);
          const endD = new Date(year, month - 1, day + 6);
          setEndDate(getLocalDateStr(endD));
      } else if (dateMode === 'month') {
          const firstDay = new Date(year, month - 1, 1);
          const lastDay = new Date(year, month, 0);
          setStartDate(getLocalDateStr(firstDay)); setEndDate(getLocalDateStr(lastDay));
      } else if (dateMode === 'custom') {
          if (type === 'start') setStartDate(dateStr);
          if (type === 'end') setEndDate(dateStr);
      }
  };

  const handleModeSwitch = (mode) => {
      setDateMode(mode);
      const today = new Date();
      const year = today.getFullYear();
      const month = today.getMonth();
      const day = today.getDate();

      if (mode === 'day') {
          const todayStr = getLocalDateStr(today);
          setStartDate(todayStr); setEndDate(todayStr);
      } else if (mode === 'week') {
          const start = new Date(year, month, day - 7);
          setStartDate(getLocalDateStr(start)); setEndDate(getLocalDateStr(today));
      } else if (mode === 'month') {
          const firstDay = new Date(year, month, 1);
          const lastDay = new Date(year, month + 1, 0);
          setStartDate(getLocalDateStr(firstDay)); setEndDate(getLocalDateStr(lastDay));
      }
  };

  const shiftPeriod = (direction) => {
      if (!startDate) return;
      const [year, month, day] = startDate.split('-').map(Number);
      const d = new Date(year, month - 1, day);
      
      if (dateMode === 'month') {
          d.setMonth(d.getMonth() + direction);
      } else if (dateMode === 'week') {
          d.setDate(d.getDate() + (direction * 7));
      } else if (dateMode === 'day') {
          d.setDate(d.getDate() + direction);
      }
      handleDateSelect(getLocalDateStr(d), 'start');
  };

  const processReportData = (rawData, currentTab) => {
      const sorted = [...rawData].sort((a, b) => new Date(a.inTime) - new Date(b.inTime));
      const firstShiftMap = {}; 
      const empPrevMeal = {}; 
      
      return sorted.map(row => {
          const dayKey = `${row.empId}_${row.processedDate}`;
          
          if (!firstShiftMap[dayKey]) {
              firstShiftMap[dayKey] = row.shiftGroup; 
          }
          
          let isOvertime = false;
          if (currentTab === 'employee' || currentTab === 'deduction') {
              isOvertime = row.shiftGroup !== firstShiftMap[dayKey];
          }

          let isMorningZero = false;
          const prev = empPrevMeal[row.empId];
          if (prev) {
             const prevIsNight = String(prev.shiftGroup).toLowerCase().includes('night');
             const currIsMorning = String(row.shiftGroup).toLowerCase().includes('morning');
             const timeDiffHours = (new Date(row.inTime) - new Date(prev.inTime)) / (1000 * 60 * 60);
             
             if (prevIsNight && currIsMorning && timeDiffHours > 0 && timeDiffHours <= 16) {
                 isMorningZero = true;
             }
          }
          empPrevMeal[row.empId] = row;
          
          return {
              ...row,
              isOvertime,
              isMorningZero,
              finalEmpRate: (isOvertime || isMorningZero) ? 0 : parseFloat(row.empRate || 0),
              finalEmployeerRate: (isOvertime || isMorningZero) ? 0 : parseFloat(row.employeerRate || 0),
              finalTotalAmount: (isOvertime || isMorningZero) ? 0 : parseFloat(row.totalAmount || 0)
          };
      });
  };

  const generateReport = async () => {
      if (activeTab === 'canteen' && selectedCanteens.length === 0) { alert("Please select at least one canteen."); return; }
      if (activeTab === 'item' && selectedItems.length === 0) { alert("Please select at least one item."); return; }
      if (activeTab === 'employee' && !selectedEmployee) { alert("Please search and select an employee from the database first."); return; }
      if (!startDate || !endDate) { alert("Please define a valid date range."); return; }

      setLoading(true);
      try {
          const token = localStorage.getItem('eatsync_token');
          const targetCanteens = (activeTab === 'canteen' || activeTab === 'deduction') && selectedCanteens.length > 0 ? selectedCanteens : ["ALL"];

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

  const filteredList = useMemo(() => {
      let list = rawReportData;

      if (activeTab === 'item' || activeTab === 'deduction') {
          if (selectedItems.length > 0) {
              const selectedItemObjs = itemsList.filter(i => selectedItems.includes(String(i.ItemID || i.itemid || i.ItemId)));
              list = list.filter(r => {
                  const rName = String(r.itemName).trim().toLowerCase();
                  const rPrice = parseFloat(r.totalAmount || 0); 
                  
                  return selectedItemObjs.some(i => {
                      const iName = String(i.ItemName || i.itemname || i.itemName).trim().toLowerCase();
                      const iPrice = parseFloat(i.EmpRate || i.emprate || 0) + parseFloat(i.EmployeerRate || i.employeerrate || i.employerRate || 0);
                      return rName === iName && Math.abs(rPrice - iPrice) < 0.01;
                  });
              });
          } else if (activeTab === 'item') {
             list = [];
          }
      }

      if (activeTab === 'employee' && selectedEmployee) {
          const sq = String(selectedEmployee.empId).toLowerCase();
          list = list.filter(r => String(r.empId).toLowerCase() === sq);
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

      return list.sort((a, b) => new Date(a.inTime).getTime() - new Date(b.inTime).getTime());
  }, [rawReportData, activeTab, selectedItems, itemsList, selectedEmployee, searchQuery]);

  const totals = useMemo(() => {
      let totalAmount = 0; let totalEmpRate = 0; let totalEmployeerRate = 0; let overtimeMeals = 0; let deductedOvertimeValue = 0;
      let totalBaseEmpRate = 0;
      const itemBreakdown = {};

      filteredList.forEach(item => {
          totalAmount += item.finalTotalAmount;
          totalEmpRate += item.finalEmpRate;
          totalEmployeerRate += item.finalEmployeerRate;
          totalBaseEmpRate += parseFloat(item.empRate || 0);
          
          if (item.isOvertime || item.isMorningZero) {
              overtimeMeals++;
              deductedOvertimeValue += parseFloat(item.totalAmount || 0); 
          }

          const mealName = item.itemName || 'Unknown Meal';
          const basePrice = parseFloat(item.totalAmount || 0); 
          const empRate = parseFloat(item.empRate || 0);
          const employeerRate = parseFloat(item.employeerRate || 0);
          
          const key = `${mealName}_${basePrice}_${item.isOvertime}_${item.isMorningZero}`;

          if (!itemBreakdown[key]) {
              itemBreakdown[key] = { 
                  name: mealName, count: 0, revenue: 0, unitPrice: basePrice, 
                  empRate: empRate, employeerRate: employeerRate, isOvertime: item.isOvertime, isMorningZero: item.isMorningZero
              };
          }
          itemBreakdown[key].count += 1;
          itemBreakdown[key].revenue += item.finalTotalAmount;
      });

      const totalEmpWaved = totalBaseEmpRate - totalEmpRate;

      return { totalAmount, totalEmpRate, totalEmployeerRate, overtimeMeals, deductedOvertimeValue, itemBreakdown, totalBaseEmpRate, totalEmpWaved };
  }, [filteredList]);

  // ==========================================
  // 🧾 GOD LEVEL PDF BILL GENERATOR (A4 Strict Portrait)
  // ==========================================
  const generatePDFBill = () => {
    if (filteredList.length === 0) { alert("No data available to generate bill."); return; }

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let yPos = 0;

    // --- 1. BILL HEADER ---
    doc.setFillColor(15, 23, 42); 
    doc.rect(0, 0, pageWidth, 28, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    let titleStr = `EATSYNC OS - ${activeTab.toUpperCase()} REPORT`;
    if (activeTab === 'employee' && selectedEmployee) titleStr = `EATSYNC OS - EMPLOYEE REPORT`;
    if (activeTab === 'deduction') titleStr = `EATSYNC OS - EMPLOYEE DEDUCTION REPORT`;
    doc.text(titleStr, 15, 18);

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, pageWidth - 15, 18, { align: "right" });

    yPos = 35;

    // --- 2. REPORT DETAILS & 'TO:' FIELD ---
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    
    if (activeTab === 'employee' && selectedEmployee) {
        doc.text(`Employee: ${selectedEmployee.empName} (ID: ${selectedEmployee.empId})`, 15, yPos);
        yPos += 10;
    } else {
        doc.text("To: _________________________________", 15, yPos);
        yPos += 10;
    }

    doc.text("REPORTING PERIOD:", 15, yPos);
    doc.setFont("helvetica", "normal");
    doc.text(`${startDate}  to  ${endDate}`, 60, yPos);
    yPos += 10;

    // --- 3. DATA TABLES ---
    let head = [];
    let body = [];

    const formatTimeForPDF = (isoStr) => {
        if(!isoStr) return '---';
        const d = new Date(isoStr);
        return isNaN(d) ? '---' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    if (activeTab === 'canteen') {
        head = [['Canteen', 'Item Name', 'Qty', 'Unit (Rs.)', 'Total (Rs.)']];
        const canteenMap = {};
        filteredList.forEach(r => {
            if (!canteenMap[r.canteenName]) canteenMap[r.canteenName] = {};
            const itemName = r.itemName || 'Unknown Item';
            if (!canteenMap[r.canteenName][itemName]) {
                const unitPrice = parseFloat(r.totalAmount || 0);
                canteenMap[r.canteenName][itemName] = { qty: 0, price: unitPrice, total: 0 };
            }
            canteenMap[r.canteenName][itemName].qty += 1;
            canteenMap[r.canteenName][itemName].total += r.finalTotalAmount;
        });
        Object.entries(canteenMap).forEach(([cName, items]) => {
            Object.entries(items).forEach(([iName, data]) => {
                body.push([cName, iName, data.qty.toString(), data.price.toFixed(2), data.total.toFixed(2)]);
            });
        });
    } else if (activeTab === 'item') {
        head = [['Item', 'Group', 'Shift', 'Qty', 'Unit (Rs.)', 'Total (Rs.)']];
        const itemMap = {};
        filteredList.forEach(r => {
            const itemObj = itemsList.find(i => {
                const iName = String(i.ItemName || i.itemname || i.itemName).trim().toLowerCase();
                const iPrice = parseFloat(i.EmpRate || i.emprate || 0) + parseFloat(i.EmployeerRate || i.employeerrate || i.employerRate || 0);
                return iName === String(r.itemName).trim().toLowerCase() && Math.abs(iPrice - parseFloat(r.totalAmount || 0)) < 0.01;
            });
            const sg = itemObj ? (itemObj.ShiftGroup || itemObj.shiftGroup || 'Unassigned') : 'Unassigned';
            const ig = itemObj ? (itemObj.ItemGroup || itemObj.itemgroup || 'Unassigned') : 'Unassigned';
            const key = `${sg}_${ig}_${r.itemName}_${r.totalAmount}`;
            
            if (!itemMap[key]) {
                itemMap[key] = { sg, ig, name: r.itemName, qty: 0, price: parseFloat(r.totalAmount || 0), total: 0 };
            }
            itemMap[key].qty += 1;
            itemMap[key].total += r.finalTotalAmount;
        });
        const sortedItems = Object.values(itemMap).sort((a, b) => a.name.localeCompare(b.name) || a.sg.localeCompare(b.sg));
        body = sortedItems.map(i => [i.name, i.ig, i.sg, i.qty.toString(), i.price.toFixed(2), i.total.toFixed(2)]);
    } else if (activeTab === 'employee') {
        head = [['Date', 'Shift', 'Meal / Item', 'In', 'Emp Rs.', 'Co Rs.', 'Total Rs.']];
        let dataForPDF = [...filteredList];
        dataForPDF.sort((a, b) => new Date(a.inTime).getTime() - new Date(b.inTime).getTime());
        body = dataForPDF.map(r => [
            r.processedDate,
            r.shiftGroup,
            r.isOvertime ? `[OVR] ${r.itemName}` : (r.isMorningZero ? `[DED] ${r.itemName}` : r.itemName),
            formatTimeForPDF(r.inTime),
            r.finalEmpRate.toFixed(2),
            r.finalEmployeerRate.toFixed(2),
            r.finalTotalAmount.toFixed(2)
        ]);
    } else if (activeTab === 'deduction') {
        head = [['Emp ID', 'Employee Name', 'Total Meals (Qty | Rs.)', 'Overtime Deductions (Rs.)', 'Final Total (Rs.)']];
        const empMap = {};
        filteredList.forEach(r => {
            const empKey = `${r.empName}_${r.empId}`;
            if (!empMap[empKey]) {
                empMap[empKey] = { empId: r.empId, empName: r.empName, totalQty: 0, totalMealPrice: 0, overtimeDed: 0, finalTotal: 0 };
            }
            const base = parseFloat(r.empRate || 0);
            const final = r.finalEmpRate;
            const ded = base - final;

            empMap[empKey].totalQty += 1;
            empMap[empKey].totalMealPrice += base;
            empMap[empKey].overtimeDed += ded;
            empMap[empKey].finalTotal += final;
        });
        body = Object.values(empMap)
            .sort((a,b) => a.empName.localeCompare(b.empName))
            .map(emp => [
                emp.empId,
                emp.empName,
                `${emp.totalQty} | ${emp.totalMealPrice.toFixed(2)}`,
                emp.overtimeDed.toFixed(2),
                emp.finalTotal.toFixed(2)
            ]);
    }

    autoTable(doc, {
        startY: yPos,
        head: head,
        body: body,
        theme: 'grid',
        tableWidth: 'auto', 
        margin: { left: 10, right: 10 },
        headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: 'bold', fontSize: 7 }, 
        alternateRowStyles: { fillColor: [248, 250, 252] }, 
        styles: { fontSize: 7, cellPadding: 2, textColor: [15, 23, 42] }
    });

    yPos = doc.lastAutoTable.finalY + 10;

    // --- 4. GRAND TOTALS SUMMARY BOX ---
    let boxHeight = 20; 
    if (activeTab === 'employee' || activeTab === 'deduction') {
        boxHeight = 35; // Larger box to accommodate extra summary lines
    }
    
    if (yPos + boxHeight > pageHeight - 40) {
        doc.addPage();
        yPos = 20;
    }

    doc.setDrawColor(203, 213, 225); 
    doc.setFillColor(248, 250, 252); 
    doc.roundedRect(10, yPos, pageWidth - 20, boxHeight, 3, 3, 'FD');

    let textY = yPos + 10;

    if (activeTab === 'employee' || activeTab === 'deduction') {
        const baseAmt = activeTab === 'deduction' ? totals.totalBaseEmpRate : (totals.totalAmount + totals.deductedOvertimeValue);
        const dedAmt = activeTab === 'deduction' ? totals.totalEmpWaved : totals.deductedOvertimeValue;
        const finalAmt = activeTab === 'deduction' ? totals.totalEmpRate : totals.totalAmount;

        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(15, 23, 42);
        doc.text("TOTAL BASE AMOUNT:", 15, textY);
        doc.text(`Rs. ${formatINR(baseAmt)}`, pageWidth - 15, textY, { align: "right" });

        textY += 6;
        doc.setTextColor(220, 38, 38);
        doc.text("DEDUCTED AMOUNT:", 15, textY);
        doc.text(`- Rs. ${formatINR(dedAmt)}`, pageWidth - 15, textY, { align: "right" });

        textY += 6;
        doc.setDrawColor(203, 213, 225);
        doc.line(15, textY - 2, pageWidth - 15, textY - 2);
        textY += 4;

        doc.setFontSize(11);
        doc.setTextColor(15, 23, 42);
        doc.text("FINAL GRAND TOTAL:", 15, textY);

        doc.setFontSize(12);
        doc.setTextColor(16, 185, 129);
        doc.text(`Rs. ${formatINR(finalAmt)} (${numberToWordsIndian(finalAmt).replace('Rupees Only', 'INR')})`, pageWidth - 15, textY, { align: "right" });
    } else {
        textY += 2;
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(15, 23, 42);
        doc.text("GRAND TOTAL AMOUNT:", 15, textY);
        
        const grandTotalAmount = totals.totalAmount;

        doc.setFontSize(12);
        doc.setTextColor(16, 185, 129); 
        doc.text(`Rs. ${formatINR(grandTotalAmount)} (${numberToWordsIndian(grandTotalAmount).replace('Rupees Only', 'INR')})`, pageWidth - 15, textY, { align: "right" });
    }
    
    // --- 5. AUTHORIZED SIGNATURE ---
    yPos += boxHeight + 40; 
    
    if (yPos > pageHeight - 15) {
        doc.addPage();
        yPos = 30;
    }
    
    doc.setFontSize(10);
    doc.setTextColor(50, 50, 50);
    doc.setFont("helvetica", "bold");
    
    doc.text("Prepared By", 20, yPos);
    doc.text("Approved By", pageWidth / 2, yPos, { align: "center" });
    doc.text("Authorized Signatory", pageWidth - 20, yPos, { align: "right" });

    // --- 6. PAGE NUMBERS ---
    const pageCount = doc.internal.getNumberOfPages();
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    for(let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.text(`Page ${i} of ${pageCount}`, pageWidth / 2, pageHeight - 8, { align: 'center' });
    }

    doc.save(`EatSync_Bill_${activeTab}_${startDate}.pdf`);
  };

  // ==========================================
  // 📊 GOD LEVEL EXCEL EXPORT
  // ==========================================
  const executeExport = () => {
    if (filteredList.length === 0) { alert("No data available to export."); return; }

    const formatTimeForExcel = (isoStr) => {
        if(!isoStr) return '---';
        const d = new Date(isoStr);
        return isNaN(d) ? '---' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    let dataForExcel = [...filteredList];
    if (activeTab === 'employee' || activeTab === 'deduction') {
        dataForExcel.sort((a, b) => {
            const empCmp = String(a.empName || '').localeCompare(String(b.empName || ''));
            if (empCmp !== 0) return empCmp;
            return new Date(a.inTime).getTime() - new Date(b.inTime).getTime();
        });
    }

    let exportData = [];

    if (activeTab === 'employee') {
        exportData = dataForExcel.map(r => ({
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
            'Remarks': r.isOvertime ? 'Overtime (Zeroed)' : (r.isMorningZero ? 'Morning Deducted' : 'Standard')
        }));

        exportData.push({
            'Canteen Name': 'TOTAL',
            'Date': '', 'Emp ID': '', 'Employee Name': '', 'Shift Group': '', 'Meal / Item': '', 'In Time': '', 'Out Time': '',
            'Emp Rate (₹)': totals.totalEmpRate,
            'Employer Rate (₹)': totals.totalEmployeerRate,
            'Total (₹)': totals.totalAmount,
            'Remarks': ''
        });

    } else if (activeTab === 'deduction') {
        // 🟢 PIVOT MATRIX GENERATION FOR DEDUCTION REPORT
        const empPivot = {};
        const dynamicCols = new Set();
        
        dataForExcel.forEach(r => {
            const empKey = `${r.empName}_${r.empId}`;
            if (!empPivot[empKey]) {
                empPivot[empKey] = {
                    empId: r.empId,
                    empName: r.empName,
                    items: {},
                    totalQty: 0,
                    totalDed: 0,
                    finalTotal: 0
                };
            }
            
            const matchedItem = itemsList.find(i => {
                const iName = String(i.ItemName || i.itemname || i.itemName).trim().toLowerCase();
                const iPrice = parseFloat(i.EmpRate || i.emprate || 0) + parseFloat(i.EmployeerRate || i.employeerrate || i.employerRate || 0);
                return iName === String(r.itemName).trim().toLowerCase() && Math.abs(iPrice - parseFloat(r.totalAmount || 0)) < 0.01;
            });
            const itemGroup = matchedItem ? (matchedItem.ItemGroup || matchedItem.itemgroup || 'Normal') : 'Normal';
            
            const colName = `${r.itemName} [${itemGroup}]`;
            dynamicCols.add(colName);
            
            if (!empPivot[empKey].items[colName]) {
                empPivot[empKey].items[colName] = { qty: 0, price: 0 };
            }
            
            const base = parseFloat(r.empRate || 0);
            const final = r.finalEmpRate;
            const ded = base - final;
            
            empPivot[empKey].items[colName].qty += 1;
            empPivot[empKey].items[colName].price += final; // Add final emp rate
            
            empPivot[empKey].totalQty += 1;
            empPivot[empKey].totalDed += ded;
            empPivot[empKey].finalTotal += final;
        });
        
        const sortedCols = Array.from(dynamicCols).sort();
        const pivotArray = Object.values(empPivot).sort((a,b) => a.empName.localeCompare(b.empName));
        
        exportData = pivotArray.map(emp => {
            const row = {
                'Emp ID': emp.empId,
                'Employee Name': emp.empName
            };
            sortedCols.forEach(col => {
                if (emp.items[col]) {
                    row[col] = `${emp.items[col].qty} Qty | ₹  ${formatINR(emp.items[col].price)}`;
                } else {
                    row[col] = '-';
                }
            });
            row['Overtime Deduction (₹)'] = emp.totalDed;
            row['Total Quantity'] = emp.totalQty;
            row['Final Total Amount (₹)'] = emp.finalTotal;
            return row;
        });
        
        const totalRow = { 'Emp ID': 'TOTAL', 'Employee Name': '' };
        let grandTotalQty = 0; let grandTotalDed = 0; let grandFinalTotal = 0;
        
        sortedCols.forEach(col => {
            let colQty = 0; let colPrice = 0;
            pivotArray.forEach(emp => {
                if (emp.items[col]) {
                    colQty += emp.items[col].qty;
                    colPrice += emp.items[col].price;
                }
            });
            totalRow[col] = `${colQty} Qty | ₹  ${formatINR(colPrice)}`;
        });
        
        pivotArray.forEach(emp => {
            grandTotalQty += emp.totalQty;
            grandTotalDed += emp.totalDed;
            grandFinalTotal += emp.finalTotal;
        });
        
        totalRow['Overtime Deduction (₹)'] = grandTotalDed;
        totalRow['Total Quantity'] = grandTotalQty;
        totalRow['Final Total Amount (₹)'] = grandFinalTotal;
        
        exportData.push(totalRow);

    } else if (activeTab === 'item') {
        exportData = dataForExcel.map(r => {
            const item = itemsList.find(i => {
                const iName = String(i.ItemName || i.itemname || i.itemName).trim().toLowerCase();
                const iPrice = parseFloat(i.EmpRate || i.emprate || 0) + parseFloat(i.EmployeerRate || i.employeerrate || i.employerRate || 0);
                return iName === String(r.itemName).trim().toLowerCase() && Math.abs(iPrice - parseFloat(r.totalAmount || 0)) < 0.01;
            });
            return {
                'Meal / Item Name': r.itemName,
                'Item Group': item ? (item.ItemGroup || item.itemgroup || 'Unknown') : 'Unknown',
                'Shift Group': item ? (item.ShiftGroup || item.shiftGroup || 'Unknown') : 'Unknown',
                'Canteen Name': r.canteenName,
                'Date': r.processedDate,
                'Emp ID': r.empId,
                'Employee Name': r.empName,
                'In Time': formatTimeForExcel(r.inTime),
                'Out Time': formatTimeForExcel(r.outTime),
                'Amount (₹)': r.finalTotalAmount
            };
        });

        exportData.push({
            'Meal / Item Name': 'TOTAL',
            'Item Group': '', 'Shift Group': '', 'Canteen Name': '', 'Date': '', 'Emp ID': '', 'Employee Name': '', 'In Time': '', 'Out Time': '',
            'Amount (₹)': totals.totalAmount
        });

    } else {
        exportData = dataForExcel.map(r => ({
            'Canteen Name': r.canteenName,
            'Date': r.processedDate,
            'Emp ID': r.empId,
            'Employee Name': r.empName,
            'Meal / Item Name': r.itemName,
            'In Time': formatTimeForExcel(r.inTime),
            'Out Time': formatTimeForExcel(r.outTime),
            'Amount (₹)': r.finalTotalAmount
        }));

        exportData.push({
            'Canteen Name': 'TOTAL',
            'Date': '', 'Emp ID': '', 'Employee Name': '', 'Meal / Item Name': '', 'In Time': '', 'Out Time': '',
            'Amount (₹)': totals.totalAmount
        });
    }

    const headers = Object.keys(exportData[0]);
    const numCols = headers.length;
    const summaryColIdx = numCols + 1; // Gap column

    const worksheet = XLSX.utils.aoa_to_sheet([]);

    let titleText = `EatSync OS - ${activeTab.toUpperCase()} REPORT`;
    if (activeTab === 'employee' && selectedEmployee) titleText = `EatSync OS - EMPLOYEE REPORT - ${selectedEmployee.empName} (${selectedEmployee.empId})`;
    if (activeTab === 'deduction') titleText = `EatSync OS - EMPLOYEE DEDUCTION REPORT`;

    const titleRows = [
      [titleText],
      [`Reporting Period: ${startDate} to ${endDate}`],
      [`Generated On: ${new Date().toLocaleString()}`],
      [], [] 
    ];
    XLSX.utils.sheet_add_aoa(worksheet, titleRows, { origin: "A1" });

    worksheet['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: numCols - 1 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: numCols - 1 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: numCols - 1 } }
    ];

    const alignCenter = { alignment: { horizontal: "center", vertical: "center" } };
    if (worksheet['A1']) worksheet['A1'].s = { font: { bold: true, sz: 16, color: { rgb: "0F172A" } }, ...alignCenter };
    if (worksheet['A2']) worksheet['A2'].s = { font: { bold: true, color: { rgb: "4F46E5" } }, ...alignCenter };
    if (worksheet['A3']) worksheet['A3'].s = { font: { italic: true, color: { rgb: "64748B" } }, ...alignCenter };

    // Write Main Table Data
    XLSX.utils.sheet_add_json(worksheet, exportData, { origin: "A6" }); 

    for (let C = 0; C < numCols; ++C) {
      const cellAddress = XLSX.utils.encode_cell({ r: 5, c: C });
      if (worksheet[cellAddress]) {
        worksheet[cellAddress].s = { font: { bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "334155" } }, alignment: { horizontal: "center" } };
      }
    }

    const lastDataRowIdx = 5 + exportData.length;
    for (let C = 0; C < numCols; ++C) {
        const cellAddress = XLSX.utils.encode_cell({ r: lastDataRowIdx, c: C });
        if (worksheet[cellAddress]) {
            worksheet[cellAddress].s = { 
                font: { bold: true, sz: 12, color: { rgb: "000000" } }, 
                fill: { fgColor: { rgb: "F1F5F9" } }, 
                alignment: { horizontal: C === 0 ? "left" : "right" } 
            };
        }
    }

    // 🟢 SUMMARY BOX
    const summaryData = [
      ["📊 REPORT SUMMARY", ""]
    ];

    summaryData.push(["--- ITEMIZED BREAKDOWN ---", ""]);
    Object.values(totals.itemBreakdown).forEach((data) => {
        const matchedItem = itemsList.find(i => {
            const iName = String(i.ItemName || i.itemname || i.itemName).trim().toLowerCase();
            const iPrice = parseFloat(i.EmpRate || i.emprate || 0) + parseFloat(i.EmployeerRate || i.employeerrate || i.employerRate || 0);
            return iName === data.name.trim().toLowerCase() && Math.abs(iPrice - data.unitPrice) < 0.01;
        });
        const itemGroup = matchedItem ? (matchedItem.ItemGroup || matchedItem.itemgroup || 'Normal') : 'Normal';

        let labelText = "";
        if (activeTab === 'employee' || activeTab === 'deduction') {
            if (data.isOvertime || data.isMorningZero) { 
                labelText = `[DEDUCTED] ${data.name} [${itemGroup}]  ${data.count} * (₹ 0.00 + ₹ 0.00) = ₹ 0.00`; 
            } else { 
                labelText = `${data.name} [${itemGroup}]  ${data.count} * (₹ ${data.empRate.toFixed(2)} + ₹ ${data.employeerRate.toFixed(2)})`; 
            }
        } else {
            labelText = `${data.name} [${itemGroup}]  ${data.count} * ₹ ${data.unitPrice.toFixed(2)}`;
        }

        summaryData.push([labelText, `₹  ${formatINR(data.revenue)}`]);
    });

    if (activeTab === 'employee' || activeTab === 'deduction') {
        summaryData.push(["--- CONTRIBUTIONS ---", ""]);

        if (activeTab === 'employee') {
            summaryData.push(["Total Employee Contribution", `₹  ${formatINR(totals.totalEmpRate)}`]);
            summaryData.push(["Total Company Contribution", `₹  ${formatINR(totals.totalEmployeerRate)}`]);
        } else {
            summaryData.push(["Total Base Employee Rate", `₹  ${formatINR(totals.totalBaseEmpRate)}`]);
            summaryData.push(["Total Final Employee Rate", `₹  ${formatINR(totals.totalEmpRate)}`]);
        }

        if (totals.overtimeMeals > 0) {
            summaryData.push(["[!] Overtime/Shift Deductions", `-₹  ${formatINR(activeTab === 'deduction' ? totals.totalEmpWaved : totals.deductedOvertimeValue)}`]);
        }
    }

    const grandTotalAmount = activeTab === 'deduction' ? totals.totalEmpRate : totals.totalAmount;

    summaryData.push(["TOTAL AMOUNT", ""]); 
    const wordsINR = numberToWordsIndian(grandTotalAmount).replace('Rupees Only', 'INR');
    summaryData.push([`₹  ${formatINR(grandTotalAmount)} ( ${wordsINR} )`, ""]);

    const summaryOrigin = XLSX.utils.encode_cell({ r: 5, c: summaryColIdx });
    XLSX.utils.sheet_add_aoa(worksheet, summaryData, { origin: summaryOrigin });

    // Format the summary box with borders
    const borderStyle = {
         top: { style: 'medium', color: { rgb: "000000" } },
         bottom: { style: 'medium', color: { rgb: "000000" } },
         left: { style: 'medium', color: { rgb: "000000" } },
         right: { style: 'medium', color: { rgb: "000000" } }
    };

    for (let i = 0; i < summaryData.length; i++) {
       const rowIdx = 5 + i;
       const labelCell = XLSX.utils.encode_cell({ r: rowIdx, c: summaryColIdx });
       const valueCell = XLSX.utils.encode_cell({ r: rowIdx, c: summaryColIdx + 1 });
       
       if (!worksheet[labelCell]) worksheet[labelCell] = { t: 's', v: '' };
       if (!worksheet[valueCell]) worksheet[valueCell] = { t: 's', v: '' };

       const isMainHeader = i === 0; 
       const isSubHeader = String(summaryData[i][0]).startsWith('---');
       const isTotalLabelRow = String(summaryData[i][0]) === "TOTAL AMOUNT";
       const isFinalNumberWordsRow = i === summaryData.length - 1; 

       if (isMainHeader) {
           worksheet['!merges'].push({ s: { r: rowIdx, c: summaryColIdx }, e: { r: rowIdx, c: summaryColIdx + 1 } });
           worksheet[labelCell].s = { font: { bold: true, color: { rgb: "FFFFFF" }, sz: 12 }, fill: { fgColor: { rgb: "0F172A" } }, alignment: { horizontal: "center", vertical: "center" }, border: borderStyle };
           worksheet[valueCell].s = { border: borderStyle };
       } else if (isSubHeader) {
           worksheet['!merges'].push({ s: { r: rowIdx, c: summaryColIdx }, e: { r: rowIdx, c: summaryColIdx + 1 } });
           worksheet[labelCell].s = { font: { bold: true, color: { rgb: "000000" }, sz: 9 }, fill: { fgColor: { rgb: "E2E8F0" } }, alignment: { horizontal: "center", vertical: "center" }, border: borderStyle };
           worksheet[valueCell].s = { border: borderStyle };
       } else if (isTotalLabelRow) {
           worksheet['!merges'].push({ s: { r: rowIdx, c: summaryColIdx }, e: { r: rowIdx, c: summaryColIdx + 1 } });
           worksheet[labelCell].s = { font: { bold: true, color: { rgb: "000000" }, sz: 14 }, fill: { fgColor: { rgb: "F8FAFC" } }, alignment: { horizontal: "center", vertical: "center" }, border: borderStyle };
           worksheet[valueCell].s = { border: borderStyle };
       } else if (isFinalNumberWordsRow) {
           worksheet['!merges'].push({ s: { r: rowIdx, c: summaryColIdx }, e: { r: rowIdx, c: summaryColIdx + 1 } });
           worksheet[labelCell].s = { font: { bold: true, color: { rgb: "000000" }, sz: 14 }, fill: { fgColor: { rgb: "FFFFFF" } }, alignment: { horizontal: "center", vertical: "center" }, border: borderStyle };
           worksheet[valueCell].s = { border: borderStyle };
       } else {
           worksheet[labelCell].s = { font: { bold: true, color: { rgb: "000000" }, sz: 10 }, border: borderStyle };
           worksheet[valueCell].s = { font: { bold: true, color: { rgb: "000000" }, sz: 10 }, alignment: { horizontal: "right" }, border: borderStyle };
       }
    }

    const colWidths = headers.map(header => {
      let maxLen = header.length;
      exportData.forEach(row => { const val = row[header]; const len = val ? String(val).length : 0; if (len > maxLen) maxLen = len; });
      return { wch: maxLen + 4 };
    });
    
    colWidths[numCols] = { wch: 4 }; 
    colWidths[summaryColIdx] = { wch: 55 }; 
    colWidths[summaryColIdx + 1] = { wch: 45 }; 

    worksheet['!cols'] = colWidths;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Report");
    XLSX.writeFile(workbook, `EatSync_${activeTab}_Report_${startDate}.xlsx`);
  };

  const formatT = (isoStr) => {
      if(!isoStr) return '---';
      const d = new Date(isoStr);
      return isNaN(d) ? '---' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // ==========================================
  // 🏢 RENDER LOGIC: GROUPED CANTEEN SUMMARY
  // ==========================================
  const renderCanteenSummary = () => {
      const grouped = {};
      filteredList.forEach(r => {
          if (!grouped[r.canteenName]) grouped[r.canteenName] = {};
          if (!grouped[r.canteenName][r.processedDate]) grouped[r.canteenName][r.processedDate] = [];
          grouped[r.canteenName][r.processedDate].push(r);
      });

      return (
          <table className="stable-modern-table rpt-table">
              <thead>
                  <tr className="rpt-th-row">
                      <th>🏷️ EMP ID</th>
                      <th>👤 NAME</th>
                      <th>🍔 MEAL</th>
                      <th>📥 IN TIME</th>
                      <th>📤 OUT TIME</th>
                      <th>💰 TOTAL (₹)</th>
                  </tr>
              </thead>
              <tbody>
                  {Object.keys(grouped).sort().map(canteenName => (
                      <React.Fragment key={canteenName}>
                          <tr className="rpt-tr-group-dark">
                              <td colSpan="6">🏢 CANTEEN: {canteenName}</td>
                          </tr>
                          {Object.keys(grouped[canteenName]).sort().map(dateStr => (
                              <React.Fragment key={`${canteenName}-${dateStr}`}>
                                  <tr className="rpt-tr-group-light">
                                      <td colSpan="6">📅 DATE: {dateStr}</td>
                                  </tr>
                                  {grouped[canteenName][dateStr].map((r, idx) => (
                                      <tr key={`${r.empId}-${idx}`} className="rpt-tr-data">
                                          <td><span className="rpt-badge rpt-primary">#{r.empId}</span></td>
                                          <td className="rpt-data-bold">{r.empName}</td>
                                          <td><span className="rpt-badge rpt-accent">{r.itemName}</span></td>
                                          <td><span className="rpt-badge rpt-success">{formatT(r.inTime)}</span></td>
                                          <td><span className="rpt-badge rpt-danger">{formatT(r.outTime)}</span></td>
                                          <td><strong className="rpt-text-success">₹ {formatINR(r.finalTotalAmount)}</strong></td>
                                      </tr>
                                  ))}
                              </React.Fragment>
                          ))}
                      </React.Fragment>
                  ))}
              </tbody>
          </table>
      );
  };

  // ==========================================
  // 🍔 RENDER LOGIC: GROUPED ITEM SUMMARY
  // ==========================================
  const renderItemSummary = () => {
      const grouped = {};
      filteredList.forEach(r => {
          const item = itemsList.find(i => {
              const iName = String(i.ItemName || i.itemname || i.itemName).trim().toLowerCase();
              const iPrice = parseFloat(i.EmpRate || i.emprate || 0) + parseFloat(i.EmployeerRate || i.employeerrate || i.employerRate || 0);
              return iName === String(r.itemName).trim().toLowerCase() && Math.abs(iPrice - parseFloat(r.totalAmount || 0)) < 0.01;
          });

          const sg = item ? (item.ShiftGroup || item.shiftGroup || 'Unassigned Shift') : 'Unassigned Shift';
          const ig = item ? (item.ItemGroup || item.itemgroup || 'Unassigned Group') : 'Unassigned Group';
          
          if (!grouped[sg]) grouped[sg] = {};
          if (!grouped[sg][ig]) grouped[sg][ig] = {};
          if (!grouped[sg][ig][r.processedDate]) grouped[sg][ig][r.processedDate] = [];
          
          grouped[sg][ig][r.processedDate].push(r);
      });

      return (
          <table className="stable-modern-table rpt-table">
              <thead>
                  <tr className="rpt-th-row">
                      <th>📍 CANTEEN</th>
                      <th>🏷️ EMP ID</th>
                      <th>👤 NAME</th>
                      <th>🍔 MEAL / ITEM</th>
                      <th>📥 IN TIME</th>
                      <th>💰 TOTAL (₹)</th>
                  </tr>
              </thead>
              <tbody>
                  {Object.keys(grouped).sort().map(sg => (
                      <React.Fragment key={sg}>
                          <tr className="rpt-tr-group-darkest">
                              <td colSpan="6">🕒 SHIFT GROUP: {sg}</td>
                          </tr>
                          {Object.keys(grouped[sg]).sort().map(ig => (
                              <React.Fragment key={`${sg}-${ig}`}>
                                  <tr className="rpt-tr-group-blue">
                                      <td colSpan="6">📁 ITEM CATEGORY: {ig}</td>
                                  </tr>
                                  {Object.keys(grouped[sg][ig]).sort().map(dateStr => (
                                      <React.Fragment key={`${sg}-${ig}-${dateStr}`}>
                                          <tr className="rpt-tr-group-lightest">
                                              <td colSpan="6">📅 DATE: {dateStr}</td>
                                          </tr>
                                          {grouped[sg][ig][dateStr].map((r, idx) => (
                                              <tr key={`${r.empId}-${idx}`} className="rpt-tr-data">
                                                  <td className="rpt-data-bold">{r.canteenName}</td>
                                                  <td><span className="rpt-badge rpt-primary">#{r.empId}</span></td>
                                                  <td className="rpt-data-bold">{r.empName}</td>
                                                  <td><span className="rpt-badge rpt-accent">{r.itemName}</span></td>
                                                  <td><span className="rpt-badge rpt-success">{formatT(r.inTime)}</span></td>
                                                  <td><strong className="rpt-text-success">₹ {formatINR(r.finalTotalAmount)}</strong></td>
                                              </tr>
                                          ))}
                                      </React.Fragment>
                                  ))}
                              </React.Fragment>
                          ))}
                      </React.Fragment>
                  ))}
              </tbody>
          </table>
      );
  };

  // ==========================================
  // 👥 RENDER LOGIC: NESTED EMPLOYEE SUMMARY
  // ==========================================
  const renderEmployeeSummary = () => {
      const grouped = {};
      filteredList.forEach(r => {
          const empKey = `${r.empName} (ID: ${r.empId})`;
          if (!grouped[empKey]) grouped[empKey] = [];
          grouped[empKey].push(r);
      });

      return (
          <table className="stable-modern-table rpt-table">
              <thead>
                  <tr className="rpt-th-row">
                      <th>📍 CANTEEN</th>
                      <th>📅 DATE</th>
                      <th>🕒 SHIFT</th>
                      <th>🍔 MEAL</th>
                      <th>📥 IN</th>
                      <th>👤 EMP ₹</th>
                      <th>🏢 CO ₹</th>
                      <th>💰 TOTAL (₹)</th>
                  </tr>
              </thead>
              <tbody>
                  {Object.keys(grouped).sort().map(empKey => (
                      <React.Fragment key={empKey}>
                          <tr className="rpt-tr-group-darkest">
                              <td colSpan="8">👤 EMPLOYEE: {empKey}</td>
                          </tr>
                          {grouped[empKey].map((r, idx) => (
                              <tr key={`${r.empId}-${idx}`} className={`rpt-tr-data ${r.isOvertime || r.isMorningZero ? 'rpt-tr-alert' : ''}`}>
                                  <td className="rpt-data-bold">{r.canteenName}</td>
                                  <td className="rpt-data-date">{r.processedDate}</td>
                                  <td><span className="rpt-badge rpt-neutral">{r.shiftGroup}</span></td>
                                  <td><span className="rpt-badge rpt-accent">{r.itemName}</span></td>
                                  <td><span className="rpt-badge rpt-success">{formatT(r.inTime)}</span></td>
                                  <td><strong className="rpt-text-blue">₹ {formatINR(r.finalEmpRate)}</strong></td>
                                  <td><strong className="rpt-text-indigo">₹ {formatINR(r.finalEmployeerRate)}</strong></td>
                                  <td>
                                      {r.isOvertime || r.isMorningZero ? (
                                          <span className="rpt-badge rpt-danger">0 ({r.isOvertime ? 'OVERTIME' : 'DEDUCTED'})</span>
                                      ) : (
                                          <strong className="rpt-text-success">₹ {formatINR(r.finalTotalAmount)}</strong>
                                      )}
                                  </td>
                              </tr>
                          ))}
                      </React.Fragment>
                  ))}
              </tbody>
          </table>
      );
  };

  // ==========================================
  // 📉 RENDER LOGIC: AGGREGATED EMPLOYEE DEDUCTION
  // ==========================================
  const renderDeductionReport = () => {
      const empPivot = {};
      filteredList.forEach(r => {
          const empKey = `${r.empName}_${r.empId}`;
          if (!empPivot[empKey]) {
              empPivot[empKey] = {
                  empId: r.empId,
                  empName: r.empName,
                  totalQty: 0,
                  totalBasePrice: 0,
                  overtimeDed: 0,
                  finalTotal: 0
              };
          }
          const base = parseFloat(r.empRate || 0);
          const final = r.finalEmpRate;
          const ded = base - final;

          empPivot[empKey].totalQty += 1;
          empPivot[empKey].totalBasePrice += base;
          empPivot[empKey].overtimeDed += ded;
          empPivot[empKey].finalTotal += final;
      });

      const dataRows = Object.values(empPivot).sort((a,b) => a.empName.localeCompare(b.empName));

      return (
          <table className="stable-modern-table rpt-table">
              <thead>
                  <tr className="rpt-th-row">
                      <th>🏷️ EMP ID</th>
                      <th>👤 EMPLOYEE NAME</th>
                      <th>🍔 TOTAL MEALS (QTY | ₹)</th>
                      <th>📉 OVERTIME DEDUCTION (₹)</th>
                      <th>💰 FINAL TOTAL (₹)</th>
                  </tr>
              </thead>
              <tbody>
                  {dataRows.map((emp, idx) => (
                      <tr key={`${emp.empId}-${idx}`} className="rpt-tr-data">
                          <td><span className="rpt-badge rpt-primary">#{emp.empId}</span></td>
                          <td className="rpt-data-bold">{emp.empName}</td>
                          <td><span className="rpt-badge rpt-neutral">{emp.totalQty} Qty | ₹ {formatINR(emp.totalBasePrice)}</span></td>
                          <td><strong className="rpt-text-danger">₹ {formatINR(emp.overtimeDed)}</strong></td>
                          <td><strong className="rpt-text-success">₹ {formatINR(emp.finalTotal)}</strong></td>
                      </tr>
                  ))}
                  {dataRows.length === 0 && (
                      <tr>
                          <td colSpan="5" style={{ textAlign: 'center', padding: '20px' }}>No deduction data available</td>
                      </tr>
                  )}
              </tbody>
          </table>
      );
  };

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

      <main className="main-scrollable-content fade-in" style={{ paddingBottom: '100px', padding: '30px', maxWidth: '1400px', margin: '0 auto' }}>
        
        {/* 🔄 TAB SELECTION */}
        <div className="rpt-tabs-container">
            <button className={`rpt-tab-btn ${activeTab === 'canteen' ? 'active' : ''}`} onClick={() => { setActiveTab('canteen'); setRawReportData([]); }}>🏢 CANTEEN BILL</button>
            <button className={`rpt-tab-btn ${activeTab === 'item' ? 'active' : ''}`} onClick={() => { setActiveTab('item'); setRawReportData([]); }}>🍔 ITEM BILL</button>
            <button className={`rpt-tab-btn ${activeTab === 'employee' ? 'active' : ''}`} onClick={() => { setActiveTab('employee'); setRawReportData([]); setSelectedEmployee(null); }}>👥 EMPLOYEE SUMMARY</button>
            <button className={`rpt-tab-btn ${activeTab === 'deduction' ? 'active' : ''}`} onClick={() => { setActiveTab('deduction'); setRawReportData([]); setSelectedEmployee(null); }}>📉 EMPLOYEE DEDUCTION</button>
        </div>

        {/* 🎛️ SHARED FILTERS HEADER */}
        <div className="rpt-filter-card">
            <div style={{ marginBottom: '25px' }}>
                <span className="rpt-filter-title">1. Select Period Mode</span>
                <div style={{ display: 'flex', gap: '10px' }}>
                    {['day', 'week', 'month', 'custom'].map(m => (
                        <button 
                            key={m} onClick={() => handleModeSwitch(m)}
                            className={`rpt-mode-btn ${dateMode === m ? 'active' : ''}`}
                        >
                            {m === 'day' ? 'Particular Day' : m === 'week' ? 'Weekly' : m === 'month' ? 'Monthly' : 'Custom Range'}
                        </button>
                    ))}
                </div>
            </div>

            <div className="rpt-filter-grid">
                <div className="rpt-date-group">
                    {(dateMode === 'day' || dateMode === 'week' || dateMode === 'month') && (
                        <button onClick={() => shiftPeriod(-1)} className="rpt-nav-btn">◀ Prev</button>
                    )}
                    
                    <ReportsCalendar label={dateMode === 'day' ? 'Select Date' : dateMode === 'week' ? 'Select Week (Starts from)' : dateMode === 'month' ? 'Select Month (Any date)' : 'Start Date'} selectedDate={startDate} onDateSelect={(d) => handleDateSelect(d, 'start')} activeDates={activeDates} />
                    {dateMode === 'custom' && (<ReportsCalendar label="End Date" selectedDate={endDate} onDateSelect={(d) => handleDateSelect(d, 'end')} activeDates={activeDates} />)}
                    
                    {(dateMode === 'week' || dateMode === 'month') && (
                        <div style={{ flex: 1, opacity: 0.7 }}>
                            <label className="rpt-label">Auto End Date</label>
                            <div className="manager-input rpt-disabled-date">{endDate || '---'}</div>
                        </div>
                    )}

                    {(dateMode === 'day' || dateMode === 'week' || dateMode === 'month') && (
                        <button onClick={() => shiftPeriod(1)} className="rpt-nav-btn">Next ▶</button>
                    )}
                </div>

                <div className="rpt-select-group">
                    {(activeTab === 'canteen' || activeTab === 'deduction') && (
                        <CanteenMultiSelect options={canteensList} selectedValues={selectedCanteens} onChange={setSelectedCanteens} />
                    )}
                    {(activeTab === 'item' || activeTab === 'deduction') && (
                        <GroupedItemSelect options={itemsList} selectedValues={selectedItems} onChange={setSelectedItems} />
                    )}
                    {activeTab === 'employee' && (
                        <EmployeeSearchSelect value={selectedEmployee} onChange={setSelectedEmployee} />
                    )}
                </div>

                <button className="btn-primary rpt-generate-btn" onClick={generateReport} disabled={loading}>
                    {loading ? '⏳ GENERATING...' : '📊 GENERATE REPORT'}
                </button>
            </div>
        </div>

        {/* 📊 UNIVERSAL RESULTS SECTION */}
        {rawReportData.length > 0 && (
            <div className="table-section mb-60 fade-in">
                
                <div className="rpt-result-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '20px' }}>
                    <div style={{ flex: '1 1 auto', minWidth: '300px' }}>
                        <h2 className="rpt-result-title">📋 {activeTab === 'deduction' ? 'Employee Deduction' : activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Bill Logs</h2>
                        
                        <div className="rpt-summary-badges" style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '12px' }}>
                           <span className="rpt-badge rpt-neutral">Records: {filteredList.length}</span>
                           <span className="rpt-badge rpt-success">Total Revenue: ₹ {formatINR(totals.totalAmount)}</span>
                           {(activeTab === 'employee' || activeTab === 'deduction') && (
                               <>
                                   <span className="rpt-badge rpt-blue">Emp Total: ₹ {formatINR(totals.totalEmpRate)}</span>
                                   {activeTab === 'employee' && <span className="rpt-badge rpt-indigo">Co. Total: ₹ {formatINR(totals.totalEmployeerRate)}</span>}
                                   {activeTab === 'deduction' && <span className="rpt-badge rpt-danger">Total Deducted: ₹ {formatINR(totals.totalEmpWaved)}</span>}
                               </>
                           )}
                           {(activeTab === 'employee' || activeTab === 'deduction') && totals.overtimeMeals > 0 && (
                               <span className="rpt-badge rpt-danger">[!] Overtime/Deductions: {totals.overtimeMeals} (-₹ {formatINR(activeTab === 'deduction' ? totals.totalEmpWaved : totals.deductedOvertimeValue)})</span>
                           )}
                        </div>
                    </div>
                    
                    <div className="flex-align-center gap-15" style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                        <div className="search-container-premium">
                            <span style={{ fontSize: '1.2rem', opacity: 0.5 }}>🔍</span>
                            <input className="search-input-premium" placeholder="Filter list..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                        </div>
                        <button className="btn-god-configure" style={{ height: '48px', borderRadius: '12px', margin: 0, background: '#ef4444', color: 'white', border: 'none' }} onClick={generatePDFBill}>
                            <span>🧾</span> GENERATE BILL
                        </button>
                        <button className="btn-god-configure" style={{ height: '48px', borderRadius: '12px', margin: 0 }} onClick={executeExport}>
                            <span>📊</span> EXPORT EXCEL
                        </button>
                    </div>
                </div>
                
                <div className="stable-table-container fade-in rpt-table-wrap">
                    {filteredList.length > 0 ? (
                        <>
                            {activeTab === 'canteen' && renderCanteenSummary()}
                            {activeTab === 'item' && renderItemSummary()}
                            {activeTab === 'employee' && renderEmployeeSummary()}
                            {activeTab === 'deduction' && renderDeductionReport()}
                        </>
                    ) : (
                        <div className="rpt-empty-state">
                           <div className="rpt-empty-icon">📭</div>
                           <h3>No Data Found</h3>
                           <p>We couldn't find any data matching your current filters or search query.</p>
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