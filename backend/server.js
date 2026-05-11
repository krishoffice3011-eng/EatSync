// server.js
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const sql = require("mssql"); 
const jwt = require("jsonwebtoken"); 
const config = require("./config");
const adminRoutes = require("./admin"); 

const app = express();
app.use(cors());
app.use(express.json());

// ==========================================
// 🔒 AUTHENTICATION MIDDLEWARE
// ==========================================
const JWT_SECRET = process.env.JWT_SECRET || "EatSync_Super_Secret_Key_Change_Me_In_Production";

const authenticateJWT = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader) {
        const token = authHeader.split(' ')[1];
        jwt.verify(token, JWT_SECRET, (err, user) => {
            if (err) return res.status(403).json({ error: "Invalid or expired token." });
            req.user = user;
            next();
        });
    } else {
        res.status(401).json({ error: "Authentication required." });
    }
};

// ==========================================
// 🌐 WEB SOCKET SERVER SETUP
// ==========================================
const server = http.createServer(app);
const io = new Server(server, { 
    cors: { origin: "*", methods: ["GET", "POST", "PUT", "DELETE"] },
    transports: ['polling', 'websocket'] 
});

const dbConfig = config.dbConfig;
const PORT = config.PORT;

const appPool = new sql.ConnectionPool(dbConfig);
const poolConnect = appPool.connect().then(() => {
    console.log(`✅ Global DB Connection Pool Established`);
    startSmartPolling(); 
    return appPool;
}).catch(err => {
    console.error("🚨 CRITICAL: DATABASE CONNECTION REJECTED 🚨", err.message);
    process.exit(1); 
});

const handleSQLError = (err, res = null, context = "Database Query") => {
    console.error(`\x1b[31m\n❌ [DB ERROR] \x1b[33m(${context}):\x1b[0m`, err.message, '\n');
    if (res && !res.headersSent) res.status(500).json({ success: false, error: "Internal DB error." });
};

// ==========================================
// 🛠️ TIMEZONE & UTILITY FUNCTIONS
// ==========================================
const getISTDateStr = () => {
    const d = new Date();
    const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
    const ist = new Date(utc + (3600000 * 5.5));
    return `${ist.getFullYear()}-${String(ist.getMonth() + 1).padStart(2, '0')}-${String(ist.getDate()).padStart(2, '0')}`;
};

const getISTTimeMins = () => {
    const d = new Date();
    const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
    const ist = new Date(utc + (3600000 * 5.5));
    return (ist.getHours() * 60) + ist.getMinutes();
};

const normalizeEmpCode = (code) => {
    let c = String(code || "").trim().toUpperCase();
    c = c.replace(/^0+/, ''); 
    return c === '' ? '0' : c;
};

const normalizeIO = (io) => {
    const s = String(io || "").trim().toUpperCase();
    if (['I', 'IN', 'P10', '1', 'TRUE'].includes(s)) return 'IN';
    if (['O', 'OUT', 'P20', '0', 'FALSE'].includes(s)) return 'OUT';
    return null; 
};

const getPrevDayDateStr = (targetDateStr) => {
    const [y, m, d] = targetDateStr.split('-').map(Number);
    const prevDay = new Date(y, m - 1, d - 1);
    return `${prevDay.getFullYear()}-${String(prevDay.getMonth() + 1).padStart(2, '0')}-${String(prevDay.getDate()).padStart(2, '0')}`;
};

const getNextDayDateStr = (targetDateStr) => {
    const [y, m, d] = targetDateStr.split('-').map(Number);
    const nextDay = new Date(y, m - 1, d + 1);
    return `${nextDay.getFullYear()}-${String(nextDay.getMonth() + 1).padStart(2, '0')}-${String(nextDay.getDate()).padStart(2, '0')}`;
};

const activeDateMap = (recordset) => {
  if(!recordset) return [];
  return recordset.map((r) => r.ActiveDate || r.activedate);
};

const normalizeRecordset = (recordset) => {
    if (!recordset) return [];
    return recordset.map(row => {
        const normalized = {};
        for (const key in row) if (row[key] !== null && row[key] !== undefined) normalized[key.toLowerCase()] = row[key];
        return normalized;
    });
};

const determineShift = (timeStr) => {
    if (!timeStr) return 'Unknown';
    const date = new Date(String(timeStr).replace(' ', 'T')); 
    if (isNaN(date.getTime())) return 'Unknown';
    const h = date.getHours();
    
    if (h >= 5 && h <= 10) return 'Shift A (Morning)'; 
    if (h > 10 && h <= 16) return 'General/Mid Shift';
    if (h > 16 && h <= 21) return 'Shift B (Evening)';
    return 'Shift C (Night)';
};

