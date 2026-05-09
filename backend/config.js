// config.js
require('dotenv').config();

function loadFullConfig() {
    let rawServer = process.env.DB_SERVER || 'localhost\\SQLEXPRESS';
    
    let parsedServer = rawServer;
    let parsedInstance = undefined;

    if (rawServer.includes('\\')) {
        const parts = rawServer.split('\\');
        parsedServer = parts[0];      
        parsedInstance = parts[1];    
    }

    return {
        dbConfig: {
            user: process.env.DB_USER || 'scl_user',
            password: process.env.DB_PASSWORD || 'Test@123',
            database: process.env.DB_DATABASE || 'SCLcEAS',
            server: parsedServer, 
            
            // 🚀 THE FIX: Force Node.js to wait up to 60 seconds for heavy queries
            requestTimeout: 60000, 
            connectionTimeout: 30000, 
            
            options: {
                instanceName: parsedInstance, 
                trustServerCertificate: true, 
                enableArithAbort: true,
                encrypt: false, 
            }, 
            
            pool: {
                max: 150,                 
                min: 10,                  
                idleTimeoutMillis: 30000  
            }
        },
        PORT: process.env.PORT || 5001
    };
}

module.exports = loadFullConfig();