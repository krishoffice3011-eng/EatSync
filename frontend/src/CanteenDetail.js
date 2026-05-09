// src/CanteenDetail.js
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

  React.useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find(opt => opt.value === value);

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
              onClick={(e) => {
                e.stopPropagation();
                onChange(opt.value);
                setIsOpen(false);
              }}
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

function CanteenDetail({ selectedDate }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const tableRef = useRef(null);

  const [activeData, setActiveData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('expected');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Metric Selection States
  const [trendMetric, setTrendMetric] = useState('hourly');
  const [distMetric, setDistMetric] = useState('category'); 
  
  const [trendChartType, setTrendChartType] = useState('area');
  const [distChartType, setDistChartType] = useState('donut');
  const [sortConfig, setSortConfig] = useState({ key: 'processedDate', direction: 'desc' });

  useEffect(() => {
    const abortController = new AbortController();
    const signal = abortController.signal;

    const fetchCanteenDetail = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('eatsync_token');
            const url = `${API_BASE_URL}/api/canteen-detail/${id}${selectedDate ? `?date=${selectedDate}` : ''}`;
            const res = await fetch(url, { 
                signal,
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (!res.ok) throw new Error("Authentication failed or forbidden access");
            
            const data = await res.json();
            setActiveData(data);
        } catch (err) {
            if (err.name !== 'AbortError') {
              console.error("Error fetching canteen detail:", err);
              setActiveData({ error: "Failed to load canteen data. Please check your connection." });
            }
        } finally {
            if (!signal.aborted) {
                setLoading(false);
            }
        }
    };
    
    fetchCanteenDetail();

    return () => {
      abortController.abort(); // Cancel pending fetch on unmount
    };
  }, [id, selectedDate]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tableRef.current) {
        tableRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const processedData = useMemo(() => {
    if (!activeData || activeData.error) return null;
    
    const mapEmployee = (e) => {
        let rawId = String(e.id || e.EmpCode || e.empcode || 'N/A').trim();
        if (rawId.length === 3) rawId = '0' + rawId;
        
        return {
            id: rawId,
            name: e.name || e.Name || 'Unknown',
            category: e.category || e.cat || e.Cat || '---', 
            company: e.company || '---',
            location: e.location || '---',
            dept: e.dept || '---',
            div: e.div || '---',
            group: e.grp || e.group || '---',
            ipAddress: e.ipAddress || 'N/A',
            deviceName: e.deviceName || 'N/A',
            processedDate: e.processedDate || e.transDate || null,
            inOut: e.inOut || e.InOut || null,
            mealName: e.mealName || e.ItemName || e.itemName || '---' 
        };
    };

    const employeesExpected = (activeData.employeesExpected || []).map(mapEmployee);
    const employeesInside = (activeData.employeesInside || []).map(mapEmployee);
    const employeesCompleted = (activeData.employeesCompleted || []).map(mapEmployee);
    const employeesRemaining = (activeData.employeesRemaining || []).map(mapEmployee);

    const allPersonnelRaw = [
      ...employeesInside,
      ...employeesCompleted,
      ...employeesRemaining,
      ...employeesExpected
    ];
    
    const uniqueExpected = Array.from(new Map(allPersonnelRaw.map(item => [item.id, item])).values());

    const stats = {
        totalExpected: activeData.stats?.totalExpected || employeesExpected.length || uniqueExpected.length || 0,
        currentlyInside: activeData.stats?.currentlyInside || employeesInside.length || 0,
        completedLunch: activeData.stats?.completedLunch || employeesCompleted.length || 0,
        remainingToday: activeData.stats?.remainingToday || employeesRemaining.length || 0,
        maxCapacity: activeData.stats?.maxCapacity || 100
    };

    return {
        ...activeData,
        stats,
        employeesExpected: employeesExpected.length > 0 ? employeesExpected : uniqueExpected,
        employeesInside,
        employeesCompleted,
        employeesRemaining
    };
  }, [activeData]);

  const filteredList = useMemo(() => {
    if (!processedData) return [];
    let list = [];
    if (activeTab === 'expected') list = processedData.employeesExpected || [];
    else if (activeTab === 'inside') list = processedData.employeesInside || [];
    else if (activeTab === 'completed') list = processedData.employeesCompleted || [];
    else if (activeTab === 'remaining') list = processedData.employeesRemaining || [];

    if (searchQuery) {
      const sq = searchQuery.toLowerCase();
      list = list.filter(e => 
        (e.name || '').toLowerCase().includes(sq) || 
        String(e.id).includes(sq) ||
        (e.mealName || '').toLowerCase().includes(sq) 
      );
    }

    const sorted = [...list].sort((a, b) => {
      let valA = a[sortConfig.key] || ''; 
      let valB = b[sortConfig.key] || '';

      if (sortConfig.key === 'inOut') {
        const ioA = String(a.inOut || '').toUpperCase();
        const ioB = String(b.inOut || '').toUpperCase();
        valA = ['I', 'P10', 'IN'].includes(ioA) ? 'IN' : ['O', 'P20', 'OUT'].includes(ioA) ? 'OUT' : 'N/A';
        valB = ['I', 'P10', 'IN'].includes(ioB) ? 'IN' : ['O', 'P20', 'OUT'].includes(ioB) ? 'OUT' : 'N/A';
      }

      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return sorted;
  }, [processedData, activeTab, searchQuery, sortConfig]);

  // Determine if Item Name column should be shown based on Active Tab
  const showItemColumn = activeTab === 'inside' || activeTab === 'completed';

  // Excel Export Logic with Item Name
  const executeExport = () => {
    if (filteredList.length === 0) {
      alert("No data available to export.");
      return;
    }

    const totalCount = filteredList.length;
    const reportDateLabel = selectedDate ? selectedDate : 'Live / Real-Time Data';

    const exportData = filteredList.map(e => ({
      'Employee ID': e.id,
      'Name': e.name,
      'Location': e.location || '---',
      'Category': e.category || '---',
      'Company': e.company || '---',
      'Group': e.group || '---',
      'Division': e.div || '---',
      'Department': e.dept || '---',
      'Device Name': e.deviceName || '---',
      'Item Name': showItemColumn ? (e.mealName && e.mealName !== '---' ? e.mealName : '') : 'N/A', 
      'Status': e.inOut || '---',
      'Processed Date': e.processedDate ? new Date(e.processedDate).toLocaleString('en-GB') : '---'
    }));

    const titleRows = [
      [`Canteen Report: ${activeData?.name || 'Canteen'} (${activeTab.toUpperCase()})`],
      [`Report Date: ${reportDateLabel}`],
      [`Generated On: ${new Date().toLocaleString()}`],
      [`Total Employees: ${totalCount}`],
      [] 
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(titleRows);
    XLSX.utils.sheet_add_json(worksheet, exportData, { origin: "A6" });
    
    const headers = Object.keys(exportData[0]);
    
    worksheet['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: headers.length - 1 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: headers.length - 1 } },
      { s: { r: 3, c: 0 }, e: { r: 3, c: headers.length - 1 } }
    ];

    if (worksheet['A1']) worksheet['A1'].s = { font: { bold: true, sz: 14 }, alignment: { horizontal: "center", vertical: "center" } };
    if (worksheet['A2']) worksheet['A2'].s = { font: { bold: true, color: { rgb: "4F46E5" } }, alignment: { horizontal: "center", vertical: "center" } };
    if (worksheet['A3']) worksheet['A3'].s = { font: { italic: true, color: { rgb: "666666" } }, alignment: { horizontal: "center", vertical: "center" } };
    if (worksheet['A4']) worksheet['A4'].s = { font: { bold: true, color: { rgb: "10B981" } }, alignment: { horizontal: "center", vertical: "center" } };

    const range = XLSX.utils.decode_range(worksheet['!ref']);
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cellAddress = XLSX.utils.encode_cell({ r: 5, c: C });
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
    XLSX.utils.book_append_sheet(workbook, worksheet, "Log");
    XLSX.writeFile(workbook, `${activeData?.name || 'Canteen'}_${activeTab}_Log.xlsx`);
  };

  // Trend Data (Hourly vs Device)
  const trendData = useMemo(() => {
    if (trendMetric === 'hourly') {
      const hours = {};
      for(let i=6; i<=22; i++) {
          hours[i] = 0;
      }
      filteredList.forEach(e => {
        if (!e.processedDate) return;
        const h = new Date(e.processedDate).getHours();
        if (hours[h] !== undefined) hours[h] = (hours[h] || 0) + 1;
      });

      return Object.keys(hours)
        .map(h => parseInt(h))
        .sort((a,b) => a-b)
        .map(h => ({ 
          time: `${h > 12 ? h-12 : (h === 0 ? 12 : h)} ${h >= 12 ? 'PM' : 'AM'}`, 
          count: hours[h] 
        }));
    } else if (trendMetric === 'device') {
      const devices = {};
      filteredList.forEach(e => {
        const devName = e.deviceName || 'Unknown Device';
        devices[devName] = (devices[devName] || 0) + 1;
      });
      return Object.keys(devices)
        .map(dev => ({
          time: dev, 
          count: devices[dev]
        }))
        .sort((a,b) => b.count - a.count); 
    }
    return [];
  }, [filteredList, trendMetric]);

  // Distribution Data
  const distributionData = useMemo(() => {
    const counts = {};
    filteredList.forEach(e => {
      let val = e[distMetric];
      
      if (!val || val === '---' || val === '0' || val === 'NULL') {
        val = 'Other';
      }
      
      counts[val] = (counts[val] || 0) + 1;
    });

    const colors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#0ea5e9', '#14b8a6', '#f43f5e', '#84cc16'];
    
    return Object.keys(counts)
      .map((key, i) => ({
        name: key,
        value: counts[key],
        fill: colors[i % colors.length]
      }))
      .sort((a, b) => b.value - a.value); 
  }, [filteredList, distMetric]);

  const chartIdBase = useId();

  if (loading) {
    return (
      <div className="flex-column flex-center h-screen fade-in">
        <div className="loading-container-box">
          <h2 style={{fontWeight: '950', color: 'var(--text-bold)', letterSpacing: '4px', marginBottom: '30px', textTransform: 'uppercase'}}>
            LOADING DATA...
          </h2>
          <div className="dots-loader">
            <div className="dot"></div>
            <div className="dot"></div>
            <div className="dot"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!activeData || activeData.error) {
    return (
      <div className="flex-column flex-center h-screen fade-in">
        <h2 style={{fontWeight: '900', color: 'var(--text-main)'}}>
          🚫 {activeData?.error ? activeData.error.toUpperCase() : 'CANTEEN UNAVAILABLE'}
        </h2>
        <p className="text-slate mt-10">We couldn't load the information for this canteen.</p>
        <button className="btn-primary mt-30" onClick={() => navigate('/')}>RETURN TO HOME</button>
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
    <div className="main-scrollable-content fade-in">
      <div className="section-header-premium detail-header-v2">
        <div className="header-left-group">
          <div className="global-breadcrumb dark-mode" onClick={() => navigate('/')} style={{ border: '2px solid black' }}>
            <span className="home-icon">🏠</span>
            <span className="breadcrumb-text" style={{ color: 'black' }}>Home</span>
            <span className="breadcrumb-separator">/</span>
          </div>
          <div className="title-stack">
            <h2 className="section-title m-0">{activeData.name}</h2>
            <div className="status-indicator-row">
               <span className="live-dot-pulse"></span>
               <p className="text-slate m-0">Canteen Report • {selectedDate || 'Real-time'}</p>
            </div>
          </div>
        </div>
        
        <div className="header-right-actions" style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
           <button 
             className="btn-god-configure" 
             onClick={() => navigate(`/canteen/${id}/employees`)}
             style={{ height: '48px', padding: '0 20px', fontSize: '0.75rem', margin: 0 }}
           >
             <span>👥</span> EMPLOYEE LIST
           </button>

           <div className="session-info-pill">
              <span className="pill-label">DATE</span>
              <span className="pill-value">{selectedDate || 'LIVE'}</span>
           </div>
        </div>
      </div>

      <div className="detail-status-grid mb-40">
        <div className={`status-pill-v2 blue ${activeTab === 'expected' ? 'active' : ''}`} onClick={() => handleTabChange('expected')}>
          <div className="pill-content">
            <span className="pill-label">EXPECTED</span>
            <span className="pill-value">{processedData?.stats?.totalExpected || 0}</span>
          </div>
          <div className="pill-icon">👥</div>
        </div>
        <div className={`status-pill-v2 yellow ${activeTab === 'inside' ? 'active' : ''}`} onClick={() => handleTabChange('inside')}>
          <div className="pill-content">
            <span className="pill-label">INSIDE</span>
            <span className="pill-value">{processedData?.stats?.currentlyInside || 0}</span>
          </div>
          <div className="pill-icon">🕒</div>
        </div>
        <div className={`status-pill-v2 green ${activeTab === 'completed' ? 'active' : ''}`} onClick={() => handleTabChange('completed')}>
          <div className="pill-content">
            <span className="pill-label">COMPLETED</span>
            <span className="pill-value">{processedData?.stats?.completedLunch || 0}</span>
          </div>
          <div className="pill-icon">✅</div>
        </div>
        <div className={`status-pill-v2 red ${activeTab === 'remaining' ? 'active' : ''}`} onClick={() => handleTabChange('remaining')}>
          <div className="pill-content">
            <span className="pill-label">REMAINING</span>
            <span className="pill-value">{processedData?.stats?.remainingToday || 0}</span>
          </div>
          <div className="pill-icon">⏳</div>
        </div>
      </div>

      <div className="charts-grid-detail mb-40">
        
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
                { value: 'area', label: 'AREA', icon: '🌊' },
                { value: 'bar', label: 'BAR', icon: '📊' },
                { value: 'line', label: 'LINE', icon: '📈' },
                { value: 'composed', label: 'COMPOSED', icon: '📉' }
              ]}
            />
          </div>
          <div style={{height: '350px', marginTop: '20px'}}>
            {renderDynamicChart(trendChartType, trendData, 'trend')}
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
                  { value: 'mealName', label: 'BY ITEM', icon: '🍔' }, 
                  { value: 'category', label: 'BY CATEGORY', icon: '🏷️' },
                  { value: 'location', label: 'BY LOCATION', icon: '📍' },
                  { value: 'company', label: 'BY COMPANY', icon: '🏢' },
                  { value: 'group', label: 'BY GROUP', icon: '👥' },
                  { value: 'div', label: 'BY DIVISION', icon: '📑' },
                  { value: 'dept', label: 'BY DEPARTMENT', icon: '📁' }
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
            {renderDynamicChart(distChartType, distributionData, 'dist')}
          </div>
        </div>

      </div>

      <div className="table-section-premium mb-60" ref={tableRef}>
        <div className="flex-between mb-20 flex-align-center" style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '15px' }}>
          
          <h2 className="section-title m-0" style={{fontSize: '1.25rem', color: 'var(--text-bold)', textTransform: 'capitalize'}}>
            📋 {activeTab} List
          </h2>

          <div className="flex-align-center gap-15">
            <div className="search-container-premium">
              <span style={{ fontSize: '1.2rem', opacity: 0.5 }}>🔍</span>
              <input 
                className="search-input-premium" 
                placeholder="Search by Name, ID, or Item..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
            <button className="btn-export-premium" style={{ height: '52px', borderRadius: '16px' }} onClick={executeExport}>
               <span className="export-icon">📊</span> EXCEL EXPORT
            </button>
          </div>
        </div>

        <div className="table-container fade-in" style={{ padding: '0', boxShadow: 'none' }}>
          <table className="modern-table">
            <thead>
              <tr>
                <th onClick={() => handleSort('id')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                  🏷️ ID {sortConfig.key === 'id' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                </th>
                <th onClick={() => handleSort('name')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                  👤 NAME {sortConfig.key === 'name' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                </th>
                <th onClick={() => handleSort('category')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                  📁 CATEGORY {sortConfig.key === 'category' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                </th>
                <th onClick={() => handleSort('ipAddress')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                  🌐 IP ADDRESS {sortConfig.key === 'ipAddress' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                </th>
                <th onClick={() => handleSort('deviceName')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                  📟 DEVICE {sortConfig.key === 'deviceName' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                </th>
                
                {showItemColumn && (
                  <th onClick={() => handleSort('mealName')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                    🍔 ITEM NAME {sortConfig.key === 'mealName' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                  </th>
                )}
                
                <th onClick={() => handleSort('inOut')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                  🚦 STATUS {sortConfig.key === 'inOut' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                </th>
                <th onClick={() => handleSort('processedDate')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                  ⏱️ LAST SCANNED {sortConfig.key === 'processedDate' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredList.map((e, idx) => {
                const isOut = ['O', 'P20', 'OUT'].includes(String(e.inOut).toUpperCase());
                const isIn = ['I', 'P10', 'IN'].includes(String(e.inOut).toUpperCase());
                
                let badgeClass = 'info-badge opacity-50';
                let badgeText = e.inOut;
                
                if (isIn) {
                  badgeClass = 'success-badge';
                  badgeText = 'IN';
                } else if (isOut) {
                  badgeClass = 'danger-badge';
                  badgeText = 'OUT';
                }

                const hasItem = e.mealName && e.mealName !== '---';

                return (
                  /* FIX: Added compound key utilizing idx to prevent React node duplication during sorting */
                  <tr key={`${e.id}-${idx}`} style={{ animationDelay: `${idx * 0.03}s` }}>
                    <td><strong style={{color: 'var(--primary)', letterSpacing: '1px'}}>#{e.id}</strong></td>
                    <td style={{fontWeight: '700'}}>{e.name}</td>
                    <td><span className="badge info-badge" style={{fontSize: '0.65rem'}}>{e.category}</span></td>
                    <td className="text-slate" style={{fontSize: '0.8rem'}}>{e.ipAddress}</td>
                    <td style={{fontSize: '0.8rem', fontWeight: '600'}}>{e.deviceName}</td>
                    
                    {showItemColumn && (
                      <td>
                        {hasItem ? (
                           <span className="badge" style={{fontSize: '0.7rem', fontWeight: '800', background: '#e0e7ff', color: '#4338ca'}}>
                             {e.mealName}
                           </span>
                        ) : (
                           <span></span> 
                        )}
                      </td>
                    )}
                    
                    <td>
                      <span className={`badge ${badgeClass}`}>
                         {badgeText}
                      </span>
                    </td>
                    <td className="text-slate" style={{fontSize: '0.85rem', fontWeight: '800'}}>
                      {e.processedDate ? new Date(e.processedDate).toLocaleString('en-GB', { hour12: false }) : '---'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredList.length === 0 && (
            <div className="no-data-premium-v2 fade-in" style={{ borderTop: '1px solid #e2e8f0' }}>
              <div className="no-data-illustration">📭</div>
              <h3>No Results Found</h3>
              <p>
                We couldn't find any employees matching your current search or filter criteria.
              </p>
              <button 
                className="btn-primary mt-20" 
                style={{ padding: '12px 30px', borderRadius: '14px' }}
                onClick={() => setSearchQuery('')}
              >
                CLEAR FILTERS
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default CanteenDetail;