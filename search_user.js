const { MongoClient } = require('mongodb');
const uri = "mongodb+srv://Vercel-Admin-atlas-fulvous-notebook:S3BiFzbWXaZTCTns@atlas-fulvous-notebook.cy9ar7d.mongodb.net/NSG_Database?retryWrites=true&w=majority";

async function searchSimilar() {
    const client = new MongoClient(uri);
    try {
        await client.connect();
        const db = client.db("NSG_Database");
        const users = await db.collection("users").find({ email: { $regex: "rongcon", $options: "i" } }).toArray();
        
        console.log(`Found ${users.length} users matching 'rongcon'`);
        users.forEach(u => console.log(u.email));
    } catch(e) {
        console.error(e);
    } finally {
        await client.close();
    }
}
searchSimilar();
