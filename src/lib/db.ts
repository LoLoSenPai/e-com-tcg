import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;

if (!uri) {
  console.warn(
    "MONGODB_URI missing: using local sample data for products and cart.",
  );
}

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

let clientPromise: Promise<MongoClient> | undefined;
let hasLoggedError = false;

if (uri) {
  if (!global._mongoClientPromise) {
    const client = new MongoClient(uri, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
    });
    global._mongoClientPromise = client.connect();
  }
  clientPromise = global._mongoClientPromise;
}

async function getClient() {
  if (!clientPromise) {
    throw new Error("MongoDB client not initialized.");
  }
  try {
    return await clientPromise;
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
