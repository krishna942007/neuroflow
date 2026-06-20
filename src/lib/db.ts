import fs from "fs";
import path from "path";
import crypto from "crypto";
import os from "os";
import { MongoClient, Db } from "mongodb";

const DB_DIR = process.env.NEUROFLOW_DATA_DIR || (
  process.env.VERCEL ? path.join(os.tmpdir(), "neuroflow-data") : path.join(process.cwd(), "data")
);

let mongoClient: MongoClient | null = null;
let mongoDb: Db | null = null;
const MONGODB_URI = process.env.MONGODB_URI;

async function getMongoDb(): Promise<Db | null> {
  if (!MONGODB_URI) return null;
  if (mongoDb) return mongoDb;
  try {
    mongoClient = new MongoClient(MONGODB_URI, {
      maxPoolSize: 10,
      connectTimeoutMS: 5000,
    });
    await mongoClient.connect();
    mongoDb = mongoClient.db("neuroflow");
    console.log("Connected successfully to MongoDB.");
    
    // Ensure index on email and id
    const usersCollection = mongoDb.collection("users");
    await usersCollection.createIndex({ email: 1 }, { unique: true });
    await usersCollection.createIndex({ id: 1 }, { unique: true });
    
    return mongoDb;
  } catch (err) {
    console.error("Failed to connect to MongoDB, falling back to local files:", err);
    return null;
  }
}

export interface UserRecord {
  id: string;
  email: string;
  fullName: string;
  passwordHash?: string;
  avatarUrl?: string;
  role: "admin" | "user";
  plan: "free" | "pro" | "enterprise";
  createdAt: string;
  planExpiresAt?: string;
  hasClaimedPromo?: boolean;
  planDuration?: number;
  workspaceData?: {
    workspaces: any[];
    folders: any[];
    files: any[];
    activeWorkspaceId: string;
  };
}

