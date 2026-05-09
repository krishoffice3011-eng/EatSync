// admin.js
const express = require("express");
const fs = require("fs").promises;
const path = require("path");
const bcrypt = require("bcrypt"); // 🔒 ADDED securely hashes passwords

// 🔒 Added auth parameters injected from server.js
module.exports = function(poolConnect, handleSQLError, invalidateCache, refreshCanteenStats, sql, authenticateJWT, JWT_SECRET, jwt) {
    const router = express.Router();

    // ==========================================
    // ⚙️ TICKER & GLOBAL SETTINGS (.txt File Storage)
    // ==========================================
    const SETTINGS_FILE = path.join(__dirname, 'ticker_settings.txt');

    const DEFAULT_SETTINGS = {
        tickers: [
            "🍽️ Fresh meals, happy employees!",
            "⚡ Real-time canteen monitoring system",
            "🍱 Hygiene & quality is our priority"
        ],
        overtimeLimit: 30,
        tickerSpeed: 60,
        tickerColor: "#38bdf8"
    };

    router.get("/api/ticker-settings", authenticateJWT, async (req, res) => {
        try {
            const data = await fs.readFile(SETTINGS_FILE, 'utf8');
            res.json(JSON.parse(data));
        } catch (err) {
            if (err.code === 'ENOENT') {
                res.json(DEFAULT_SETTINGS);
            } else {
                console.error("Error reading ticker settings:", err);
                res.status(500).json({ error: "Failed to read settings file." });
            }
        }
    });

    router.post("/api/ticker-settings", authenticateJWT, async (req, res) => {
        const { tickers, overtimeLimit, tickerSpeed, tickerColor } = req.body;
        try {
            const newSettings = {
                tickers: Array.isArray(tickers) ? tickers : [],
                overtimeLimit: parseInt(overtimeLimit) || 30,
                tickerSpeed: parseInt(tickerSpeed) || 60,
                tickerColor: tickerColor || "#38bdf8"
            };

            await fs.writeFile(SETTINGS_FILE, JSON.stringify(newSettings, null, 2), 'utf8');
            res.json({ success: true, message: "Settings saved successfully." });
        } catch (err) {
            console.error("Error writing ticker settings:", err);
            res.status(500).json({ success: false, error: "Failed to save settings." });
        }
    });

    // ==========================================
    // 🏢 CANTEEN MASTER & ITEM CONFIGURATION
    // ==========================================

    router.post("/api/update-canteen-items", authenticateJWT, async (req, res) => {
        const { canteenId, itemIds } = req.body;
        try {
            const pool = await poolConnect;
            const idsString = Array.isArray(itemIds) ? itemIds.join(',') : '';
            await pool.request()
                .input("id", sql.Int, canteenId)
                .input("items", sql.NVarChar, idsString)
                .query("UPDATE dbo.CanteenMaster SET ItemID = @items WHERE CanteenID = @id");
            
            invalidateCache(); 
            res.json({ success: true, message: "Items updated successfully" });
        } catch (err) {
            handleSQLError(err, res, "POST /api/update-canteen-items");
        }
    });

    router.post("/api/update-canteen-devices", authenticateJWT, async (req, res) => {
        const { canteenId, ipAddresses } = req.body;
        try {
            const pool = await poolConnect;
            const ipsString = Array.isArray(ipAddresses) ? ipAddresses.join(',') : '';
            await pool.request()
                .input("id", sql.Int, canteenId)
                .input("ips", sql.NVarChar, ipsString)
                .query("UPDATE dbo.CanteenMaster SET IPAddress = @ips WHERE CanteenID = @id");
            
            invalidateCache(); 
            res.json({ success: true, message: "IPs updated successfully" });
        } catch (err) {
            handleSQLError(err, res, "POST /api/update-canteen-devices");
        }
    });

    router.post("/api/canteens", authenticateJWT, async (req, res) => {
        const { name, maxCapacity } = req.body;
        try {
            const pool = await poolConnect;
            await pool.request()
                   .input("name", sql.NVarChar, name)
                   .input("cap", sql.Int, parseInt(maxCapacity) || 0)
                   .query("INSERT INTO dbo.CanteenMaster (CanteenName, Capacity) VALUES (@name, @cap)");
                   
            invalidateCache(); 
            res.json({ success: true });
        } catch (err) {
            handleSQLError(err, res, "POST /api/canteens");
        }
    });

    router.put("/api/canteens/:id", authenticateJWT, async (req, res) => {
        const { name, maxCapacity } = req.body;
        try {
            const pool = await poolConnect;
            await pool.request()
                .input("id", sql.Int, req.params.id)
                .input("name", sql.NVarChar, name)
                .input("cap", sql.Int, parseInt(maxCapacity) || 0)
                .query(`UPDATE dbo.CanteenMaster SET CanteenName = ISNULL(@name, CanteenName), Capacity = ISNULL(@cap, Capacity) WHERE CanteenID = @id`);
            
            invalidateCache(); 
            res.json({ success: true });
        } catch (err) {
            handleSQLError(err, res, "PUT /api/canteens/:id");
        }
    });

    router.delete("/api/canteens/:id", authenticateJWT, async (req, res) => {
        try {
            const pool = await poolConnect;
            await pool.request().input("id", sql.Int, req.params.id).query("DELETE FROM dbo.CanteenMaster WHERE CanteenID = @id");
            
            invalidateCache(); 
            res.json({ success: true });
        } catch (err) {
            handleSQLError(err, res, "DELETE /api/canteens/:id");
        }
    });

    // ==========================================
    // 👤 PERSONNEL IDENTITY & AUTHENTICATION
    // ==========================================

    const fetchAllUsers = async (pool) => {
        const res = await pool.request().query("SELECT * FROM dbo.UserMaster");
        const cols = Object.keys(res.recordset.columns);
        const idCol = cols.find((c) => c.toLowerCase() === "userid") || "UserID";
        const nameCol = cols.find((c) => c.toLowerCase() === "name") || "Name";
        const emailCol = cols.find((c) => c.toLowerCase() === "email") || "Email";
        const roleCol = cols.find((c) => c.toLowerCase() === "role") || "Role";
        const canCol = cols.find((c) => c.toLowerCase() === "canteenid") || "CanteenID";

        return res.recordset.map((u) => ({
            id: u[idCol], 
            name: u[nameCol], 
            email: u[emailCol], 
            role: String(u[roleCol] || "").toLowerCase(),
            assignedCanteens: u[canCol] ? String(u[canCol]).split(",").filter((x) => x) : [],
        }));
    };

    router.get("/api/users", authenticateJWT, async (req, res) => {
        try {
            const pool = await poolConnect;
            res.json(await fetchAllUsers(pool));
        } catch (err) {
            handleSQLError(err, res, "GET /api/users");
        }
    });

    router.post("/api/users", authenticateJWT, async (req, res) => {
        const { name, email } = req.body;
        try {
            const pool = await poolConnect;
            
            // 🔒 FIX: Hash the default password with bcrypt
            const defaultPasswordHash = bcrypt.hashSync("Test@123", 10);
            
            await pool.request()
                .input("name", sql.NVarChar, name)
                .input("email", sql.NVarChar, email)
                .input("pass", sql.NVarChar, defaultPasswordHash)
                .input("role", sql.NVarChar, "User")
                .query("INSERT INTO dbo.UserMaster (Name, Email, Password, Role, CanteenID) VALUES (@name, @email, @pass, @role, NULL)");
            
            res.json({ success: true, users: await fetchAllUsers(pool) });
        } catch (err) {
            handleSQLError(err, res, "POST /api/users");
        }
    });

    router.put("/api/users/:id", authenticateJWT, async (req, res) => {
        const { name, email, password, role, canteenIds } = req.body;
        try {
            const pool = await poolConnect;
            
            let canteenStr = null;
            if (Array.isArray(canteenIds)) canteenStr = canteenIds.length > 0 ? canteenIds.join(",") : "";

            const request = pool.request()
                .input("id", sql.Int, req.params.id)
                .input("name", sql.NVarChar, name)
                .input("email", sql.NVarChar, email)
                .input("role", sql.NVarChar, role)
                .input("canteenStr", sql.NVarChar, canteenStr);

            // 🐛 FIX: Dynamically construct query to explicitly allow overwriting with NULL/Empty 
            // when admin clears all canteen assignments.
            let queryOptions = `Name=ISNULL(@name, Name), Email=ISNULL(@email, Email), Role=ISNULL(@role, Role)`;
            
            if (req.body.hasOwnProperty('canteenIds')) {
                queryOptions += `, CanteenID=@canteenStr`; 
            } else {
                queryOptions += `, CanteenID=ISNULL(@canteenStr, CanteenID)`;
            }

            if (password) {
                request.input("pass", sql.NVarChar, bcrypt.hashSync(password, 10));
                queryOptions += `, Password=@pass`;
            }

            await request.query(`UPDATE dbo.UserMaster SET ${queryOptions} WHERE UserID=@id`);
            
            res.json({ success: true, users: await fetchAllUsers(pool) });
        } catch (err) {
            handleSQLError(err, res, "PUT /api/users/:id");
        }
    });

    router.delete("/api/users/:id", authenticateJWT, async (req, res) => {
        try {
            const pool = await poolConnect;
            await pool.request().input("id", sql.Int, req.params.id).query("DELETE FROM dbo.UserMaster WHERE UserID = @id");
            res.json({ success: true, users: await fetchAllUsers(pool) });
        } catch (err) {
            handleSQLError(err, res, "DELETE /api/users/:id");
        }
    });

    // ==========================================
    // 🍔 ITEM MASTER CRUD OPERATIONS
    // ==========================================

    router.post("/api/items", authenticateJWT, async (req, res) => {
        // FIX: Destructure shiftGroup instead of foodGroup
        const { itemName, fromTime, toTime, itemGroup, shiftGroup, empRate, employeerRate } = req.body;
        try {
            const pool = await poolConnect;
            
            await pool.request()
                .input("name", sql.NVarChar, itemName)
                .input("from", sql.NVarChar, fromTime)
                .input("to", sql.NVarChar, toTime)
                .input("group", sql.NVarChar, itemGroup)
                .input("shiftGroup", sql.NVarChar, shiftGroup) 
                .input("emp", sql.Decimal(18, 2), parseFloat(empRate) || 0)
                .input("empr", sql.Decimal(18, 2), parseFloat(employeerRate) || 0)
                .query(`
                    INSERT INTO dbo.ItemMaster (ItemName, FromTime, ToTime, ItemGroup, ShiftGroup, EmpRate, EmployeerRate) 
                    VALUES (@name, @from, @to, @group, @shiftGroup, @emp, @empr)
                `);
                
            invalidateCache();
            res.json({ success: true });
        } catch (err) {
            handleSQLError(err, res, "POST /api/items");
        }
    });

    router.put("/api/items/:id", authenticateJWT, async (req, res) => {
        // FIX: Destructure shiftGroup instead of foodGroup
        const { itemName, fromTime, toTime, itemGroup, shiftGroup, empRate, employeerRate } = req.body;
        try {
            const pool = await poolConnect;
            await pool.request()
                .input("id", sql.Int, req.params.id)
                .input("name", sql.NVarChar, itemName)
                .input("from", sql.NVarChar, fromTime)
                .input("to", sql.NVarChar, toTime)
                .input("group", sql.NVarChar, itemGroup)
                .input("shiftGroup", sql.NVarChar, shiftGroup) 
                .input("emp", sql.Decimal(18, 2), parseFloat(empRate) || 0)
                .input("empr", sql.Decimal(18, 2), parseFloat(employeerRate) || 0)
                .query(`
                    UPDATE dbo.ItemMaster 
                    SET ItemName = ISNULL(@name, ItemName), 
                        FromTime = ISNULL(@from, FromTime), 
                        ToTime = ISNULL(@to, ToTime), 
                        ItemGroup = ISNULL(@group, ItemGroup), 
                        ShiftGroup = ISNULL(@shiftGroup, ShiftGroup),
                        EmpRate = ISNULL(@emp, EmpRate), 
                        EmployeerRate = ISNULL(@empr, EmployeerRate) 
                    WHERE ItemID = @id
                `);
            
            invalidateCache();
            res.json({ success: true });
        } catch (err) {
            handleSQLError(err, res, "PUT /api/items/:id");
        }
    });

    router.delete("/api/items/:id", authenticateJWT, async (req, res) => {
        try {
            const pool = await poolConnect;
            await pool.request().input("id", sql.Int, req.params.id).query("DELETE FROM dbo.ItemMaster WHERE ItemID = @id");
            invalidateCache();
            res.json({ success: true });
        } catch (err) {
            handleSQLError(err, res, "DELETE /api/items/:id");
        }
    });

    // ==========================================
    // ⚙️ FACILITY AUTHORITY MAPPING
    // ==========================================

    router.post("/api/assign", authenticateJWT, async (req, res) => {
        const { canteenId, managerId } = req.body;
        let pool;
        let transaction;
        try {
            pool = await poolConnect;
            transaction = new sql.Transaction(pool);
            await transaction.begin();

            const request = new sql.Request(transaction);
            const targetCanteenStr = String(canteenId);
            
            const allUsersRes = await request.query(`SELECT UserID, CanteenID FROM dbo.UserMaster WHERE Role = 'user'`);

            for (const u of allUsersRes.recordset) {
                const currentCanteens = String(u.CanteenID || "").split(",").map(x => x.trim()).filter(Boolean);
                
                if (currentCanteens.includes(targetCanteenStr)) {
                    const newCanteens = currentCanteens.filter(x => x !== targetCanteenStr);
                    const newVal = newCanteens.length > 0 ? newCanteens.join(",") : null;
                    
                    await request
                        .input(`uid_${u.UserID}`, sql.Int, u.UserID)
                        .input(`cid_${u.UserID}`, sql.NVarChar, newVal)
                        .query(`UPDATE dbo.UserMaster SET CanteenID = @cid_${u.UserID} WHERE UserID = @uid_${u.UserID}`);
                }
            }

            if (managerId) {
                const mRes = await request.input("mId", sql.Int, managerId).query("SELECT CanteenID, Role FROM dbo.UserMaster WHERE UserID=@mId");
                const target = mRes.recordset[0];
                
                if (target && String(target.Role || "").toLowerCase() === "user") {
                    let cids = String(target.CanteenID || "").split(",").map(x => x.trim()).filter(Boolean);
                    if (!cids.includes(targetCanteenStr)) cids.push(targetCanteenStr);
                    
                    await request
                        .input("finalV", sql.NVarChar, cids.join(","))
                        .input("finalMId", sql.Int, managerId)
                        .query("UPDATE dbo.UserMaster SET CanteenID=@finalV WHERE UserID=@finalMId");
                }
            }

            await transaction.commit();
            res.json({ success: true, users: await fetchAllUsers(pool) });
        } catch (err) {
            if (transaction) await transaction.rollback();
            handleSQLError(err, res, "POST /api/assign");
        }
    });

    // ==========================================
    // 🔓 LOGIN HANDLER (OPEN ROUTE)
    // ==========================================

    router.post("/api/login", async (req, res) => {
        const { email, password } = req.body;
        try {
            const pool = await poolConnect;
            
            const result = await pool.request()
                .input("email", sql.NVarChar, email)
                .query("SELECT UserID, Name, Email, Password, Role, CanteenID FROM dbo.UserMaster WHERE Email = @email");
                
            if (result.recordset.length > 0) {
                const user = result.recordset[0];
                
                const isValid = bcrypt.compareSync(password, user.Password);
                
                if (isValid) {
                    const token = jwt.sign(
                        { id: user.UserID, role: user.Role, email: user.Email },
                        JWT_SECRET,
                        { expiresIn: '8h' }
                    );

                    delete user.Password;
                    res.json({ success: true, user: { ...user, token } });
                } else {
                    res.status(401).json({ success: false, message: "Invalid credentials" });
                }
            } else {
                res.status(401).json({ success: false, message: "Invalid credentials" });
            }
        } catch (err) {
            handleSQLError(err, res, "POST /api/login");
        }
    });

    return router;
};