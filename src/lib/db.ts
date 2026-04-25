import { MongoClient } from "mongodb";

declare global {
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

let clientPromise: Promise<MongoClient> | undefined;
let hasLoggedError = false;

function getClientPromise() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MongoDB client not initialized.");
  }

  if (!global._mongoClientPromise) {
    const client = new MongoClient(uri, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
    });
    global._mongoClientPromise = client.connect();
  }
  clientPromise = global._mongoClientPromise;
  return clientPromise;
}

async function getClient() {
  try {
    return await (clientPromise || getClientPromise());
  } catch (error) {
    if (!hasLoggedError) {
      console.warn("MongoDB connection failed, retrying on next request.");
      hasLoggedError = true;
    }
    global._mongoClientPromise = undefined;
    clientPromise = undefined;
    throw error;
  }
}

export async function getDb() {
  const client = await getClient();
  return client.db(process.env.MONGODB_DB || "nebula_tcg");
}