// Salted, deliberately expensive password hashing. Existing SHA-256 hashes
// are recognized by verifyPassword and upgraded on the user's next login.
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${derived}`;
}

export function verifyPassword(password: string, storedHash: string): { valid: boolean; needsUpgrade: boolean } {
  if (storedHash.startsWith("scrypt$")) {
    const [, salt, expectedHex] = storedHash.split("$");
    if (!salt || !expectedHex) return { valid: false, needsUpgrade: false };
    const actual = crypto.scryptSync(password, salt, 64);
    const expected = Buffer.from(expectedHex, "hex");
    return {
      valid: actual.length === expected.length && crypto.timingSafeEqual(actual, expected),
      needsUpgrade: false,
    };
  }

  const legacy = crypto.createHash("sha256").update(password).digest("hex");
  const actual = Buffer.from(legacy);
  const expected = Buffer.from(storedHash);
  return {
    valid: actual.length === expected.length && crypto.timingSafeEqual(actual, expected),
    needsUpgrade: true,
  };
}

function getSanitizedFilename(email: string): string {
  const cleanEmail = email.toLowerCase().trim();
  return path.join(DB_DIR, `user_${encodeURIComponent(cleanEmail).replace(/[*]/g, "_")}.json`);
}

function ensureDbDir() {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
}

// Run global migration once on file import/load
try {
  const oldDbPath = path.join(DB_DIR, "db.json");
  if (fs.existsSync(oldDbPath)) {
    ensureDbDir();
    const data = JSON.parse(fs.readFileSync(oldDbPath, "utf8")) as any;
    if (data && data.users) {
      for (const email of Object.keys(data.users)) {
        const user = data.users[email];
        const newFile = getSanitizedFilename(email);
        if (!fs.existsSync(newFile)) {
          fs.writeFileSync(newFile, JSON.stringify(user, null, 2), "utf8");
        }
      }
      fs.unlinkSync(oldDbPath);
      console.log("Successfully migrated all users to individual database files globally.");
    }
  }
} catch (err) {
  console.error("Global migration failed on database initialization:", err);
}

// Migration from the old shared db.json (if it exists)
function migrateUserFromOldDb(email: string): UserRecord | null {
  const cleanEmail = email.toLowerCase().trim();
  const oldDbPath = path.join(DB_DIR, "db.json");
  if (!fs.existsSync(oldDbPath)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(oldDbPath, "utf8")) as any;
    if (data.users && data.users[cleanEmail]) {
      const user = data.users[cleanEmail];
      ensureDbDir();
      const newFile = getSanitizedFilename(cleanEmail);
      fs.writeFileSync(newFile, JSON.stringify(user, null, 2), "utf8");
      
      // Remove from old db
      delete data.users[cleanEmail];
      if (Object.keys(data.users).length === 0) {
        try {
          fs.unlinkSync(oldDbPath);
        } catch (_) {}
      } else {
        fs.writeFileSync(oldDbPath, JSON.stringify(data, null, 2), "utf8");
      }
      return user;
    }
  } catch (err) {
    console.error("Migration from old db failed:", err);
  }
  return null;
}

function migrateUserByIdFromOldDb(id: string): UserRecord | null {
  const oldDbPath = path.join(DB_DIR, "db.json");
  if (!fs.existsSync(oldDbPath)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(oldDbPath, "utf8")) as any;
    if (data.users) {
      const found = (Object.values(data.users) as any[]).find((u: any) => u.id === id);
      if (found) {
        return migrateUserFromOldDb(found.email);
      }
    }
  } catch (err) {
    console.error("Migration by ID from old db failed:", err);
  }
  return null;
}

function checkAndApplyExpiry(user: UserRecord): boolean {
  if (user.plan === "pro" && user.planExpiresAt) {
    if (new Date(user.planExpiresAt).getTime() < Date.now()) {
      user.plan = "free";
      user.planExpiresAt = undefined;
      user.planDuration = undefined;
      return true;
    }
  }
  return false;
}

function cleanupUserRecordData(user: UserRecord): boolean {
  let changed = false;
  
  // 1. Check and correct workspaces ownerId and members
  if (user.workspaceData && Array.isArray(user.workspaceData.workspaces)) {
    user.workspaceData.workspaces = user.workspaceData.workspaces.map((ws: any) => {
      if (ws && (ws.ownerId === "user-1" || ws.ownerId === "guest")) {
        changed = true;
        return {
          ...ws,
          ownerId: user.id,
          members: Array.isArray(ws.members) 
            ? (ws.members.includes(user.id) ? ws.members : [user.id, ...ws.members.filter((m: string) => m !== "user-1")])
            : [user.id]
        };
      }
      return ws;
    });
  }

  // 2. Filter out Krishna's resume files from other users' files list
  if (user.workspaceData && Array.isArray(user.workspaceData.files)) {
    const cleanEmail = user.email.toLowerCase().trim();
    const isKrishna = cleanEmail.includes("krishna") || cleanEmail.includes("krishnasd7869");
    
    if (!isKrishna) {
      const originalLength = user.workspaceData.files.length;
      user.workspaceData.files = user.workspaceData.files.filter((file: any) => {
        if (!file) return false;
        const fileName = (file.name || "").toLowerCase();
        // Remove files containing "krishna" or "resume" if it is not krishna's account
        const shouldRemove = fileName.includes("krishna") || 
                             (fileName.includes("resume") && !fileName.includes("welcome"));
        return !shouldRemove;
      });
      if (user.workspaceData.files.length !== originalLength) {
        changed = true;
      }
    }
  }

  return changed;
}

export const db = {
  async getUserByEmail(email: string): Promise<UserRecord | null> {
    const cleanEmail = email.toLowerCase().trim();
    
    const mDb = await getMongoDb();
    if (mDb) {
      try {
        const user = await mDb.collection<UserRecord>("users").findOne({ email: cleanEmail });
        if (user) {
          let needsSave = checkAndApplyExpiry(user);
          if (cleanupUserRecordData(user)) {
            needsSave = true;
          }
          if (needsSave) {
            await mDb.collection<UserRecord>("users").replaceOne({ email: cleanEmail }, user);
          }
          return user;
        }
        return null;
      } catch (err) {
        console.error("MongoDB getUserByEmail error:", err);
      }
    }
    
    // File fallback
    const filePath = getSanitizedFilename(cleanEmail);
    if (fs.existsSync(filePath)) {
      try {
        const data = fs.readFileSync(filePath, "utf8");
        const user = JSON.parse(data) as UserRecord;
        let needsSave = checkAndApplyExpiry(user);
        if (cleanupUserRecordData(user)) {
          needsSave = true;
        }
        if (needsSave) {
          fs.writeFileSync(filePath, JSON.stringify(user, null, 2), "utf8");
        }
        return user;
      } catch (err) {
        console.error(`Failed to read user database file ${filePath}:`, err);
        return null;
      }
    }
    
    // Check and migrate from old db
    const user = migrateUserFromOldDb(cleanEmail);
    if (user) {
      let needsSave = checkAndApplyExpiry(user);
      if (cleanupUserRecordData(user)) {
        needsSave = true;
      }
      if (needsSave) {
        fs.writeFileSync(filePath, JSON.stringify(user, null, 2), "utf8");
      }
    }
    return user;
  },

  async getUserById(id: string): Promise<UserRecord | null> {
    const mDb = await getMongoDb();
    if (mDb) {
      try {
        const user = await mDb.collection<UserRecord>("users").findOne({ id });
        if (user) {
          let needsSave = checkAndApplyExpiry(user);
          if (cleanupUserRecordData(user)) {
            needsSave = true;
          }
          if (needsSave) {
            await mDb.collection<UserRecord>("users").replaceOne({ id }, user);
          }
          return user;
        }
        return null;
      } catch (err) {
        console.error("MongoDB getUserById error:", err);
      }
    }

    // File fallback
    ensureDbDir();
    const files = fs.readdirSync(DB_DIR);
    for (const file of files) {
      if (file.startsWith("user_") && file.endsWith(".json")) {
        try {
          const filePath = path.join(DB_DIR, file);
          const user = JSON.parse(fs.readFileSync(filePath, "utf8")) as UserRecord;
          if (user.id === id) {
            let needsSave = checkAndApplyExpiry(user);
            if (cleanupUserRecordData(user)) {
              needsSave = true;
            }
            if (needsSave) {
              fs.writeFileSync(filePath, JSON.stringify(user, null, 2), "utf8");
            }
            return user;
          }
        } catch (_) {}
      }
    }
    
    // Check and migrate from old db
    const user = migrateUserByIdFromOldDb(id);
    if (user) {
      let needsSave = checkAndApplyExpiry(user);
      if (cleanupUserRecordData(user)) {
        needsSave = true;
      }
      if (needsSave) {
        const filePath = getSanitizedFilename(user.email);
        fs.writeFileSync(filePath, JSON.stringify(user, null, 2), "utf8");
      }
    }
    return user;
  },

  async createUser(email: string, passwordHash: string | undefined, fullName: string, avatarUrl?: string): Promise<UserRecord> {
    const cleanEmail = email.toLowerCase().trim();
    const newUser: UserRecord = {
      id: `user-${crypto.randomBytes(4).toString("hex")}`,
      email: cleanEmail,
      fullName,
      passwordHash,
      avatarUrl: avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(fullName)}`,
      role: "user",
      plan: "free",
      createdAt: new Date().toISOString()
    };

    const mDb = await getMongoDb();
    if (mDb) {
      try {
        const existing = await mDb.collection("users").findOne({ email: cleanEmail });
        if (existing) {
          throw new Error("User already exists with this email.");
        }
        await mDb.collection<UserRecord>("users").insertOne(newUser);
        return newUser;
      } catch (err) {
        console.error("MongoDB createUser error:", err);
        throw err;
      }
    }

    // File fallback
    ensureDbDir();
    const filePath = getSanitizedFilename(cleanEmail);
    
    if (fs.existsSync(filePath)) {
      throw new Error("User already exists with this email.");
    }
    
    // Check if user is in old db
    const oldDbPath = path.join(DB_DIR, "db.json");
    if (fs.existsSync(oldDbPath)) {
      try {
        const oldData = JSON.parse(fs.readFileSync(oldDbPath, "utf8"));
        if (oldData.users && oldData.users[cleanEmail]) {
          throw new Error("User already exists with this email.");
        }
      } catch (_) {}
    }

    fs.writeFileSync(filePath, JSON.stringify(newUser, null, 2), "utf8");
    return newUser;
  },

  async recreateUser(user: Omit<UserRecord, "createdAt">): Promise<UserRecord> {
    const cleanEmail = user.email.toLowerCase().trim();
    const newUser: UserRecord = {
      ...user,
      createdAt: new Date().toISOString()
    };

    const mDb = await getMongoDb();
    if (mDb) {
      try {
        await mDb.collection<UserRecord>("users").replaceOne({ id: user.id }, newUser, { upsert: true });
        return newUser;
      } catch (err) {
        console.error("MongoDB recreateUser error:", err);
      }
    }

    // File fallback
    ensureDbDir();
    const filePath = getSanitizedFilename(cleanEmail);
    fs.writeFileSync(filePath, JSON.stringify(newUser, null, 2), "utf8");
    return newUser;
  },

  async updateWorkspaceData(userId: string, workspaceData: UserRecord["workspaceData"]): Promise<void> {
    const mDb = await getMongoDb();
    if (mDb) {
      try {
        const res = await mDb.collection<UserRecord>("users").updateOne({ id: userId }, { $set: { workspaceData } });
        if (res.matchedCount === 0) {
          throw new Error("User not found for workspace sync.");
        }
        return;
      } catch (err) {
        console.error("MongoDB updateWorkspaceData error:", err);
        throw err;
      }
    }

    // File fallback
    const user = await this.getUserById(userId);
    if (!user) {
      throw new Error("User not found for workspace sync.");
    }
    
    user.workspaceData = workspaceData;
    const filePath = getSanitizedFilename(user.email);
    ensureDbDir();
    fs.writeFileSync(filePath, JSON.stringify(user, null, 2), "utf8");
  },

  async updatePasswordHash(userId: string, passwordHash: string): Promise<void> {
    const mDb = await getMongoDb();
    if (mDb) {
      try {
        await mDb.collection<UserRecord>("users").updateOne({ id: userId }, { $set: { passwordHash } });
        return;
      } catch (err) {
        console.error("MongoDB updatePasswordHash error:", err);
        throw err;
      }
    }

    // File fallback
    const user = await this.getUserById(userId);
    if (!user) throw new Error("User not found.");
    user.passwordHash = passwordHash;
    ensureDbDir();
    fs.writeFileSync(getSanitizedFilename(user.email), JSON.stringify(user, null, 2), "utf8");
  },

  async updateUserPlan(userId: string, plan: UserRecord["plan"]): Promise<void> {
    const user = await this.getUserById(userId);
    if (!user) {
      throw new Error("User not found to update subscription plan.");
    }
    
    // Enforce lock: user once in Pro cannot downgrade until plan is over (plan expires)
    if (plan === "free" && user.plan === "pro") {
      if (user.planExpiresAt && new Date(user.planExpiresAt).getTime() > Date.now()) {
        throw new Error("Cannot downgrade to Free while Pro subscription is active.");
      }
    }

    user.plan = plan;
    if (plan === "pro") {
      if (!user.hasClaimedPromo) {
        user.planExpiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
        user.hasClaimedPromo = true;
        user.planDuration = 365;
      } else {
        user.planExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        user.planDuration = 30;
      }
    } else if (plan === "free") {
      user.planExpiresAt = undefined;
      user.planDuration = undefined;
    }

    const mDb = await getMongoDb();
    if (mDb) {
      try {
        await mDb.collection<UserRecord>("users").updateOne(
          { id: userId },
          { 
            $set: { 
              plan: user.plan, 
              planExpiresAt: user.planExpiresAt, 
              hasClaimedPromo: user.hasClaimedPromo, 
              planDuration: user.planDuration 
            } 
          }
        );
        return;
      } catch (err) {
        console.error("MongoDB updateUserPlan error:", err);
        throw err;
      }
    }

    // File fallback
    const filePath = getSanitizedFilename(user.email);
    ensureDbDir();
    fs.writeFileSync(filePath, JSON.stringify(user, null, 2), "utf8");
  }
};
