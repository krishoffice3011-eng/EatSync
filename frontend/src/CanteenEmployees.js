// src/CanteenEmployees.js
import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import API_BASE_URL from './config';
import * as XLSX from 'xlsx-js-style';

function CanteenEmployees() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [data, setData] = useState({ canteenName: '', employees: [], activeFilters: {} });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });

  // 🔒 FIX: Added JWT Injection for Canteen Employees List
  useEffect(() => {
    const abortController = new AbortController();
    const signal = abortController.signal;

    const fetchEmployees = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('eatsync_token');
        const res = await fetch(`${API_BASE_URL}/api/canteen-employees/${id}`, { 
            signal,
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!res.ok) throw new Error("Authentication failed or forbidden access");

        const result = await res.json();
        
        if (result.error) {
           setData({ canteenName: 'Error', employees: [], activeFilters: {}, error: result.error });
        } else {
           setData(result);
        }
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error("Error fetching canteen employees:", err);
          setData({ canteenName: 'Connection Error', employees: [], activeFilters: {}, error: "Failed to load employee data." });
        }
      } finally {
        if (!signal.aborted) {
          setLoading(false);
        }
      }
    };
    
    fetchEmployees();

    return () => {
      abortController.abort(); // Cancel pending fetch on unmount
    };
  }, [id]);

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const filteredAndSortedEmployees = useMemo(() => {
    if (!data.employees) return [];
    
    let filtered = data.employees;
    if (searchQuery) {
      const lowerQuery = searchQuery.toLowerCase();
      filtered = filtered.filter(e => 
        (e.name && e.name.toLowerCase().includes(lowerQuery)) || 
        (e.empcode && String(e.empcode).toLowerCase().includes(lowerQuery)) ||
        (e.company && (e.company || '').toLowerCase().includes(lowerQuery)) ||
        (e.dept && (e.dept || '').toLowerCase().includes(lowerQuery))
      );
    }

    return filtered.sort((a, b) => {
      let valA = a[sortConfig.key] || ''; 
      let valB = b[sortConfig.key] || '';
      
      if (sortConfig.key === 'empcode') {
         valA = valA.toString();
         valB = valB.toString();
      }

      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [data.employees, searchQuery, sortConfig]);

  // Excel Export Logic
  const executeExport = () => {
    if (filteredAndSortedEmployees.length === 0) {
      alert("No data available to export.");
      return;
    }

    const totalCount = filteredAndSortedEmployees.length;

    const exportData = filteredAndSortedEmployees.map(e => ({
      'Emp Code': e.empcode,
      'Name': e.name,
      'Designation': e.designation || '---',
      'Category': e.category || '---',
      'Company': e.company || '---',
      'Department': e.dept || '---',
      'Division': e.div || '---',
      'Location': e.location || '---',
      'Group': e.group || '---',
      'Join Date': e.joinDate || '---',
      'Leave Date': e.leaveDate || '---'
    }));

    const titleRows = [
      [`Employee List: ${data.canteenName}`],
      [`Generated On: ${new Date().toLocaleString()}`],
      [`Total Employees: ${totalCount}`],
      [] 
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(titleRows);
    XLSX.utils.sheet_add_json(worksheet, exportData, { origin: "A5" });
    
    const headers = Object.keys(exportData[0]);
    
    worksheet['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: headers.length - 1 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: headers.length - 1 } }
    ];

    if (worksheet['A1']) worksheet['A1'].s = { font: { bold: true, sz: 14 }, alignment: { horizontal: "center", vertical: "center" } };
    if (worksheet['A2']) worksheet['A2'].s = { font: { italic: true, color: { rgb: "666666" } }, alignment: { horizontal: "center", vertical: "center" } };
    if (worksheet['A3']) worksheet['A3'].s = { font: { bold: true, color: { rgb: "10B981" } }, alignment: { horizontal: "center", vertical: "center" } };

    const range = XLSX.utils.decode_range(worksheet['!ref']);
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cellAddress = XLSX.utils.encode_cell({ r: 4, c: C });
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
    XLSX.utils.book_append_sheet(workbook, worksheet, "Employee List");
    XLSX.writeFile(workbook, `${data.canteenName.replace(/\s+/g, '_')}_Employees.xlsx`);
  };

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

  if (data.error) {
    return (
      <div className="flex-column flex-center h-screen fade-in">
        <h2 style={{fontWeight: '900', color: 'var(--danger)'}}>🚫 {data.error.toUpperCase()}</h2>
        <button className="btn-primary mt-20" onClick={() => navigate(-1)}>GO BACK</button>
      </div>
    );
  }

  return (
    <div className="main-pane-100">
      <div className="top-navbar premium-alt">
        <div className="navbar-left">
          <div style={{ display: 'flex', gap: '10px' }}>
            <div className="global-breadcrumb dark-mode" onClick={() => navigate('/')}>
              <span className="home-icon">🏠</span>
              <span className="breadcrumb-text">Home</span>
            </div>
            <div className="global-breadcrumb dark-mode" onClick={() => navigate(-1)}>
              <span className="home-icon">←</span>
              <span className="breadcrumb-text">Canteen</span>
            </div>
          </div>
        </div>
        <div className="navbar-center">
          <h1 className="m-0" style={{ fontSize: '1.4rem', fontWeight: '900', letterSpacing: '-0.5px' }}>{data.canteenName} - Employee List</h1>
        </div>
        <div className="navbar-right">
          <span className="badge info-badge" style={{ padding: '8px 20px', fontSize: '0.75rem' }}>{filteredAndSortedEmployees.length} EMPLOYEES</span>
        </div>
      </div>

      <main className="main-scrollable-content fade-in">
        <div className="flex-between mb-40 flex-align-start" style={{ marginTop: '20px', alignItems: 'flex-start' }}>
          <div style={{ flex: 1, paddingRight: '40px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <h2 className="section-title m-0" style={{fontSize: '1.5rem', fontWeight: '900'}}>📋 Employee List</h2>
                <span className="badge success-badge" style={{ fontSize: '0.75rem' }}>Total Count: {filteredAndSortedEmployees.length}</span>
            </div>
            <p className="text-slate" style={{fontSize: '0.85rem', marginTop: '5px', marginBottom: '20px'}}>
              Employees assigned to this canteen.
            </p>
            
            <div style={{ background: '#f8fafc', padding: '18px 22px', borderRadius: '16px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: '950', color: 'var(--text-bold)', textTransform: 'uppercase', letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>⚙️</span> ACTIVE FILTERS
              </div>
              
              {data.activeFilters && Object.keys(data.activeFilters).length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '4px' }}>
                  {Object.entries(data.activeFilters).map(([key, values]) => {
                    if (values.length === 0) return null;
                    
                    const labelMap = { loc: 'LOCATION', location: 'LOCATION', cat: 'CATEGORY', company: 'COMPANY', grp: 'GROUP', div: 'DIVISION', dept: 'DEPARTMENT' };
                    const displayLabel = labelMap[key.toLowerCase()] || key.toUpperCase();

                    return (
                      <div key={key} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: '10px' }}>
                         <span style={{ fontSize: '0.7rem', fontWeight: '900', color: '#64748b', width: '100px', flexShrink: 0, marginTop: '5px' }}>
                           {displayLabel}:
                         </span>
                         <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', flex: 1 }}>
                           {values.map((val, i) => (
                             <span key={i} className="badge info-badge" style={{ fontSize: '0.65rem', padding: '6px 12px', background: 'white', border: '1.5px solid #bae6fd', color: '#0369a1' }}>
                               {val}
                             </span>
                           ))}
                         </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <span style={{ fontSize: '0.75rem', color: 'var(--text-light)', fontWeight: '700' }}>No active filters detected. Showing all mapped IPs.</span>
              )}
            </div>
          </div>
          
          <div className="flex-align-center gap-15" style={{ flexShrink: 0 }}>
            <div className="search-container-premium" style={{ width: '350px' }}>
              <span style={{ fontSize: '1.2rem', opacity: 0.5 }}>🔍</span>
              <input 
                className="search-input-premium" 
                placeholder="Search by Name, ID, or Dept..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
            <button className="btn-export-premium" style={{ height: '52px', borderRadius: '16px' }} onClick={executeExport}>
               <span className="export-icon">📊</span> EXCEL EXPORT
            </button>
          </div>
        </div>

        <div className="table-section-premium" style={{ border: '1px solid #e2e8f0', background: 'white' }}>
          <div className="table-container fade-in" style={{ marginTop: 0, overflowX: 'auto', maxWidth: '100%', boxShadow: 'none' }}>
            <table className="modern-table" style={{ whiteSpace: 'nowrap', minWidth: '1200px' }}>
              <thead>
                <tr>
                  <th onClick={() => handleSort('empcode')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                    🏷️ ID {sortConfig.key === 'empcode' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}
                  </th>
                  <th onClick={() => handleSort('name')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                    👤 NAME {sortConfig.key === 'name' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}
                  </th>
                  <th onClick={() => handleSort('designation')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                    💼 DESIGNATION {sortConfig.key === 'designation' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}
                  </th>
                  <th onClick={() => handleSort('category')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                    📁 CATEGORY {sortConfig.key === 'category' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}
                  </th>
                  <th onClick={() => handleSort('company')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                    🏢 COMPANY {sortConfig.key === 'company' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}
                  </th>
                  <th onClick={() => handleSort('dept')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                    📂 DEPARTMENT {sortConfig.key === 'dept' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}
                  </th>
                  <th onClick={() => handleSort('div')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                    📑 DIVISION {sortConfig.key === 'div' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}
                  </th>
                  <th onClick={() => handleSort('location')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                    📍 LOCATION {sortConfig.key === 'location' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}
                  </th>
                  <th onClick={() => handleSort('group')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                    👥 GROUP {sortConfig.key === 'group' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}
                  </th>
                  <th onClick={() => handleSort('joinDate')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                    🟢 JOIN DATE {sortConfig.key === 'joinDate' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}
                  </th>
                  <th onClick={() => handleSort('leaveDate')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                    🔴 LEAVE DATE {sortConfig.key === 'leaveDate' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredAndSortedEmployees.map((e, idx) => (
                  <tr key={e.empcode} style={{ animationDelay: `${idx * 0.02}s` }}>
                    <td><strong className="ip-code" style={{color: 'var(--primary)', letterSpacing: '1px'}}>#{e.empcode}</strong></td>
                    <td style={{fontWeight: '800', color: 'var(--text-bold)'}}>{e.name}</td>
                    <td style={{fontSize: '0.8rem', fontWeight: '700', color: '#475569'}}>{e.designation}</td>
                    <td><span className="badge warning-badge" style={{fontSize: '0.65rem', background: '#fef3c7', color: '#d97706'}}>{e.category}</span></td>
                    <td><span className="badge info-badge" style={{fontSize: '0.65rem'}}>{e.company}</span></td>
                    
                    <td><span style={{fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-main)'}}>{e.dept}</span></td>
                    <td><span style={{fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-main)'}}>{e.div}</span></td>
                    <td><span style={{fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-main)'}}>{e.location}</span></td>
                    <td><span style={{fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-main)'}}>{e.group}</span></td>
                    
                    <td><span style={{fontSize: '0.8rem', fontWeight: '800', color: '#059669'}}>{e.joinDate}</span></td>
                    <td><span style={{fontSize: '0.8rem', fontWeight: '800', color: e.leaveDate === '---' ? '#94a3b8' : '#e11d48'}}>{e.leaveDate}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            {filteredAndSortedEmployees.length === 0 && (
              <div className="no-data-premium-v2 fade-in" style={{ borderTop: '1px solid #e2e8f0' }}>
                <div className="no-data-illustration">👥</div>
                <h3>No Employees Found</h3>
                <p>No employees match the current filters or terminal configurations for this canteen.</p>
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
      </main>
    </div>
  );
}

export default CanteenEmployees;