// ==========================================
// 🚀 IN-MEMORY CACHE ENGINE 
// ==========================================
const EMP_MASTER_QUERY = `
    SELECT e.empcode, e.Name, e.designatn, e.joindate, e.leavdate,
           e.Location as loc_id, ISNULL(l.LocDesc, e.Location) as Location,
           e.cat as cat_id, ISNULL(c.[Desc], e.cat) as cat,
           e.company as company_id, ISNULL(co.CName, e.company) as company,
           e.[group] as grp_id, ISNULL(g.GrupDesc, e.[group]) as grp,
           e.div as div_id, ISNULL(di.Divdesc, e.div) as div,
           e.dept as dept_id, ISNULL(dp.[desc], e.dept) as dept
    FROM dbo.empmst e
    LEFT JOIN dbo.Location l ON CAST(e.Location AS VARCHAR) = CAST(l.Location AS VARCHAR)
    LEFT JOIN dbo.catdesc c ON CAST(e.cat AS VARCHAR) = CAST(c.cat AS VARCHAR)
    LEFT JOIN dbo.company co ON CAST(e.company AS VARCHAR) = CAST(co.Company AS VARCHAR)
    LEFT JOIN dbo.GroupMst g ON CAST(e.[group] AS VARCHAR) = CAST(g.[Group] AS VARCHAR)
    LEFT JOIN dbo.division di ON CAST(e.div AS VARCHAR) = CAST(di.div AS VARCHAR)
    LEFT JOIN dbo.deptdesc dp ON CAST(e.dept AS VARCHAR) = CAST(dp.dept AS VARCHAR)
`;

let memoryCache = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60000; 
let stampedePromise = null;

const invalidateCache = () => { memoryCache = null; cacheTimestamp = 0; };

const getMasterData = async (pool) => {
    if (memoryCache && (Date.now() - cacheTimestamp < CACHE_TTL_MS)) return memoryCache;
    if (stampedePromise) return stampedePromise;

    stampedePromise = (async () => {
        try {
            const [canteensRes, devicesRes, empmstRes, itemsRes] = await Promise.all([
                pool.request().query("SELECT CanteenID, CanteenName, Capacity, IPAddress, ItemID FROM dbo.CanteenMaster"),
                pool.request().query("SELECT DeviceID, DeviceName, IPAddress, Location, Cat, Company, [Group] as Grp, Div, Dept FROM dbo.Device"),
                pool.request().query(EMP_MASTER_QUERY),
                pool.request().query("SELECT * FROM dbo.ItemMaster")
            ]);

            memoryCache = {
                canteens: normalizeRecordset(canteensRes.recordset),
                devices: normalizeRecordset(devicesRes.recordset),
                employees: normalizeRecordset(empmstRes.recordset),
                items: normalizeRecordset(itemsRes.recordset)
            };
            cacheTimestamp = Date.now();
            return memoryCache;
        } finally { stampedePromise = null; }
    })();
    return stampedePromise;
};

