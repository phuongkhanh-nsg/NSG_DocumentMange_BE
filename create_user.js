const { MongoClient } = require('mongodb');
const bcrypt = require('bcryptjs');

const uri = "mongodb+srv://Vercel-Admin-atlas-fulvous-notebook:S3BiFzbWXaZTCTns@atlas-fulvous-notebook.cy9ar7d.mongodb.net/NSG_Database?retryWrites=true&w=majority";

async function createUser() {
    const client = new MongoClient(uri);
    try {
        await client.connect();
        const db = client.db("NSG_Database");
        
        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash("Nsg@2025", salt);
        
        const result = await db.collection("users").insertOne({
            name: "Rồng Con (Admin)",
            email: "rongcon@rongcon.net",
            password: hashedPassword,
            role: "admin",
            mobile: "0123456789",
            description: "System Admin created for recovery",
            createdAt: new Date(),
            updatedAt: new Date()
        });
        
        console.log("User rongcon@rongcon.net created successfully with role admin!");
    } catch(e) {
        console.error(e);
    } finally {
        await client.close();
    }
}
createUser();
