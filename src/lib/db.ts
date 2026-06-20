import fs from "fs";
import path from "path";
import crypto from "crypto";

const DB_DIR = path.join(process.cwd(), "data");

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

export const db = {
  getUserByEmail(email: string): UserRecord | null {
    const cleanEmail = email.toLowerCase().trim();
    const filePath = getSanitizedFilename(cleanEmail);
    
    if (fs.existsSync(filePath)) {
      try {
        const data = fs.readFileSync(filePath, "utf8");
        const user = JSON.parse(data) as UserRecord;
        if (checkAndApplyExpiry(user)) {
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
      if (checkAndApplyExpiry(user)) {
        fs.writeFileSync(filePath, JSON.stringify(user, null, 2), "utf8");
      }
    }
    return user;
  },

  getUserById(id: string): UserRecord | null {
    ensureDbDir();
    const files = fs.readdirSync(DB_DIR);
    for (const file of files) {
      if (file.startsWith("user_") && file.endsWith(".json")) {
        try {
          const filePath = path.join(DB_DIR, file);
          const user = JSON.parse(fs.readFileSync(filePath, "utf8")) as UserRecord;
          if (user.id === id) {
            if (checkAndApplyExpiry(user)) {
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
      if (checkAndApplyExpiry(user)) {
        const filePath = getSanitizedFilename(user.email);
        fs.writeFileSync(filePath, JSON.stringify(user, null, 2), "utf8");
      }
    }
    return user;
  },

  createUser(email: string, passwordHash: string | undefined, fullName: string, avatarUrl?: string): UserRecord {
    ensureDbDir();
    const cleanEmail = email.toLowerCase().trim();
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

    fs.writeFileSync(filePath, JSON.stringify(newUser, null, 2), "utf8");
    return newUser;
  },

  updateWorkspaceData(userId: string, workspaceData: UserRecord["workspaceData"]) {
    const user = this.getUserById(userId);
    if (!user) {
      throw new Error("User not found for workspace sync.");
    }
    
    user.workspaceData = workspaceData;
    const filePath = getSanitizedFilename(user.email);
    ensureDbDir();
    fs.writeFileSync(filePath, JSON.stringify(user, null, 2), "utf8");
  },

  updatePasswordHash(userId: string, passwordHash: string) {
    const user = this.getUserById(userId);
    if (!user) throw new Error("User not found.");
    user.passwordHash = passwordHash;
    ensureDbDir();
    fs.writeFileSync(getSanitizedFilename(user.email), JSON.stringify(user, null, 2), "utf8");
  },

  updateUserPlan(userId: string, plan: UserRecord["plan"]) {
    const user = this.getUserById(userId);
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
    const filePath = getSanitizedFilename(user.email);
    ensureDbDir();
    fs.writeFileSync(filePath, JSON.stringify(user, null, 2), "utf8");
  }
};