// ==========================================
// 🔗 UNIFIED ELIGIBILITY ENGINE
// ==========================================
const getEligibleEmployeesForCanteen = (canteen, devices, employees) => {
    const assignedIPs = String(canteen.ipaddress || '').replace(/'/g, '').split(',').map(ip => ip.trim().toLowerCase()).filter(Boolean);
    const canteenIpsSet = new Set(assignedIPs);
    
    const canteenDevices = devices.filter(d => canteenIpsSet.has(String(d.ipaddress || '').trim().toLowerCase()));
    const filterKeys = ['location', 'cat', 'company', 'grp', 'div', 'dept'];
    const filters = {};
    
    filterKeys.forEach(key => {
        const allVals = new Set();
        canteenDevices.forEach(d => {
            const raw = d[key];
            if (raw === undefined || raw === null) return;
            const cleaned = String(raw).replace(/'/g, '').trim();
            if (!cleaned || cleaned === '0' || cleaned.toUpperCase() === 'NULL') return;
            cleaned.split(',').forEach(v => {
                const trimmed = v.trim();
                if (trimmed && trimmed !== '0' && trimmed.toUpperCase() !== 'NULL') allVals.add(trimmed.toUpperCase());
            });
        });
        if (allVals.size > 0) filters[key] = allVals;
    });

    const idMap = { 'location': 'loc_id', 'cat': 'cat_id', 'company': 'company_id', 'grp': 'grp_id', 'div': 'div_id', 'dept': 'dept_id' };
    const eligibleEmps = new Map();
    
    employees.forEach(emp => {
        let eligible = true;
        for (const filterKey in filters) {
            const rawEmpVal = emp[idMap[filterKey]]; 
            if (rawEmpVal === undefined || rawEmpVal === null) { eligible = false; break; }
            const empVal = String(rawEmpVal).replace(/'/g, '').trim().toUpperCase();
            if (!empVal || empVal === '0' || empVal === 'NULL' || !filters[filterKey].has(empVal)) { 
                eligible = false; break; 
            }
        }
        if (eligible && emp.empcode) {
            eligibleEmps.set(normalizeEmpCode(emp.empcode), { ...emp });
        }
    });

    return { canteenIpsSet, filters, eligibleEmps };
};

// ==========================================
// 📊 METRICS & STATE MACHINE ALGORITHMS
// ==========================================

const calculateMetricsForCanteen = (canteen, devices, logs, employees, itemsMaster, targetDate, summaryOnly = false) => {
    const { canteenIpsSet, eligibleEmps } = getEligibleEmployeesForCanteen(canteen, devices, employees);

    if (canteenIpsSet.size === 0) {
        return {
            id: canteen.canteenid, name: canteen.canteenname || 'Unknown Canteen',
            stats: { 
                totalExpected: 0, currentlyInside: 0, completedLunch: 0, nextBatchCount: 0, maxCapacity: parseInt(canteen.capacity) || 100, itemCounts: {}, itemConsumers: {}, 
                insideList: [] 
            },
            ...(summaryOnly ? {} : { employeesExpected: [], employeesInside: [], employeesCompleted: [], employeesNextBatch: [] })
        };
    }

    const parseTimeToMins = (timeStr) => {
        if (!timeStr) return 0;
        const parts = String(timeStr).split(':');
        const h = parseInt(parts[0], 10) || 0;
        const m = parseInt(parts[1], 10) || 0;
        return (h * 60) + m;
    };

    const getLogicalMinsFromDateStr = (dateStr, targetStr) => {
        if (!dateStr) return -99999;
        const normalizedDateStr = String(dateStr).replace('T', ' '); 
        const parts = normalizedDateStr.split(' ');
        if (parts.length < 2) return -99999;
        
        const datePart = parts[0];
        const timePart = parts[1].split('.')[0]; 
        const [hStr, mStr] = timePart.split(':');
        
        let hours = parseInt(hStr, 10);
        let mins = parseInt(mStr, 10);

        const dLog = new Date(`${datePart}T00:00:00Z`);
        const dTarget = new Date(`${targetStr}T00:00:00Z`);
        const diffDays = Math.round((dLog.getTime() - dTarget.getTime()) / (1000 * 60 * 60 * 24));

        return (diffDays * 24 * 60) + (hours * 60) + mins;
    };

    const assignedItemIds = String(canteen.itemid || '').split(',').map(id => id.trim()).filter(Boolean);
    const canteenItems = itemsMaster.filter(i => assignedItemIds.includes(String(i.itemid || i.ItemId || i.ItemID)));
    
    const itemWindows = canteenItems.map(item => ({
        ...item, 
        startMins: parseTimeToMins(item.fromtime || item.FromTime), 
        endMins: parseTimeToMins(item.totime || item.ToTime)
    }));

    const activeItemsNowIds = new Set();
    const isToday = targetDate === getISTDateStr().split('T')[0];
    if (isToday) {
        const currentMins = getISTTimeMins();
        itemWindows.forEach(iw => {
            if (currentMins >= iw.startMins && currentMins <= iw.endMins) {
                const id = String(iw.itemid || iw.ItemID || iw.ItemId).trim();
                if (id) activeItemsNowIds.add(id);
            }
        });
    }

    let globalMaxItemEndMins = 1440; 
    if (itemsMaster && itemsMaster.length > 0) {
        globalMaxItemEndMins = Math.max(...itemsMaster.map(item => parseTimeToMins(item.totime || item.ToTime)));
    }
    
    const shiftCutoffMins = globalMaxItemEndMins;       
    const shiftStartMins = shiftCutoffMins - 1440; 

    const ipToDeviceMap = new Map();
    devices.forEach(d => {
        if (d.ipaddress && d.devicename) ipToDeviceMap.set(String(d.ipaddress).trim().toLowerCase(), String(d.devicename).trim());
    });

    const uniqueLogs = [];
    const seenLogs = new Set();

    logs.filter(log => log.empcode && log.ipaddress && log.transdate)
    .sort((a, b) => new Date(a.transdate).getTime() - new Date(b.transdate).getTime())
    .forEach(log => {
        const emp = normalizeEmpCode(log.empcode);
        const ip = String(log.ipaddress).trim().toLowerCase();
        const io = normalizeIO(log.inout);
        if (!io) return; 

        const timeMinute = Math.floor(new Date(log.transdate).getTime() / 60000);
        const key = `${emp}_${ip}_${timeMinute}_${io}`;
        if (!seenLogs.has(key)) {
            seenLogs.add(key);
            uniqueLogs.push(log);
        }
    });

    let employeesExpected = [], employeesInside = [], employeesCompleted = [], employeesNextBatch = [];
    const itemCounts = {}, itemConsumers = {};
    itemWindows.forEach(iw => {
        const iId = iw.itemid || iw.ItemID || iw.ItemId;
        itemCounts[iId] = 0; itemConsumers[iId] = [];
    });

    eligibleEmps.forEach((empData, empCodeNormalized) => {
        const empLogs = uniqueLogs.filter(l => normalizeEmpCode(l.empcode) === empCodeNormalized);
        
        let firstPunch = empLogs.length > 0 ? (empLogs[0].exacttransdate || empLogs[0].transdate) : null;
        let empShiftGroup = determineShift(firstPunch);

        let companyState = 'OUT';
        let canteenState = 'OUT';
        let lastGateIp = null;
        let lastGateTime = null;
        let lastCanteenIp = null;
        let lastCanteenTime = null;
        let lastCanteenOutIp = null;
        let lastCanteenOutTime = null;
        let lastCompletedItemName = '---';

        let consumedItems = new Map(); 
        let completedItemIds = new Set(); 
        let currentItemBeingConsumed = null;
        let currentActiveItemName = '---';

        empLogs.forEach(log => {
            const logMins = getLogicalMinsFromDateStr(log.exacttransdate, targetDate);
            if (logMins <= shiftStartMins) return; 
            if (logMins > shiftCutoffMins) return; 

            const ip = String(log.ipaddress).trim().toLowerCase();
            const io = normalizeIO(log.inout);
            const isCanteenDevice = canteenIpsSet.has(ip);
            
            if (!isCanteenDevice) {
                if (io === 'IN') {
                    companyState = 'IN';
                    lastGateIp = ip; 
                    lastGateTime = log.exacttransdate || log.transdate;
                } else if (io === 'OUT') {
                    companyState = 'OUT'; 
                    canteenState = 'OUT'; 
                }
            } else {
                if (io === 'IN') {
                    companyState = 'IN'; 
                    canteenState = 'IN';
                    lastCanteenIp = ip; 
                    lastCanteenTime = log.exacttransdate || log.transdate;

                    const activeItem = itemWindows.find(iw => logMins >= iw.startMins && logMins <= iw.endMins);
                    
                    if (activeItem) {
                        const iId = String(activeItem.itemid || activeItem.ItemID || activeItem.ItemId).trim();
                        
                        if (!consumedItems.has(iId)) {
                            currentItemBeingConsumed = iId;
                            currentActiveItemName = activeItem.ItemName || activeItem.itemname || activeItem.itemName || 'Meal';
                            
                            const consumerData = {
                                id: empData.empcode ? String(empData.empcode).trim() : empCodeNormalized,
                                name: empData.name ? String(empData.name).trim() : 'Unknown',
                                category: empData.cat ? String(empData.cat).trim() : 'Other',
                                dept: empData.dept ? String(empData.dept).trim() : 'Other',
                                company: empData.company ? String(empData.company).trim() : 'Other',
                                shiftGroup: empShiftGroup,
                                deviceName: ipToDeviceMap.get(ip) || 'Canteen Node',
                                processedDate: log.exacttransdate || log.transdate,
                                inTime: log.exacttransdate || log.transdate, 
                                outTime: null 
                            };

                            consumedItems.set(iId, consumerData);
                            itemCounts[iId]++;
                            
                            if (!summaryOnly) {
                                itemConsumers[iId].push(consumerData);
                            }
                        } else {
                            currentItemBeingConsumed = iId;
                            currentActiveItemName = activeItem.ItemName || activeItem.itemname || activeItem.itemName || 'Meal';
                        }
                    } else {
                        currentItemBeingConsumed = null;
                        currentActiveItemName = '---';
                    }
                } else if (io === 'OUT') {
                    companyState = 'IN'; 
                    canteenState = 'OUT';
                    lastCanteenOutIp = ip;
                    lastCanteenOutTime = log.exacttransdate || log.transdate;
                    
                    if (currentItemBeingConsumed) {
                        const consumerRecord = consumedItems.get(currentItemBeingConsumed);
                        if(consumerRecord) {
                            consumerRecord.outTime = log.exacttransdate || log.transdate;
                        }

                        lastCompletedItemName = currentActiveItemName;

                        if (!completedItemIds.has(currentItemBeingConsumed)) {
                            completedItemIds.add(currentItemBeingConsumed);
                            
                            employeesCompleted.push({
                                id: empData.empcode ? String(empData.empcode).trim() : empCodeNormalized,
                                name: empData.name ? String(empData.name).trim() : 'Unknown',
                                category: empData.cat ? String(empData.cat).trim() : 'Other',
                                location: empData.location ? String(empData.location).trim() : 'Other',
                                dept: empData.dept ? String(empData.dept).trim() : 'Other',
                                company: empData.company ? String(empData.company).trim() : 'Other',
                                div: empData.div ? String(empData.div).trim() : 'Other',
                                grp: empData.grp ? String(empData.grp).trim() : 'Other',
                                ipAddress: ip,
                                deviceName: ipToDeviceMap.get(ip) || 'Terminal',
                                processedDate: log.exacttransdate || log.transdate,
                                inOut: 'OUT',
                                mealName: currentActiveItemName, 
                                shiftGroup: empShiftGroup
                            });
                        }
                    }
                    
                    currentItemBeingConsumed = null;
                    currentActiveItemName = '---'; 
                }
            }
        });

        const baseData = {
            id: empData.empcode ? String(empData.empcode).trim() : empCodeNormalized,
            name: empData.name ? String(empData.name).trim() : 'Unknown',
            category: empData.cat ? String(empData.cat).trim() : 'Other',
            location: empData.location ? String(empData.location).trim() : 'Other',
            dept: empData.dept ? String(empData.dept).trim() : 'Other',
            company: empData.company ? String(empData.company).trim() : 'Other',
            div: empData.div ? String(empData.div).trim() : 'Other',
            grp: empData.grp ? String(empData.grp).trim() : 'Other',
            shiftGroup: empShiftGroup
        };

        if (companyState === 'IN') {
            if (canteenState === 'IN') {
                employeesInside.push({
                    ...baseData,
                    ipAddress: lastCanteenIp,
                    deviceName: ipToDeviceMap.get(lastCanteenIp) || 'Terminal',
                    processedDate: lastCanteenTime,
                    inOut: 'IN',
                    mealName: currentActiveItemName 
                });
            } else if (canteenState === 'OUT') {
                const hasCompletedActiveItem = Array.from(activeItemsNowIds).some(id => completedItemIds.has(id));

                if (hasCompletedActiveItem) {
                    employeesNextBatch.push({
                        ...baseData,
                        ipAddress: lastCanteenOutIp,
                        deviceName: ipToDeviceMap.get(lastCanteenOutIp) || 'Terminal',
                        processedDate: lastCanteenOutTime,
                        inOut: 'OUT',
                        mealName: lastCompletedItemName
                    });
                } else {
                    employeesExpected.push({
                        ...baseData,
                        ipAddress: lastGateIp,
                        deviceName: ipToDeviceMap.get(lastGateIp) || 'Terminal',
                        processedDate: lastGateTime,
                        inOut: 'IN'
                    });
                }
            }
        }
    });

    const result = {
        id: canteen.canteenid, name: canteen.canteenname || 'Unknown Canteen', itemid: canteen.itemid || canteen.ItemID, 
        stats: {
            totalExpected: employeesExpected.length, 
            currentlyInside: employeesInside.length, 
            completedLunch: employeesCompleted.length,
            nextBatchCount: employeesNextBatch.length, 
            totalClocked: employeesExpected.length + employeesInside.length + employeesNextBatch.length,
            maxCapacity: parseInt(canteen.capacity) || 100, 
            itemCounts: itemCounts, 
            itemConsumers: itemConsumers,
            insideList: employeesInside.map(e => ({
                id: e.id,
                name: e.name,
                processedDate: e.processedDate
            }))
        }
    };

    if (!summaryOnly) {
        result.employeesExpected = employeesExpected; result.employeesInside = employeesInside;
        result.employeesCompleted = employeesCompleted; result.employeesNextBatch = employeesNextBatch;
    }
    return result;
};

const refreshCanteenStats = async (pool, targetDate = null, summaryOnly = true) => {
  try {
    const target = (targetDate || getISTDateStr()).split('T')[0];
    
    const prevDayStr = getPrevDayDateStr(target);
    const nextDayStr = getNextDayDateStr(target);

    const targetDateStartStr = `${prevDayStr} 12:00:00.000`;
    const targetDateEndExtStr = `${nextDayStr} 23:59:59.000`; 

    const masterData = await getMasterData(pool);

    const logsRes = await pool.request()
        .input('targetDateStart', sql.NVarChar, targetDateStartStr)
        .input('targetDateEnd', sql.NVarChar, targetDateEndExtStr)
        .query(`
            SELECT IpAddress, Inout, EmpCode, TransDate, CONVERT(VARCHAR(23), TransDate, 126) AS ExactTransDate
            FROM dbo.Attlogs WITH (NOLOCK)
            WHERE TransDate >= CAST(@targetDateStart AS DATETIME) 
            AND TransDate <= CAST(@targetDateEnd AS DATETIME)
        `);

    const normLogs = normalizeRecordset(logsRes.recordset);

    const canteensStats = masterData.canteens.map(canteen => 
        calculateMetricsForCanteen(canteen, masterData.devices, normLogs, masterData.employees, masterData.items, target, summaryOnly)
    );

    let gExpected = 0, gInside = 0, gCompleted = 0, gNextBatch = 0, gClocked = 0;
    canteensStats.forEach(c => {
        if (c.stats) {
            gExpected += c.stats.totalExpected || 0;
            gInside += c.stats.currentlyInside || 0;
            gCompleted += c.stats.completedLunch || 0;
            gNextBatch += c.stats.nextBatchCount || 0;
            gClocked += c.stats.totalClocked || 0;
        }
    });

    return { 
        canteens: canteensStats, 
        stats: { totalExpected: gExpected, currentlyInside: gInside, completedLunch: gCompleted, nextBatchCount: gNextBatch, totalClocked: gClocked } 
    };
  } catch (err) {
    handleSQLError(err, null, "refreshCanteenStats");
    return { canteens: [], stats: { totalExpected: 0, currentlyInside: 0, completedLunch: 0, nextBatchCount: 0, totalClocked: 0 } };
  }
};

const fetchCanteenMetrics = async (pool, canteenId, targetDate = null) => {
  try {
    const target = (targetDate || getISTDateStr()).split('T')[0];
    
    const prevDayStr = getPrevDayDateStr(target);
    const nextDayStr = getNextDayDateStr(target);

    const targetDateStartStr = `${prevDayStr} 12:00:00.000`;
    const targetDateEndExtStr = `${nextDayStr} 23:59:59.000`;

    const masterData = await getMasterData(pool);
    const normCanteen = masterData.canteens.find(c => String(c.canteenid) === String(canteenId));
    
    if (!normCanteen) throw new Error("Canteen not found");

    const logsRes = await pool.request()
        .input('targetDateStart', sql.NVarChar, targetDateStartStr)
        .input('targetDateEnd', sql.NVarChar, targetDateEndExtStr)
        .query(`
            SELECT IpAddress, Inout, EmpCode, TransDate, CONVERT(VARCHAR(23), TransDate, 126) AS ExactTransDate 
            FROM dbo.Attlogs WITH (NOLOCK)
            WHERE TransDate >= CAST(@targetDateStart AS DATETIME) 
            AND TransDate <= CAST(@targetDateEnd AS DATETIME)
        `);

    const normLogs = normalizeRecordset(logsRes.recordset);
    return calculateMetricsForCanteen(normCanteen, masterData.devices, normLogs, masterData.employees, masterData.items, target, false);
  } catch (err) {
    handleSQLError(err, null, "fetchCanteenMetrics");
    throw err;
  }
};

// ==========================================
// 📡 BULLETPROOF REAL-TIME CACHE ENGINE
// ==========================================
let lastStateHash = null;
let cachedLiveStats = null;

const checkDatabaseForUpdates = async () => {
    try {
        const pool = await poolConnect;
        const target = getISTDateStr();
        const currentMinute = getISTTimeMins();
        const prevDayStr = getPrevDayDateStr(target);
        const targetDateStartStr = `${prevDayStr} 12:00:00.000`; 

        // 🟢 THE FIX: Row-Count Invalidation.
        // Even if offline devices push "old" logs out of order, the total count will change!
        // This completely eliminates any lag on the Home Page dashboard.
        const checkRes = await pool.request()
            .input('start', sql.NVarChar, targetDateStartStr)
            .query(`
                SELECT COUNT_BIG(*) as LogCount, MAX(TransDate) as LastLog
                FROM dbo.Attlogs WITH (NOLOCK) 
                WHERE TransDate >= CAST(@start AS DATETIME)
            `);
        
        const currentLogCount = checkRes.recordset[0].LogCount || 0;
        const lastLogTime = checkRes.recordset[0].LastLog ? checkRes.recordset[0].LastLog.getTime() : 0;
        
        const currentStateHash = `${currentLogCount}_${lastLogTime}_${currentMinute}`;

        if (currentStateHash !== lastStateHash || !cachedLiveStats) {
            lastStateHash = currentStateHash;
            cachedLiveStats = await refreshCanteenStats(pool, target, true);
            io.emit('dashboard_update', cachedLiveStats);
        }
    } catch (err) { 
        console.error("Smart Polling Error:", err.message); 
    }
};

const startSmartPolling = async () => {
    try { 
        await checkDatabaseForUpdates(); 
    } catch (err) {} finally { 
        setTimeout(startSmartPolling, 1000); 
    }
};

io.on('connection', async (socket) => {
    try {
        if (cachedLiveStats) {
            socket.emit('dashboard_update', cachedLiveStats);
        } else {
            const pool = await poolConnect;
            const stats = await refreshCanteenStats(pool, getISTDateStr(), true);
            socket.emit('dashboard_update', stats);
        }
    } catch (err) {}
});

// ==========================================
// 🔌 ROUTING & REST ENDPOINTS
// ==========================================

app.use("/", adminRoutes(poolConnect, handleSQLError, invalidateCache, refreshCanteenStats, sql, authenticateJWT, JWT_SECRET, jwt));

// 📝 SUPER REPORTS GENERATOR
app.post("/api/reports/canteen-summary", authenticateJWT, async (req, res) => {
    try {
        const { startDate, endDate, canteenIds } = req.body;
        
        if (!startDate || !endDate || !canteenIds || !Array.isArray(canteenIds) || canteenIds.length === 0) {
            return res.status(400).json({ error: "Missing or invalid parameters. Require startDate, endDate, and canteenIds array." });
        }

        const pool = await poolConnect;
        const masterData = await getMasterData(pool);

        const startStr = `${startDate} 00:00:00.000`;
        const endStr = `${endDate} 23:59:59.000`;

        const logsRes = await pool.request()
            .input('start', sql.NVarChar, startStr)
            .input('end', sql.NVarChar, endStr)
            .query(`
                SELECT IpAddress, Inout, EmpCode, TransDate, CONVERT(VARCHAR(23), TransDate, 126) AS ExactTransDate
                FROM dbo.Attlogs WITH (NOLOCK)
                WHERE TransDate >= CAST(@start AS DATETIME) 
                AND TransDate <= CAST(@end AS DATETIME)
            `);

        const normLogs = normalizeRecordset(logsRes.recordset);

        let selectedCanteens = [];
        if (canteenIds.includes("ALL")) {
            selectedCanteens = masterData.canteens;
        } else {
            selectedCanteens = masterData.canteens.filter(c => canteenIds.includes(String(c.canteenid || c.CanteenID || c.id)));
        }

        const canteenIpMap = new Map();
        selectedCanteens.forEach(c => {
            const ips = String(c.ipaddress || '').replace(/'/g, '').split(',').map(ip => ip.trim().toLowerCase()).filter(Boolean);
            ips.forEach(ip => canteenIpMap.set(ip, c));
        });

        const uniqueLogs = [];
        const seenLogs = new Set();
        normLogs.filter(l => l.empcode && l.ipaddress && l.transdate && canteenIpMap.has(String(l.ipaddress).trim().toLowerCase()))
            .sort((a, b) => new Date(a.transdate).getTime() - new Date(b.transdate).getTime())
            .forEach(log => {
                const emp = normalizeEmpCode(log.empcode);
                const ip = String(log.ipaddress).trim().toLowerCase();
                const io = normalizeIO(log.inout);
                if (!io) return; 

                const timeMinute = Math.floor(new Date(log.transdate).getTime() / 60000);
                const key = `${emp}_${ip}_${timeMinute}_${io}`;
                if (!seenLogs.has(key)) {
                    seenLogs.add(key);
                    uniqueLogs.push(log);
                }
            });

        const empDayLogs = new Map(); 
        uniqueLogs.forEach(log => {
            const emp = normalizeEmpCode(log.empcode);
            const dateKey = log.exacttransdate.split('T')[0];
            const key = `${emp}_${dateKey}`;
            if (!empDayLogs.has(key)) empDayLogs.set(key, []);
            empDayLogs.get(key).push(log);
        });

        const reportData = [];

        const parseTimeToMins = (timeStr) => {
            if (!timeStr) return 0;
            const parts = String(timeStr).split(':');
            const h = parseInt(parts[0], 10) || 0;
            const m = parseInt(parts[1], 10) || 0;
            return (h * 60) + m;
        };

        const getLogicalMinsFromDateStr = (dateStr) => {
            if (!dateStr) return -99999;
            const normalizedDateStr = String(dateStr).replace('T', ' '); 
            const parts = normalizedDateStr.split(' ');
            if (parts.length < 2) return -99999;
            const timePart = parts[1].split('.')[0]; 
            const [hStr, mStr] = timePart.split(':');
            return (parseInt(hStr, 10) * 60) + parseInt(mStr, 10);
        };

        empDayLogs.forEach((logs, key) => {
            const empCode = key.split('_')[0];
            const dateKey = key.split('_')[1];
            const empData = masterData.employees.find(e => normalizeEmpCode(e.empcode) === empCode) || { name: 'Unknown' };

            let currentItemBeingConsumed = null;
            let consumedItems = new Map(); 

            logs.forEach(log => {
                const ip = String(log.ipaddress).trim().toLowerCase();
                const io = normalizeIO(log.inout);
                const canteen = canteenIpMap.get(ip);
                if (!canteen) return;

                const logMins = getLogicalMinsFromDateStr(log.exacttransdate);
                
                const assignedItemIds = String(canteen.itemid || canteen.ItemID || '').split(',').map(id => id.trim()).filter(Boolean);
                const canteenItems = masterData.items.filter(i => assignedItemIds.includes(String(i.itemid || i.ItemId || i.ItemID)));
                
                const itemWindows = canteenItems.map(item => ({
                    ...item, 
                    startMins: parseTimeToMins(item.fromtime || item.FromTime), 
                    endMins: parseTimeToMins(item.totime || item.ToTime)
                }));

                if (io === 'IN') {
                    const activeItem = itemWindows.find(iw => logMins >= iw.startMins && logMins <= iw.endMins);
                    
                    if (activeItem) {
                        const iId = activeItem.itemid || activeItem.ItemID || activeItem.ItemId;
                        
                        if (!consumedItems.has(iId)) {
                            currentItemBeingConsumed = iId;
                            
                            const empRate = parseFloat(activeItem.EmpRate || activeItem.emprate || 0);
                            const coRate = parseFloat(activeItem.EmployeerRate || activeItem.employeerrate || activeItem.employerRate || 0);
                            const totalValue = empRate + coRate;

                            consumedItems.set(iId, {
                                canteenName: canteen.canteenname || canteen.CanteenName || 'Unknown Canteen',
                                empId: empCode,
                                empName: empData.name || empData.Name || 'Unknown',
                                category: empData.cat || empData.Cat || '---',
                                company: empData.company || empData.Company || '---',
                                dept: empData.dept || empData.Dept || '---',
                                itemName: activeItem.ItemName || activeItem.itemname || activeItem.itemName || 'Meal',
                                shiftGroup: activeItem.ShiftGroup || activeItem.shiftGroup || activeItem.shiftgroup || '---', 
                                empRate: empRate, 
                                employeerRate: coRate, 
                                totalAmount: totalValue,
                                inTime: log.exacttransdate,
                                outTime: null,
                                processedDate: dateKey
                            });
                        } else {
                            currentItemBeingConsumed = iId; 
                        }
                    } else {
                        currentItemBeingConsumed = null; 
                    }
                } else if (io === 'OUT') {
                    if (currentItemBeingConsumed && consumedItems.has(currentItemBeingConsumed)) {
                        consumedItems.get(currentItemBeingConsumed).outTime = log.exacttransdate;
                    }
                    currentItemBeingConsumed = null;
                }
            });

            consumedItems.forEach(record => reportData.push(record));
        });

        reportData.sort((a, b) => {
            if (a.canteenName < b.canteenName) return -1;
            if (a.canteenName > b.canteenName) return 1;
            if (a.processedDate < b.processedDate) return -1;
            if (a.processedDate > b.processedDate) return 1;
            return new Date(a.inTime).getTime() - new Date(b.inTime).getTime();
        });

        res.json({ success: true, data: reportData });
    } catch (err) {
        handleSQLError(err, res, "POST /api/reports/canteen-summary");
    }
});

app.get("/api/dashboard-advanced", authenticateJWT, async (req, res) => {
  const targetDate = req.query.date || getISTDateStr();
  try {
    const pool = await poolConnect;
    const dashboardData = await refreshCanteenStats(pool, targetDate, true);
    const gStats = dashboardData.stats;
    res.json({ expected: gStats.totalExpected, inside: gStats.currentlyInside, completed: gStats.completedLunch, nextBatch: gStats.nextBatchCount, clocked: gStats.totalClocked }); 
  } catch (err) { handleSQLError(err, res, "GET /api/dashboard-advanced"); }
});

app.get("/api/all-items", authenticateJWT, async (req, res) => {
  try {
    const pool = await poolConnect;
    const itemResult = await pool.request().query(`SELECT * FROM dbo.ItemMaster`);
    res.json(itemResult.recordset);
  } catch (err) { handleSQLError(err, res, "GET /api/all-items"); }
});

app.get("/api/canteens-list", authenticateJWT, async (req, res) => {
  try {
    const pool = await poolConnect;
    const result = await pool.request().query("SELECT * FROM dbo.CanteenMaster");
    res.json(result.recordset);
  } catch (err) { handleSQLError(err, res, "GET /api/canteens-list"); }
});

app.get("/api/dashboard", authenticateJWT, async (req, res) => {
  try {
    const targetDate = req.query.date;
    const isToday = !targetDate || targetDate === getISTDateStr();
    
    if (isToday && cachedLiveStats) {
        return res.json(cachedLiveStats);
    }
    
    const pool = await poolConnect;
    res.json(await refreshCanteenStats(pool, targetDate, true));
  } catch (err) { handleSQLError(err, res, "GET /api/dashboard"); }
});

app.get("/api/all-active-dates", authenticateJWT, async (req, res) => {
  try {
    const pool = await poolConnect;
    const result = await pool.request().query(`
        SELECT DISTINCT CONVERT(VARCHAR(10), TransDate, 120) as ActiveDate 
        FROM dbo.Attlogs WITH (NOLOCK) WHERE TransDate IS NOT NULL
    `);
    res.json(activeDateMap(result.recordset));
  } catch (err) { handleSQLError(err, res, "GET /api/all-active-dates"); }
});

app.get("/api/canteen-detail/:id", authenticateJWT, async (req, res) => {
  try {
    const pool = await poolConnect;
    res.json(await fetchCanteenMetrics(pool, parseInt(req.params.id), req.query.date || null));
  } catch (err) { handleSQLError(err, res, `GET /api/canteen-detail/${req.params.id}`); }
});

app.get("/api/canteen-employees/:id", authenticateJWT, async (req, res) => {
    try {
        const pool = await poolConnect;
        const masterData = await getMasterData(pool);
        const canteen = masterData.canteens.find(c => String(c.canteenid) === String(req.params.id));
        
        if (!canteen) return res.status(404).json({ error: "Canteen not found" });

        const { filters, eligibleEmps } = getEligibleEmployeesForCanteen(canteen, masterData.devices, masterData.employees);
        
        const activeFilters = {};
        const idMap = { 'location': 'loc_id', 'cat': 'cat_id', 'company': 'company_id', 'grp': 'grp_id', 'div': 'div_id', 'dept': 'dept_id' };

        for (const key in filters) {
            activeFilters[key] = Array.from(filters[key]).map(idVal => {
                const matchingEmp = masterData.employees.find(e => {
                    const rawVal = e[idMap[key]];
                    if (rawVal === undefined || rawVal === null) return false;
                    return String(rawVal).replace(/'/g, '').trim().toUpperCase() === idVal;
                });
                return `${idVal} - ${matchingEmp && matchingEmp[key] ? String(matchingEmp[key]).trim() : 'Unknown'}`;
            });
        }

        const eligibleEmployees = Array.from(eligibleEmps.values()).map(emp => ({
            empcode: normalizeEmpCode(emp.empcode),
            name: emp.name || 'Unknown', location: emp.location || '---',
            category: emp.cat || '---', company: emp.company || '---', dept: emp.dept || '---',
            div: emp.div || '---', group: emp.grp || '---', designation: emp.designatn || '---',
            joinDate: emp.joindate ? new Date(emp.joindate).toISOString().split('T')[0] : '---',
            leaveDate: emp.leavdate ? new Date(emp.leavdate).toISOString().split('T')[0] : '---'
        }));

        res.json({ canteenName: canteen.canteenname || `Canteen ${req.params.id}`, employees: eligibleEmployees, activeFilters });
    } catch (err) { handleSQLError(err, res, `GET /api/canteen-employees/${req.params.id}`); }
});

app.get("/api/all-devices", authenticateJWT, async (req, res) => {
  try {
    const pool = await poolConnect;
    const deviceResult = await pool.request().query(`SELECT DeviceID, DeviceName, IPAddress, TID, Location, Cat, Company, Dept, Div, [Group] FROM dbo.Device`);
    res.json(deviceResult.recordset);
  } catch (err) { handleSQLError(err, res, "GET /api/all-devices"); }
});

app.get("/api/search-employees", authenticateJWT, async (req, res) => {
    try {
        const pool = await poolConnect;
        const searchQuery = req.query.q || '';
        
        if (searchQuery.trim().length === 0) return res.json({ success: true, data: [] });

        const result = await pool.request()
            .input('search', sql.NVarChar, `%${searchQuery}%`)
            .input('startsWith', sql.NVarChar, `${searchQuery}%`)
            .query(`
                SELECT TOP 20 empcode AS empId, Name AS empName
                FROM dbo.empmst WITH (NOLOCK)
                WHERE Name LIKE @search OR empcode LIKE @search
                ORDER BY 
                    CASE WHEN empcode LIKE @startsWith THEN 1 ELSE 2 END,
                    empcode ASC
            `);

        res.json({ success: true, data: result.recordset });
    } catch (err) {
        console.error("Search Error:", err.message);
        res.status(500).json({ success: false, error: "Database search failed." });
    }
});

const initializeDatabase = async () => {
  try {
    const pool = await poolConnect;
    await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='UserMaster' and xtype='U')
            CREATE TABLE dbo.UserMaster (
                UserID INT PRIMARY KEY IDENTITY(1,1), Name NVARCHAR(100), Email NVARCHAR(100) UNIQUE,
                Password NVARCHAR(100), Role NVARCHAR(50), CanteenID NVARCHAR(MAX)
            )
        `);
  } catch (err) { handleSQLError(err, null, "initializeDatabase"); }
};

// ==========================================
// 🛑 SERVER BOOT & GRACEFUL SHUTDOWN
// ==========================================
server.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Backend running natively with WebSockets on port ${PORT}`);
    initializeDatabase();
});

process.once('SIGUSR2', () => {
    console.log("♻️ Nodemon restart detected. Releasing port...");
    server.close(() => {
        process.kill(process.pid, 'SIGUSR2');
    });
});

process.on('SIGINT', () => {
    console.log("🛑 Server shutting down. Releasing port...");
    server.close(() => {
        process.exit(0);
    });
});