// src/ItemDetail.js
import React, { useState, useRef, useMemo, useEffect, useId } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import API_BASE_URL from './config';
import * as XLSX from 'xlsx-js-style';
import { 
  AreaChart, Area, 
  BarChart, Bar, 
  LineChart, Line,
  ComposedChart,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, 
  CartesianGrid, Legend 
} from 'recharts';

const PremiumSelect = ({ value, onChange, options, label, isTable = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find(opt => String(opt.value) === String(value));

  return (
    <div className={`chart-select-wrapper ${isTable ? 'table-select-v2' : ''}`} ref={containerRef} onClick={() => setIsOpen(!isOpen)}>
      {label && <span className="chart-select-label">{label}</span>}
      <div className="custom-select-trigger" style={{ height: isTable ? '36px' : '38px', minWidth: isTable ? '100px' : '160px' }}>
        <span style={{fontWeight: '800', fontSize: isTable ? '0.65rem' : '0.75rem', color: 'var(--primary)', textTransform: 'uppercase'}}>
           {selectedOption?.icon} {selectedOption?.label}
        </span>
        <span style={{fontSize: '0.6rem', marginLeft: '10px', transition: 'transform 0.3s', transform: isOpen ? 'rotate(180deg)' : 'none'}}>▼</span>
      </div>

      {isOpen && (
        <div className="custom-dropdown-menu" style={{ width: isTable ? '160px' : '220px', zIndex: 1000 }}>
          {options.map((opt) => (
            <div 
              key={opt.value} 
              className={`dropdown-item ${value === opt.value ? 'active' : ''}`}
              style={{ padding: isTable ? '8px 12px' : '12px 18px', fontSize: isTable ? '0.7rem' : '0.8rem' }}
              onClick={(e) => { e.stopPropagation(); onChange(opt.value); setIsOpen(false); }}
            >
              <span className="dropdown-item-icon">{opt.icon}</span>
              <span>{opt.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

function ItemDetail({ selectedDate }) {
  const params = useParams();
  const rawIdentifier = params.itemName || params.canteenId || params.id || '';
  const targetItemName = decodeURIComponent(rawIdentifier);
  
  const navigate = useNavigate();
  const tableRef = useRef(null); // Reference for auto-scrolling

  const [globalData, setGlobalData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Metric Selection States
  const [trendMetric, setTrendMetric] = useState('hourly');
  const [distMetric, setDistMetric] = useState('shiftGroup'); 
  
  const [trendChartType, setTrendChartType] = useState('area');
  const [distChartType, setDistChartType] = useState('donut');
  const [sortConfig, setSortConfig] = useState({ key: 'timeMins', direction: 'desc' });

  // Function to handle auto-scrolling
  const scrollToTable = () => {
    if (tableRef.current) {
      tableRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  useEffect(() => {
    const abortController = new AbortController();
    const signal = abortController.signal;

    const fetchGlobalItemData = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('eatsync_token');
        const authHeaders = {
          'Authorization': `Bearer ${token}`
        };

        const [itemsRes, canteensListRes] = await Promise.all([
            fetch(`${API_BASE_URL}/api/all-items`, { signal, headers: authHeaders }),
            fetch(`${API_BASE_URL}/api/canteens-list`, { signal, headers: authHeaders })
        ]);

        if (!itemsRes.ok || !canteensListRes.ok) {
           throw new Error("Authentication failed or server error.");
        }

        const itemsList = await itemsRes.json();
        const canteensList = await canteensListRes.json();

        const matchingItems = itemsList.filter(i => 
            (i.ItemName || i.itemname || i.itemName) === targetItemName
        );

        if (matchingItems.length === 0) {
            setGlobalData({ error: "Item not found in master registry." });
            setLoading(false);
            return;
        }

        const matchingItemIds = matchingItems.map(i => String(i.ItemID || i.itemid || i.ItemId));

        const relevantCanteens = canteensList.filter(c => {
            const assignedStr = String(c.ItemID || c.itemid || c.ItemId || '');
            const assignedArr = assignedStr.split(',').map(s => s.trim());
            return matchingItemIds.some(id => assignedArr.includes(id));
        });

        const detailPromises = relevantCanteens.map(c => 
            fetch(`${API_BASE_URL}/api/canteen-detail/${c.CanteenID || c.canteenid || c.id}${selectedDate ? `?date=${selectedDate}` : ''}`, { signal, headers: authHeaders }).then(r => r.json())
        );
        const details = await Promise.all(detailPromises);

        let allConsumers = [];
        let stats = { totalCount: 0, totalRevenue: 0 };
        const canteenCounts = {};

        details.forEach((cData, index) => {
            if (cData.error) return;
            const canteenName = cData.name || relevantCanteens[index].CanteenName || 'Unknown Canteen';
            
            const consumersMap = cData.stats?.itemConsumers || {};
            
            matchingItems.forEach(item => {
                const iId = String(item.ItemID || item.itemid || item.ItemId);
                const consumers = consumersMap[iId] || [];
                
                const empRate = parseFloat(item.EmpRate || item.emprate || item.empRate || 0);
                const coRate = parseFloat(item.EmployeerRate || item.employeerrate || item.employerRate || 0);
                const totalRate = empRate + coRate;

                consumers.forEach(emp => {
                    let rawTime = "";
                    const dateString = String(emp.processedDate);
                    if (dateString.includes('T')) rawTime = dateString.split('T')[1];
                    else if (dateString.includes(' ')) rawTime = dateString.split(' ')[1];
                    
                    let timeMins = 0;
                    if(rawTime) {
                        const [hStr, mStr] = rawTime.split(':');
                        timeMins = parseInt(hStr, 10) * 60 + parseInt(mStr, 10);
                    }

                    // High Performance DB Time Formatter for IN and OUT distinct times
                    const formatTimeFromDB = (dbDateString) => {
                        if (!dbDateString || dbDateString === 'null' || dbDateString === 'undefined') return '---';
                        let rTime = "";
                        const str = String(dbDateString);
                        if (str.includes('T')) rTime = str.split('T')[1];
                        else if (str.includes(' ')) rTime = str.split(' ')[1];
                        else rTime = str;
                        
                        let [h, m] = rTime.split(':').map(Number);
                        if(isNaN(h) || isNaN(m)) return '---';
                        const ampm = h >= 12 ? 'PM' : 'AM';
                        h = h % 12 || 12;
                        return `${h}:${String(m).padStart(2, '0')} ${ampm}`;
                    };

                    allConsumers.push({
                        id: emp.id,
                        name: emp.name,
                        category: emp.category || 'Unknown',
                        dept: emp.dept || 'Unknown',
                        company: emp.company || 'Unknown',
                        canteenName: canteenName,
                        deviceName: emp.deviceName || 'Unknown Terminal',
                        
                        // 🕒 Render distinct IN and OUT times specifically
                        inTimeStr: formatTimeFromDB(emp.inTime || emp.processedDate), // Fallback if missing temporarily
                        outTimeStr: formatTimeFromDB(emp.outTime),
                        
                        // Used for charting and sorting
                        timeStr: formatTimeFromDB(emp.processedDate),
                        timeMins: timeMins,
                        fullDate: emp.processedDate,
                        
                        itemGroup: item.ItemGroup || item.itemgroup || 'Normal',
                        shiftGroup: emp.shiftGroup || '---',
                        totalValue: totalRate
                    });

                    canteenCounts[canteenName] = (canteenCounts[canteenName] || 0) + 1;
                    stats.totalCount++;
                    stats.totalRevenue += totalRate;
                });
            });
        });

        setGlobalData({
            itemName: targetItemName,
            allConsumers,
            stats,
            canteenCounts,
            activeCanteens: Object.keys(canteenCounts).length,
            itemGroups: [...new Set(matchingItems.map(i => i.ItemGroup || i.itemgroup || 'Normal'))]
        });

      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error("Failed to fetch detail:", err);
          setGlobalData({ error: "Network Error or Unauthorized" });
        }
      } finally {
        setLoading(false);
      }
    };
    
    fetchGlobalItemData();

    return () => {
      abortController.abort();
    };
  }, [targetItemName, selectedDate]);

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const filteredList = useMemo(() => {
      if (!globalData || !globalData.allConsumers) return [];
      let list = globalData.allConsumers;
      
      if (searchQuery) {
          const sq = searchQuery.toLowerCase();
          list = list.filter(c => 
              (c.name || '').toLowerCase().includes(sq) || 
              String(c.id).includes(sq) ||
              (c.canteenName || '').toLowerCase().includes(sq) ||
              (c.deviceName || '').toLowerCase().includes(sq) ||
              (c.shiftGroup || '').toLowerCase().includes(sq) 
          );
      }

      return list.sort((a, b) => {
          let valA = a[sortConfig.key] || '';
          let valB = b[sortConfig.key] || '';
          if (sortConfig.key === 'id' || sortConfig.key === 'totalValue' || sortConfig.key === 'timeMins') {
              valA = parseFloat(valA) || 0;
              valB = parseFloat(valB) || 0;
          }
          if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
          if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
          return 0;
      });
  }, [globalData, searchQuery, sortConfig]);

  // Excel Export Logic with IN and OUT times
  const executeExport = () => {
    if (filteredList.length === 0) {
        alert("No data available to export.");
        return;
    }

    const totalCount = filteredList.length;
    const totalAmount = filteredList.reduce((sum, item) => sum + (item.totalValue || 0), 0);
    const reportDateLabel = selectedDate ? selectedDate : 'Live / Real-Time Data';

    const exportData = filteredList.map(c => ({
        'Employee ID': c.id,
        'Name': c.name,
        'Canteen': c.canteenName || '---',
        'Device Name': c.deviceName || '---',
        'In Time': c.inTimeStr,
        'Out Time': c.outTimeStr,
        'Item Group': c.itemGroup || '---',
        'Shift Group': c.shiftGroup || '---', 
        'Meal Value (₹)': c.totalValue || 0,
        'Category': c.category || '---',
        'Department': c.dept || '---',
        'Company': c.company || '---'
    }));

    const titleRows = [
      [`Item Report: ${globalData.itemName}`],
      [`Report Date: ${reportDateLabel}`],
      [`Generated On: ${new Date().toLocaleString()}`],
      [`Total Employees: ${totalCount}`],
      [`Total Revenue (₹): ${totalAmount.toFixed(2)}`],
      [] 
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(titleRows);
    XLSX.utils.sheet_add_json(worksheet, exportData, { origin: "A7" });
    
    const headers = Object.keys(exportData[0]);
    
    worksheet['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: headers.length - 1 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: headers.length - 1 } },
      { s: { r: 3, c: 0 }, e: { r: 3, c: headers.length - 1 } },
      { s: { r: 4, c: 0 }, e: { r: 4, c: headers.length - 1 } }
    ];

    if (worksheet['A1']) worksheet['A1'].s = { font: { bold: true, sz: 14 }, alignment: { horizontal: "center", vertical: "center" } };
    if (worksheet['A2']) worksheet['A2'].s = { font: { bold: true, color: { rgb: "4F46E5" } }, alignment: { horizontal: "center", vertical: "center" } };
    if (worksheet['A3']) worksheet['A3'].s = { font: { italic: true, color: { rgb: "666666" } }, alignment: { horizontal: "center", vertical: "center" } };
    if (worksheet['A4']) worksheet['A4'].s = { font: { bold: true, color: { rgb: "10B981" } }, alignment: { horizontal: "center", vertical: "center" } };
    if (worksheet['A5']) worksheet['A5'].s = { font: { bold: true, color: { rgb: "10B981" } }, alignment: { horizontal: "center", vertical: "center" } };

    const range = XLSX.utils.decode_range(worksheet['!ref']);
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cellAddress = XLSX.utils.encode_cell({ r: 6, c: C });
      if (worksheet[cellAddress]) {
        worksheet[cellAddress].s = { font: { bold: true }, fill: { fgColor: { rgb: "F1F5F9" } }, alignment: { horizontal: "center" } };
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
    XLSX.utils.book_append_sheet(workbook, worksheet, "Meal Logs");
    XLSX.writeFile(workbook, `${globalData.itemName.replace(/\s+/g, '_')}_Global_Logs.xlsx`);
  };

  // Trend & Distribution Data
  const chartData = useMemo(() => {
      if (!globalData) return { trend: [], dist: [], peakHour: 'N/A' };

      // Trend Data
      let trend = [];
      let peakHourStr = 'N/A';
      let peakCount = 0;

      const tempHours = {};
      globalData.allConsumers.forEach(c => {
          const hStr = c.timeStr.split(':')[0]; 
          const ampm = c.timeStr.includes('PM') ? 'PM' : 'AM';
          const label = `${hStr} ${ampm}`;
          tempHours[label] = (tempHours[label] || 0) + 1; 
          if(tempHours[label] > peakCount) { peakCount = tempHours[label]; peakHourStr = label; }
      });

      if (trendMetric === 'hourly') {
          const sortedHours = {};
          for(let i=6; i<=22; i++) {
              const label = `${i > 12 ? i-12 : (i === 0 ? 12 : i)} ${i >= 12 ? 'PM' : 'AM'}`;
              sortedHours[label] = tempHours[label] || 0;
          }
          trend = Object.keys(sortedHours).map(label => ({ time: label, count: sortedHours[label] }));
      } else if (trendMetric === 'device') {
          const devices = {};
          globalData.allConsumers.forEach(c => {
              const devName = c.deviceName || 'Unknown Device';
              devices[devName] = (devices[devName] || 0) + 1;
          });
          trend = Object.keys(devices).map(dev => ({ time: dev, count: devices[dev] })).sort((a,b) => b.count - a.count);
      }
      
      // Distribution Data
      const categoryCounts = {};
      globalData.allConsumers.forEach(c => {
          let val = c[distMetric];
          if (!val || val === '---' || val === '0' || val === 'NULL') {
              val = 'Other';
          }
          categoryCounts[val] = (categoryCounts[val] || 0) + 1;
      });

      const colors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#f43f5e', '#14b8a6'];
      const dist = Object.keys(categoryCounts)
          .map((cat, i) => ({ name: cat, value: categoryCounts[cat], fill: colors[i % colors.length] }))
          .sort((a,b) => b.value - a.value);

      return { trend, dist, peakHour: peakHourStr };
  }, [globalData, trendMetric, distMetric]);

  const chartIdBase = useId();

  if (loading) {
    return (
      <div className="flex-column flex-center h-screen fade-in">
        <div className="loading-container-box">
          <h2 style={{fontWeight: '950', color: 'var(--text-bold)', letterSpacing: '4px', marginBottom: '30px', textTransform: 'uppercase'}}>LOADING DATA...</h2>
          <div className="dots-loader"><div className="dot"></div><div className="dot"></div><div className="dot"></div></div>
        </div>
      </div>
    );
  }

  if (!globalData || globalData.error) {
    return (
      <div className="flex-column flex-center h-screen fade-in">
        <h2 style={{fontWeight: '900', color: 'var(--danger)'}}>🚫 {globalData?.error || 'ERROR LOADING DATA'}</h2>
        <button className="btn-primary mt-20" onClick={() => navigate('/')}>RETURN TO HOME</button>
      </div>
    );
  }

  const renderDynamicChart = (type, data, chartIdSuffix) => {
    const commonProps = {
      data,
      margin: { top: 20, right: 30, left: 0, bottom: 0 }
    };

    const tooltipStyle = {
      borderRadius: '16px',
      border: 'none',
      boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
      fontFamily: 'Outfit',
      fontWeight: '600'
    };

    const xAxisKey = data.length > 0 && data[0].name !== undefined ? 'name' : 'time';
    const yAxisKey = data.length > 0 && data[0].value !== undefined ? 'value' : 'count';
    const gradientId = `colorGradient-${chartIdBase}-${chartIdSuffix}`;

    if (type === 'line') {
      return (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey={xAxisKey} stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} dy={10} />
            <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} dx={-10} />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend verticalAlign="top" height={36} iconType="circle" />
            <Line 
              name="Total Count"
              type="monotone" 
              dataKey={yAxisKey} 
              stroke="#6366f1" 
              strokeWidth={4} 
              dot={{r: 6, fill: '#6366f1', strokeWidth: 3, stroke: '#fff'}} 
              activeDot={{r: 8, strokeWidth: 0}} 
              animationDuration={800}
              animationEasing="ease-out"
            />
          </LineChart>
        </ResponsiveContainer>
      );
    }
    
    if (type === 'area') {
        return (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart {...commonProps}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey={xAxisKey} stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} dy={10} />
              <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} dx={-10} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend verticalAlign="top" height={36} iconType="circle" />
              <Area 
                name="Total Count"
                type="monotone" 
                dataKey={yAxisKey} 
                stroke="#6366f1" 
                strokeWidth={4} 
                fillOpacity={1} 
                fill={`url(#${gradientId})`} 
                animationDuration={800}
                animationEasing="ease-out"
              />
            </AreaChart>
          </ResponsiveContainer>
        );
    }

    if (type === 'composed') {
        return (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart {...commonProps}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey={xAxisKey} stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} dy={10} />
              <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} dx={-10} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend verticalAlign="top" height={36} iconType="circle" />
              <Bar name="Count" dataKey={yAxisKey} fill="#818cf8" radius={[4, 4, 0, 0]} barSize={40} />
              <Line name="Trend Curve" type="monotone" dataKey={yAxisKey} stroke="#4f46e5" strokeWidth={3} dot={{r: 4}} />
            </ComposedChart>
          </ResponsiveContainer>
        );
    }

    if (type === 'pie' || type === 'donut') {
      return (
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie 
              key={`pie-${data.length}`}
              data={data} 
              cx="50%" cy="50%" 
              innerRadius={type === 'donut' ? 80 : 0} 
              outerRadius={110} 
              paddingAngle={5} 
              dataKey={yAxisKey}
              nameKey={xAxisKey}
              label={({name, percent}) => `${(percent * 100).toFixed(0)}%`}
              isAnimationActive={false}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill || '#4f46e5'} />
              ))}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} />
            <Legend verticalAlign="top" height={36} iconType="circle" />
          </PieChart>
        </ResponsiveContainer>
      );
    }

    // Default: Bar
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart {...commonProps}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4f46e5" stopOpacity={1}/>
              <stop offset="100%" stopColor="#818cf8" stopOpacity={0.6}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
          <XAxis dataKey={xAxisKey} stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} dy={10} />
          <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} dx={-10} />
          <Tooltip contentStyle={tooltipStyle} cursor={{fill: '#f8fafc'}} />
          <Legend verticalAlign="top" height={36} iconType="circle" />
          <Bar 
            name="Total Count"
            dataKey={yAxisKey} 
            fill={`url(#${gradientId})`} 
            radius={[6, 6, 0, 0]} 
            barSize={40} 
            animationDuration={800}
            animationEasing="ease-out"
          />
        </BarChart>
      </ResponsiveContainer>
    );
  };

  return (
    <div className="main-pane-100">
      <div className="top-navbar premium-alt">
        <div className="navbar-left">
          <div style={{ display: 'flex', gap: '10px' }}>
              <div className="global-breadcrumb dark-mode" onClick={() => navigate('/')}>
                <span className="home-icon">🏠</span>
                <span className="breadcrumb-text">Home</span>
              </div>
          </div>
        </div>
        <div className="navbar-center"><h1 className="m-0" style={{ fontSize: '1.4rem', fontWeight: '900' }}>Item Report</h1></div>
        <div className="navbar-right"><span className="badge info-badge" style={{ padding: '8px 20px', fontSize: '0.75rem' }}>{selectedDate || 'LIVE DATA'}</span></div>
      </div>

      <main className="main-scrollable-content fade-in">
        <div className="section-header-premium detail-header-v2 mb-40">
            <div className="header-left-group">
                <div style={{background: '#f3e8ff', color: '#7c3aed', width: '60px', height: '60px', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', border: '1px solid #d8b4fe'}}>🍔</div>
                <div className="title-stack">
                    <h2 className="section-title m-0">{globalData.itemName}</h2>
                    <p className="text-slate m-0" style={{fontWeight: '800'}}>Consolidated metrics across all assigned canteens</p>
                </div>
            </div>
        </div>

        <div className="detail-status-grid mb-40">
            {/* Added onClick={scrollToTable} and cursor: 'pointer' to all pills below */}
            <div className="status-pill-v2 blue active" style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)', cursor: 'pointer' }} onClick={scrollToTable}>
                <div className="pill-content"><span className="pill-label" style={{color: 'white'}}>TOTAL CONSUMED</span><span className="pill-value" style={{color: 'white'}}>{globalData.stats.totalCount}</span></div>
                <div className="pill-icon" style={{color: 'white'}}>👥</div>
            </div>
            <div className="status-pill-v2 green" style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', cursor: 'pointer' }} onClick={scrollToTable}>
                <div className="pill-content"><span className="pill-label" style={{color: 'white'}}>GLOBAL REVENUE</span><span className="pill-value" style={{color: 'white'}}>₹{globalData.stats.totalRevenue.toFixed(2)}</span></div>
                <div className="pill-icon" style={{color: 'white'}}>💰</div>
            </div>
            <div className="status-pill-v2 yellow" style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', cursor: 'pointer' }} onClick={scrollToTable}>
                <div className="pill-content"><span className="pill-label" style={{color: 'white'}}>ACTIVE CANTEENS</span><span className="pill-value" style={{color: 'white'}}>{globalData.activeCanteens}</span></div>
                <div className="pill-icon" style={{color: 'white'}}>🏢</div>
            </div>
            <div className="status-pill-v2 red" style={{ background: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)', cursor: 'pointer' }} onClick={scrollToTable}>
                <div className="pill-content"><span className="pill-label" style={{color: 'white'}}>PEAK CONSUMPTION</span><span className="pill-value" style={{color: 'white'}}>{chartData.peakHour}</span></div>
                <div className="pill-icon" style={{color: 'white'}}>⚡</div>
            </div>
        </div>

        <div className="charts-grid-detail mb-60">
          
          {/* Trend Chart Card */}
          <div className="chart-card-detail">
            <div className="chart-header-with-select" style={{ flexWrap: 'wrap', gap: '15px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '1.4rem' }}>📈</span>
                <PremiumSelect 
                  value={trendMetric}
                  onChange={setTrendMetric}
                  options={[
                    { value: 'hourly', label: 'HOURLY TRAFFIC', icon: '⏱️' },
                    { value: 'device', label: 'DEVICE SCANS', icon: '📟' }
                  ]}
                />
              </div>
              <PremiumSelect 
                label="Chart Style"
                value={trendChartType}
                onChange={setTrendChartType}
                options={[
                  { value: 'area', label: 'AREA CHART', icon: '🌊' },
                  { value: 'bar', label: 'BAR GRAPH', icon: '📊' },
                  { value: 'line', label: 'LINE CHART', icon: '📈' },
                  { value: 'composed', label: 'COMPOSED', icon: '📉' }
                ]}
              />
            </div>
            <div style={{height: '350px', marginTop: '20px'}}>
              {renderDynamicChart(trendChartType, chartData.trend, 'trend')}
            </div>
          </div>
          
          {/* Distribution Breakdown Chart Card */}
          <div className="chart-card-detail">
            <div className="chart-header-with-select" style={{ flexWrap: 'wrap', gap: '15px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '1.4rem' }}>📊</span>
                <PremiumSelect 
                  value={distMetric}
                  onChange={setDistMetric}
                  options={[
                    { value: 'shiftGroup', label: 'BY SHIFT', icon: '🕒' }, 
                    { value: 'category', label: 'BY CATEGORY', icon: '🏷️' },
                    { value: 'canteenName', label: 'BY CANTEEN', icon: '📍' },
                    { value: 'company', label: 'BY COMPANY', icon: '🏢' },
                    { value: 'itemGroup', label: 'BY GROUP', icon: '👥' },
                    { value: 'dept', label: 'BY DEPARTMENT', icon: '📁' },
                    { value: 'deviceName', label: 'BY DEVICE', icon: '📟' }
                  ]}
                />
              </div>
              <PremiumSelect 
                label="Chart Style"
                value={distChartType}
                onChange={setDistChartType}
                options={[
                  { value: 'donut', label: 'DONUT PIE', icon: '🍩' },
                  { value: 'pie', label: 'SOLID PIE', icon: '🥧' },
                  { value: 'bar', label: 'BAR GRAPH', icon: '📊' },
                  { value: 'line', label: 'LINE CHART', icon: '📈' },
                  { value: 'area', label: 'AREA CHART', icon: '🌊' }
                ]}
              />
            </div>
            <div style={{height: '350px', marginTop: '20px'}}>
              {renderDynamicChart(distChartType, chartData.dist, 'dist')}
            </div>
          </div>

        </div>

        {/* Assigned ref={tableRef} here for the smooth scroll destination */}
        <div className="table-section-premium mb-60" ref={tableRef} style={{ border: '1px solid #e2e8f0', background: 'white' }}>
            <div className="flex-between mb-20 flex-align-center" style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '15px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <h2 className="section-title m-0" style={{fontSize: '1.25rem', color: 'var(--text-bold)'}}>📋 Employee Logs</h2>
                </div>
                
                <div className="flex-align-center gap-15">
                    <div className="search-container-premium">
                        <span style={{ fontSize: '1.2rem', opacity: 0.5 }}>🔍</span>
                        <input 
                            className="search-input-premium" 
                            placeholder="Search Name, ID, Canteen, Device, or Shift..." 
                            value={searchQuery} 
                            onChange={e => setSearchQuery(e.target.value)} 
                        />
                    </div>
                    <button className="btn-export-premium" style={{ height: '48px', borderRadius: '12px' }} onClick={executeExport}>
                        <span className="export-icon">📊</span> EXCEL EXPORT
                    </button>
                </div>
            </div>
            
            <div className="table-container fade-in" style={{ padding: '0', boxShadow: 'none' }}>
                <table className="modern-table">
                    <thead>
                        <tr>
                            <th onClick={() => handleSort('id')} style={{cursor:'pointer', userSelect: 'none'}}>🏷️ EMP ID {sortConfig.key==='id'?(sortConfig.direction==='asc'?'▲':'▼'):''}</th>
                            <th onClick={() => handleSort('name')} style={{cursor:'pointer', userSelect: 'none'}}>👤 NAME {sortConfig.key==='name'?(sortConfig.direction==='asc'?'▲':'▼'):''}</th>
                            <th onClick={() => handleSort('canteenName')} style={{cursor:'pointer', userSelect: 'none'}}>📍 CANTEEN {sortConfig.key==='canteenName'?(sortConfig.direction==='asc'?'▲':'▼'):''}</th>
                            <th onClick={() => handleSort('deviceName')} style={{cursor:'pointer', userSelect: 'none'}}>📟 DEVICE {sortConfig.key==='deviceName'?(sortConfig.direction==='asc'?'▲':'▼'):''}</th>
                            
                            {/* 🕒 NEW IN & OUT TIME HEADERS */}
                            <th onClick={() => handleSort('inTimeStr')} style={{cursor:'pointer', userSelect: 'none'}}>📥 IN TIME {sortConfig.key==='inTimeStr'?(sortConfig.direction==='asc'?'▲':'▼'):''}</th>
                            <th onClick={() => handleSort('outTimeStr')} style={{cursor:'pointer', userSelect: 'none'}}>📤 OUT TIME {sortConfig.key==='outTimeStr'?(sortConfig.direction==='asc'?'▲':'▼'):''}</th>
                            
                            <th onClick={() => handleSort('shiftGroup')} style={{cursor:'pointer', userSelect: 'none'}}>🕒 SHIFT GROUP {sortConfig.key==='shiftGroup'?(sortConfig.direction==='asc'?'▲':'▼'):''}</th>
                            
                            <th onClick={() => handleSort('totalValue')} style={{cursor:'pointer', userSelect: 'none'}}>💰 VALUE (₹) {sortConfig.key==='totalValue'?(sortConfig.direction==='asc'?'▲':'▼'):''}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredList.map((c, idx) => (
                            <tr key={`${c.id}-${idx}`} style={{ animationDelay: `${idx * 0.02}s` }}>
                                <td><strong style={{color: 'var(--primary)'}}>#{c.id}</strong></td>
                                <td style={{fontWeight: '700'}}>{c.name}</td>
                                <td><span className="badge" style={{fontSize: '0.65rem', background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0'}}>📍 {c.canteenName}</span></td>
                                <td style={{fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-main)'}}>{c.deviceName}</td>
                                
                                {/* 🕒 NEW IN & OUT TIME BADGES */}
                                <td>
                                   <span className="badge success-badge" style={{fontSize: '0.70rem'}}>
                                      {c.inTimeStr}
                                   </span>
                                </td>
                                <td>
                                   <span className="badge danger-badge" style={{fontSize: '0.70rem'}}>
                                      {c.outTimeStr}
                                   </span>
                                </td>
                                
                                <td><span className="badge" style={{fontSize: '0.7rem', fontWeight: '800', background: c.shiftGroup === '---' ? '#f1f5f9' : '#e0e7ff', color: c.shiftGroup === '---' ? '#94a3b8' : '#4338ca'}}>{c.shiftGroup}</span></td>
                                
                                <td><strong style={{color: 'var(--success)'}}>₹{c.totalValue.toFixed(2)}</strong></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {filteredList.length === 0 && (
                    <div className="no-data-premium-v2 fade-in" style={{ borderTop: '1px solid #e2e8f0' }}>
                        <div className="no-data-illustration">📭</div>
                        <h3>No Logs Found</h3>
                        <p>We couldn't find any consumption data matching your current search filters.</p>
                        <button className="btn-primary mt-20" style={{ padding: '12px 30px', borderRadius: '14px' }} onClick={() => setSearchQuery('')}>CLEAR SEARCH</button>
                    </div>
                )}
            </div>
        </div>

      </main>
    </div>
  );
}

export default ItemDetail;