const { MongoClient } = require('mongodb');
const bcrypt = require('bcryptjs');

const uri = "mongodb+srv://Vercel-Admin-atlas-fulvous-notebook:S3BiFzbWXaZTCTns@atlas-fulvous-notebook.cy9ar7d.mongodb.net/NSG_Database?retryWrites=true&w=majority";

async function verifyUser() {
    const client = new MongoClient(uri);
    try {
        await client.connect();
        const db = client.db("NSG_Database");
        const user = await db.collection("users").findOne({ email: "rongcon@rongcon.net" });
        
        if (!user) {
            console.log("User rongcon@rongcon.net NOT FOUND in the database.");
            return;
        }
        
        console.log("User found:");
        console.log(`Email: ${user.email}`);
        console.log(`Role: ${user.role}`);
        
        // Check password
        const isMatch = await bcrypt.compare("Nsg@2025", user.password);
        console.log(`Password match for 'Nsg@2025': ${isMatch}`);
        
    } catch(e) {
        console.error(e);
    } finally {
        await client.close();
    }
}
verifyUser();
