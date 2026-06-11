const { MongoClient } = require('mongodb');

const sourceUri = "mongodb+srv://giakhoi2004:R9g0DFnasKvOeCl3@nsgdatabase.tbu5h.mongodb.net/NSG_Database?retryWrites=true&w=majority&appName=NSGdatabase";
// Added NSG_Database as the database name for the new cluster
const targetUri = "mongodb+srv://Vercel-Admin-atlas-fulvous-notebook:S3BiFzbWXaZTCTns@atlas-fulvous-notebook.cy9ar7d.mongodb.net/NSG_Database?retryWrites=true&w=majority";

async function migrate() {
    console.log("Starting migration process...");
    const sourceClient = new MongoClient(sourceUri);
    const targetClient = new MongoClient(targetUri);

    try {
        await sourceClient.connect();
        await targetClient.connect();
        console.log("Connected to both databases.");

        const sourceDb = sourceClient.db();
        const targetDb = targetClient.db("NSG_Database");

        const collections = await sourceDb.listCollections().toArray();

        for (const col of collections) {
            const colName = col.name;
            console.log(`Reading collection: ${colName}`);
            
            const docs = await sourceDb.collection(colName).find({}).toArray();
            if (docs.length > 0) {
                try {
                    await targetDb.collection(colName).drop();
                } catch(e) {
                    // Ignore drop error if collection doesn't exist
                }
                await targetDb.collection(colName).insertMany(docs);
                console.log(`=> Migrated ${docs.length} documents for ${colName}.`);
            } else {
                console.log(`=> Collection ${colName} is empty.`);
            }
        }
        console.log("Migration completed successfully!");
    } catch (error) {
        console.error("Migration failed:", error);
    } finally {
        await sourceClient.close();
        await targetClient.close();
    }
}

migrate();
