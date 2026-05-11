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

function ItemDetail({ selectedDate }) {
  const { canteenId: itemNameParam } = useParams(); // URL passes item name here
  const navigate = useNavigate();
  const tableRef = useRef(null);

  const decodedItemName = decodeURIComponent(itemNameParam);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [dashboardData, setDashboardData] = useState([]);
  const [itemsMaster, setItemsMaster] = useState([]);

  const [activeTab, setActiveTab] = useState('completed');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [trendMetric, setTrendMetric] = useState('hourly');
  const [distMetric, setDistMetric] = useState('canteenName'); 
  
  const [trendChartType, setTrendChartType] = useState('area');
  const [distChartType, setDistChartType] = useState('donut');
  const [sortConfig, setSortConfig] = useState({ key: 'processedDate', direction: 'desc' });

  useEffect(() => {
    const abortController = new AbortController();
    const signal = abortController.signal;

    const fetchData = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('eatsync_token');
            const headers = { 'Authorization': `Bearer ${token}` };

            // 1. Fetch Dashboard (to know which canteens exist) & Item Master
            const [dashRes, itemsRes] = await Promise.all([
                fetch(`${API_BASE_URL}${selectedDate ? `/api/dashboard?date=${selectedDate}` : '/api/dashboard'}`, { signal, headers }),
                fetch(`${API_BASE_URL}/api/items`, { signal, headers }).catch(() => null)
            ]);
            
            if (!dashRes.ok) throw new Error("Failed to fetch dashboard data.");
            
            const dashData = await dashRes.json();
            const canteensList = dashData.canteens || dashData.data || [];

            // 2. 🚨 FIX: Deep Fetch EVERY canteen to get the full `employeesCompleted` logs
            const detailPromises = canteensList.map(async (c) => {
                try {
                    const detailRes = await fetch(`${API_BASE_URL}/api/canteen-detail/${c.id || c.CanteenID}${selectedDate ? `?date=${selectedDate}` : ''}`, { signal, headers });
                    if (detailRes.ok) {
                        const detailData = await detailRes.json();
                        return { ...detailData, canteenName: c.name };
                    }
                } catch (err) {}
                return { ...c, canteenName: c.name }; // Fallback to shallow data if fetch fails
            });

            const fullCanteensData = await Promise.all(detailPromises);
            setDashboardData(fullCanteensData);

            // 3. Set Item Data properly
            let itemsData = [];
            if (itemsRes && itemsRes.ok) {
                itemsData = await itemsRes.json();
            } else {
                const fallbackRes = await fetch(`${API_BASE_URL}/api/all-items`, { signal, headers }).catch(() => null);
                if (fallbackRes && fallbackRes.ok) itemsData = await fallbackRes.json();
            }
            setItemsMaster(itemsData || []);

        } catch (err) {
            if (err.name !== 'AbortError') {
              console.error("Error fetching item details:", err);
              setError("Failed to load item data. Please check your connection.");
            }
        } finally {
            if (!signal.aborted) {
                setLoading(false);
            }
        }
    };
    
    fetchData();

    return () => {
      abortController.abort(); 
    };
  }, [decodedItemName, selectedDate]);

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

  const itemDetailsMaster = useMemo(() => {
    return itemsMaster.find(i => String(i.ItemName || i.itemname || i.itemName).trim().toLowerCase() === decodedItemName.trim().toLowerCase()) || {};
  }, [itemsMaster, decodedItemName]);

  const processedData = useMemo(() => {
    if (dashboardData.length === 0) return null;
    
    const employeesInside = [];
    const employeesCompleted = [];
    const employeesNextBatch = [];

    const targetName = decodedItemName.trim().toLowerCase();

    const mapEmployee = (e, canteenName) => {
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
            mealName: e.mealName || e.ItemName || e.itemName || '---',
            canteenName: canteenName,
            itemGroup: itemDetailsMaster.ItemGroup || itemDetailsMaster.itemgroup || 'Normal',
            shiftGroup: itemDetailsMaster.ShiftGroup || itemDetailsMaster.shiftgroup || 'General'
        };
    };

    const isMatch = (e) => {
        const mName = String(e.mealName || e.ItemName || e.itemName || '').trim().toLowerCase();
        return mName === targetName;
    };

    dashboardData.forEach(canteen => {
        const cName = canteen.canteenName || canteen.name || 'Unknown Canteen';
        
        // Pull arrays from the deep fetch or fallbacks
        const inside = canteen.employeesInside || canteen.stats?.insideList || canteen.insideList || [];
        const completed = canteen.employeesCompleted || canteen.stats?.completedList || canteen.completedList || [];
        const nextBatch = canteen.employeesNextBatch || canteen.stats?.nextBatchList || canteen.nextBatchList || [];

        inside.forEach(e => {
            if (isMatch(e)) employeesInside.push(mapEmployee(e, cName));
        });

        completed.forEach(e => {
            if (isMatch(e)) employeesCompleted.push(mapEmployee(e, cName));
        });

        nextBatch.forEach(e => {
            if (isMatch(e)) employeesNextBatch.push(mapEmployee(e, cName));
        });
    });

    return {
        stats: {
            currentlyInside: employeesInside.length,
            completedLunch: employeesCompleted.length,
            nextBatchCount: employeesNextBatch.length,
            totalConsumed: employeesInside.length + employeesCompleted.length + employeesNextBatch.length
        },
        employeesInside,
        employeesCompleted,
        employeesNextBatch
    };
  }, [dashboardData, decodedItemName, itemDetailsMaster]);

  const filteredList = useMemo(() => {
    if (!processedData) return [];
    let list = [];
    if (activeTab === 'inside') list = processedData.employeesInside || [];
    else if (activeTab === 'completed') list = processedData.employeesCompleted || [];
    else if (activeTab === 'nextBatch') list = processedData.employeesNextBatch || [];

    if (searchQuery) {
      const sq = searchQuery.toLowerCase();
      list = list.filter(e => 
        (e.name || '').toLowerCase().includes(sq) || 
        String(e.id).includes(sq) ||
        (e.canteenName || '').toLowerCase().includes(sq) 
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
      'Canteen': e.canteenName || '---',
      'Category': e.category || '---',
      'Company': e.company || '---',
      'Item Name': decodedItemName,
      'Item Group': e.itemGroup,
      'Shift Group': e.shiftGroup,
      'Status': e.inOut || '---',
      'Processed Date': e.processedDate ? new Date(e.processedDate).toLocaleString('en-GB') : '---'
    }));

    const titleRows = [
      [`Item Consumption Report: ${decodedItemName} (${activeTab.toUpperCase()})`],
      [`Report Date: ${reportDateLabel}`],
      [`Generated On: ${new Date().toLocaleString()}`],
      [`Total Served: ${totalCount}`],
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
    if (worksheet['A2']) worksheet['A2'].s = { font: { bold: true, color: { rgb: "8B5CF6" } }, alignment: { horizontal: "center", vertical: "center" } };
    if (worksheet['A3']) worksheet['A3'].s = { font: { italic: true, color: { rgb: "666666" } }, alignment: { horizontal: "center", vertical: "center" } };

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
    XLSX.utils.book_append_sheet(workbook, worksheet, "Item Log");
    XLSX.writeFile(workbook, `${decodedItemName}_${activeTab}_Log.xlsx`);
  };

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
    } else if (trendMetric === 'canteen') {
      const canteens = {};
      filteredList.forEach(e => {
        const cName = e.canteenName || 'Unknown Canteen';
        canteens[cName] = (canteens[cName] || 0) + 1;
      });
      return Object.keys(canteens)
        .map(c => ({
          time: c, 
          count: canteens[c]
        }))
        .sort((a,b) => b.count - a.count); 
    }
    return [];
  }, [filteredList, trendMetric]);

  const distributionData = useMemo(() => {
    const counts = {};
    filteredList.forEach(e => {
      let val = e[distMetric];
      
      if (!val || val === '---' || val === '0' || val === 'NULL') {
        val = 'Other';
      }
      
      counts[val] = (counts[val] || 0) + 1;
    });

    const colors = ['#8b5cf6', '#ec4899', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#0ea5e9', '#14b8a6', '#f43f5e', '#84cc16'];
    
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
            LOADING MENU LOGS...
          </h2>
          <div className="dots-loader">
            <div className="dot" style={{ background: '#8b5cf6' }}></div>
            <div className="dot" style={{ background: '#8b5cf6' }}></div>
            <div className="dot" style={{ background: '#8b5cf6' }}></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-column flex-center h-screen fade-in">
        <h2 style={{fontWeight: '900', color: 'var(--text-main)'}}>
          🚫 {error.toUpperCase()}
        </h2>
        <p className="text-slate mt-10">We couldn't load the information for this item.</p>
        <button className="btn-primary mt-30" style={{ background: '#8b5cf6' }} onClick={() => navigate('/')}>RETURN TO HOME</button>
      </div>
    );
  }

  const renderDynamicChart = (type, data, chartIdSuffix) => {
    const commonProps = {
      data,
      margin: { top: 20, right: 30, left: 0, bottom: 20 }
    };

    const tooltipStyle = {
      borderRadius: '16px',
      border: 'none',
      boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
      fontFamily: 'Outfit',
      fontWeight: '600'
    };

    const customLegendStyle = {
      padding: '12px 20px',
      background: '#f8fafc',
      border: '1px solid #e2e8f0',
      borderRadius: '16px',
      boxShadow: '0 4px 10px rgba(0,0,0,0.04)',
      fontSize: '0.75rem',
      fontWeight: '800',
      color: '#475569',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '15px'
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
            <Legend layout="horizontal" verticalAlign="bottom" align="center" iconType="circle" wrapperStyle={customLegendStyle} />
            <Line 
              name="Served Count"
              type="monotone" 
              dataKey={yAxisKey} 
              stroke="#8b5cf6" 
              strokeWidth={4} 
              dot={{r: 6, fill: '#8b5cf6', strokeWidth: 3, stroke: '#fff'}} 
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
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey={xAxisKey} stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} dy={10} />
              <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} dx={-10} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend layout="horizontal" verticalAlign="bottom" align="center" iconType="circle" wrapperStyle={customLegendStyle} />
              <Area 
                name="Served Count"
                type="monotone" 
                dataKey={yAxisKey} 
                stroke="#8b5cf6" 
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
              <Legend layout="horizontal" verticalAlign="bottom" align="center" iconType="circle" wrapperStyle={customLegendStyle} />
              <Bar name="Count" dataKey={yAxisKey} fill="#d8b4fe" radius={[4, 4, 0, 0]} barSize={40} />
              <Line name="Trend Curve" type="monotone" dataKey={yAxisKey} stroke="#7c3aed" strokeWidth={3} dot={{r: 4}} />
            </ComposedChart>
          </ResponsiveContainer>
        );
    }

    if (type === 'pie' || type === 'donut') {
      return (
        <ResponsiveContainer width="100%" height="100%">
          <PieChart margin={{ top: 0, right: 0, left: 0, bottom: 20 }}>
            <Pie 
              key={`pie-${data.length}`}
              data={data} 
              cx="50%" cy="45%" 
              innerRadius={type === 'donut' ? 80 : 0} 
              outerRadius={110} 
              paddingAngle={5} 
              dataKey={yAxisKey}
              nameKey={xAxisKey}
              label={({name, percent}) => `${(percent * 100).toFixed(0)}%`}
              isAnimationActive={false}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill || '#8b5cf6'} />
              ))}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} />
            <Legend layout="horizontal" verticalAlign="bottom" align="center" iconType="circle" wrapperStyle={{...customLegendStyle, marginTop: '20px'}} />
          </PieChart>
        </ResponsiveContainer>
      );
    }

    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart {...commonProps}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8b5cf6" stopOpacity={1}/>
              <stop offset="100%" stopColor="#c084fc" stopOpacity={0.6}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
          <XAxis dataKey={xAxisKey} stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} dy={10} />
          <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} dx={-10} />
          <Tooltip contentStyle={tooltipStyle} cursor={{fill: '#f8fafc'}} />
          <Legend layout="horizontal" verticalAlign="bottom" align="center" iconType="circle" wrapperStyle={customLegendStyle} />
          <Bar 
            name="Served Count"
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
      <div className="section-header-premium detail-header-v2" style={{ border: '1px solid rgba(139, 92, 246, 0.2)', boxShadow: '0 20px 50px rgba(139, 92, 246, 0.05)' }}>
        <div className="header-left-group">
          <div className="global-breadcrumb dark-mode" onClick={() => navigate('/')} style={{ border: '2px solid black' }}>
            <span className="home-icon">🏠</span>
            <span className="breadcrumb-text" style={{ color: 'black' }}>Home</span>
            <span className="breadcrumb-separator">/</span>
          </div>
          <div className="title-stack">
            <h2 className="section-title m-0" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '1.6rem', background: '#f3e8ff', color: '#7c3aed', padding: '8px 12px', borderRadius: '12px', border: '1px solid #d8b4fe' }}>🍔</span>
              {decodedItemName}
            </h2>
            <div className="status-indicator-row" style={{ marginTop: '8px' }}>
               <span className="live-dot-pulse" style={{ background: '#8b5cf6', boxShadow: '0 0 10px #8b5cf6' }}></span>
               <p className="text-slate m-0" style={{ fontWeight: '700' }}>
                 Item Group: {itemDetailsMaster.ItemGroup || 'Normal'} • Shift: {itemDetailsMaster.ShiftGroup || 'General'} • {selectedDate ? `Data for ${selectedDate}` : 'Live Real-Time Monitoring'}
               </p>
            </div>
          </div>
        </div>
        
        <div className="header-right-actions" style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
           <div className="session-info-pill" style={{ background: '#f3e8ff', borderColor: '#d8b4fe' }}>
              <span className="pill-label" style={{ color: '#7c3aed' }}>DATE</span>
              <span className="pill-value" style={{ color: '#6d28d9' }}>{selectedDate || 'LIVE NOW'}</span>
           </div>
        </div>
      </div>

      <div className="detail-status-grid mb-40">
        <div className={`status-pill-v2 yellow ${activeTab === 'inside' ? 'active' : ''}`} onClick={() => handleTabChange('inside')}>
          <div className="pill-content">
            <span className="pill-label">BEING CONSUMED (INSIDE)</span>
            <span className="pill-value">{processedData?.stats?.currentlyInside || 0}</span>
          </div>
          <div className="pill-icon">🕒</div>
        </div>
        <div className={`status-pill-v2 green ${activeTab === 'completed' ? 'active' : ''}`} onClick={() => handleTabChange('completed')}>
          <div className="pill-content">
            <span className="pill-label">COMPLETED MEALS</span>
            <span className="pill-value">{processedData?.stats?.completedLunch || 0}</span>
          </div>
          <div className="pill-icon">✅</div>
        </div>
        <div className={`status-pill-v2 red ${activeTab === 'nextBatch' ? 'active' : ''}`} onClick={() => handleTabChange('nextBatch')}>
          <div className="pill-content">
            <span className="pill-label">NEXT BATCH / PENDING</span>
            <span className="pill-value">{processedData?.stats?.nextBatchCount || 0}</span>
          </div>
          <div className="pill-icon">⏳</div>
        </div>
        <div className="status-pill-v2 blue" style={{ cursor: 'default', transform: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
          <div className="pill-content">
            <span className="pill-label">TOTAL CONSUMED</span>
            <span className="pill-value">{processedData?.stats?.totalConsumed || 0}</span>
          </div>
          <div className="pill-icon">📊</div>
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
                  { value: 'hourly', label: 'HOURLY CONSUMPTION', icon: '⏱️' },
                  { value: 'canteen', label: 'BY CANTEEN', icon: '🏢' }
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
                  { value: 'canteenName', label: 'BY CANTEEN', icon: '🏢' }, 
                  { value: 'category', label: 'BY CATEGORY', icon: '🏷️' },
                  { value: 'company', label: 'BY COMPANY', icon: '🏗️' },
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
            📋 {activeTab === 'nextBatch' ? 'Pending Batch' : activeTab} List
          </h2>

          <div className="flex-align-center gap-15">
            <div className="search-container-premium">
              <span style={{ fontSize: '1.2rem', opacity: 0.5 }}>🔍</span>
              <input 
                className="search-input-premium" 
                placeholder="Search by Name, ID, or Canteen..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
            <button className="btn-export-premium" style={{ height: '52px', borderRadius: '16px', background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)', boxShadow: '0 10px 20px -5px rgba(139, 92, 246, 0.4)' }} onClick={executeExport}>
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
                <th onClick={() => handleSort('canteenName')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                  🏢 CANTEEN {sortConfig.key === 'canteenName' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                </th>
                <th onClick={() => handleSort('itemGroup')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                  🍔 ITEM GROUP {sortConfig.key === 'itemGroup' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                </th>
                <th onClick={() => handleSort('shiftGroup')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                  ⏱️ SHIFT GROUP {sortConfig.key === 'shiftGroup' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                </th>
                <th onClick={() => handleSort('inOut')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                  🚦 STATUS {sortConfig.key === 'inOut' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                </th>
                <th onClick={() => handleSort('processedDate')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                  ⌚ LAST SCANNED {sortConfig.key === 'processedDate' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
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

                return (
                  <tr key={`${e.id}-${idx}`} style={{ animationDelay: `${idx * 0.03}s` }}>
                    <td><strong style={{color: 'var(--primary)', letterSpacing: '1px'}}>#{e.id}</strong></td>
                    <td style={{fontWeight: '700'}}>{e.name}</td>
                    <td><span className="badge warning-badge" style={{fontSize: '0.65rem'}}>{e.canteenName}</span></td>
                    
                    <td><span style={{ fontSize: '0.8rem', fontWeight: '800', color: '#475569' }}>{e.itemGroup}</span></td>
                    <td><span style={{ fontSize: '0.8rem', fontWeight: '800', color: '#8b5cf6' }}>{e.shiftGroup}</span></td>
                    
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
              <div className="no-data-illustration" style={{ filter: 'hue-rotate(270deg)' }}>📭</div>
              <h3>No Results Found</h3>
              <p>
                We couldn't find any employees matching your current search or filter criteria for this item.
              </p>
              <button 
                className="btn-primary mt-20" 
                style={{ padding: '12px 30px', borderRadius: '14px', background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)' }}
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

export default ItemDetail;