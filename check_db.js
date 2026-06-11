const { MongoClient } = require('mongodb');

const uri = "mongodb+srv://Vercel-Admin-atlas-fulvous-notebook:S3BiFzbWXaZTCTns@atlas-fulvous-notebook.cy9ar7d.mongodb.net/NSG_Database?retryWrites=true&w=majority";

async function checkUsers() {
    const client = new MongoClient(uri);
    try {
        await client.connect();
        const db = client.db("NSG_Database");
        const count = await db.collection("users").countDocuments();
        console.log(`Total users in DB: ${count}`);
        
        // Let's print the emails of the first 5 users to verify
        const users = await db.collection("users").find({}).limit(5).toArray();
        console.log("Sample emails:");
        users.forEach(u => console.log(u.email));
    } catch(e) {
        console.error(e);
    } finally {
        await client.close();
    }
}
checkUsers();
