import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import mongoose from 'mongoose';
import argon2 from 'argon2';

export const dbMode = process.env.NODE_ENV === 'development' ? 'sqlite' : 'mongodb';
let sqlite;
const cache = new Map();

const collections = [
  'users','customers','inquiries','bookings','vehicles','drivers','partners',
  'assignments','availabilityBlocks','quotations','payments','expenses','notifications','settings','auditLogs','sessions'
];

function sqliteCollection(name) {
  return {
    async find(filter = {}) {
      const rows = sqlite.prepare(`SELECT data FROM "${name}"`).all();
      return rows.map(r => JSON.parse(r.data)).filter(doc => matches(doc, filter));
    },
    async findOne(filter = {}) {
      return (await this.find(filter))[0] || null;
    },
    async insert(doc) {
      const item = { ...doc, _id: doc._id || cryptoId(), createdAt: doc.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString() };
      sqlite.prepare(`INSERT INTO "${name}" (id, data) VALUES (?, ?)`).run(item._id, JSON.stringify(item));
      return item;
    },
    async update(id, patch) {
      const current = await this.findOne({ _id: id });
      if (!current) return null;
      const next = { ...current, ...patch, _id: id, updatedAt: new Date().toISOString() };
      sqlite.prepare(`UPDATE "${name}" SET data = ? WHERE id = ?`).run(JSON.stringify(next), id);
      return next;
    },
    async remove(id) {
      return sqlite.prepare(`DELETE FROM "${name}" WHERE id = ?`).run(id).changes > 0;
    }
  };
}
function matches(doc, filter) {
  return Object.entries(filter).every(([key, value]) => {
    const actual = key.split('.').reduce((o, k) => o?.[k], doc);
    if (value && typeof value === 'object' && '$in' in value) return value.$in.includes(actual);
    if (value && typeof value === 'object' && '$ne' in value) return actual !== value.$ne;
    return String(actual ?? '') === String(value ?? '');
  });
}
function cryptoId() { return globalThis.crypto.randomUUID(); }

function initializeSqliteTables() {
  const createTables = sqlite.transaction(() => {
    for (const name of collections) {
      sqlite.exec(`CREATE TABLE IF NOT EXISTS "${name}" (id TEXT PRIMARY KEY, data TEXT NOT NULL)`);
    }

    const legacyTable = sqlite.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'documents'"
    ).get();
    if (!legacyTable) return;
    const archivedTable = sqlite.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'documents_legacy'"
    ).get();

    const knownCollections = new Set(collections);
    const legacyRows = sqlite.prepare('SELECT id, collection, data FROM documents').all();

    for (const row of legacyRows) {
      if (!knownCollections.has(row.collection)) continue;
      sqlite.prepare(`INSERT OR IGNORE INTO "${row.collection}" (id, data) VALUES (?, ?)`).run(row.id, row.data);
      const migrated = sqlite.prepare(`SELECT data FROM "${row.collection}" WHERE id = ?`).get(row.id);
      if (!migrated || migrated.data !== row.data) {
        throw new Error(`SQLite migration found a conflicting ${row.collection} record with ID ${row.id}.`);
      }
    }

    const hasUnknownCollections = legacyRows.some(row => !knownCollections.has(row.collection));
    if (!hasUnknownCollections && !archivedTable) {
      sqlite.exec('ALTER TABLE documents RENAME TO documents_legacy');
      console.log(`Migrated ${legacyRows.length} records into per-resource SQLite tables.`);
    } else {
      console.warn(`Legacy SQLite documents table retained${hasUnknownCollections ? ' because it contains unrecognized resource records' : ' because documents_legacy already exists'}.`);
    }
  });
  createTables();
}

function mongoCollection(name) {
  const col = mongoose.connection.collection(name);
  return {
    async find(filter = {}) { return col.find(filter).sort({ createdAt: -1 }).toArray(); },
    async findOne(filter = {}) {
      const query = { ...filter };
      if (typeof query._id === 'string' && mongoose.Types.ObjectId.isValid(query._id)) {
        query._id = new mongoose.Types.ObjectId(query._id);
      }
      return col.findOne(query);
    },
    async insert(doc) {
      const item = { ...doc, createdAt: new Date(), updatedAt: new Date() };
      const result = await col.insertOne(item);
      return { ...item, _id: result.insertedId };
    },
    async update(id, patch) {
      const { ObjectId } = mongoose.Types;
      const _id = ObjectId.isValid(id) ? new ObjectId(id) : id;
      await col.updateOne({ _id }, { $set: { ...patch, updatedAt: new Date() } });
      return col.findOne({ _id });
    },
    async remove(id) {
      const { ObjectId } = mongoose.Types;
      const _id = ObjectId.isValid(id) ? new ObjectId(id) : id;
      return (await col.deleteOne({ _id })).deletedCount > 0;
    }
  };
}

export function collection(name) {
  if (!collections.includes(name)) throw new Error('Unknown collection');
  if (!cache.has(name)) cache.set(name, dbMode === 'sqlite' ? sqliteCollection(name) : mongoCollection(name));
  return cache.get(name);
}

export async function connectDatabase() {
  if (dbMode === 'sqlite') {
    const dir = path.resolve('data');
    fs.mkdirSync(dir, { recursive: true });
    sqlite = new Database(path.join(dir, 'cabconnect.sqlite'));
    sqlite.pragma('journal_mode = WAL');
    sqlite.pragma('foreign_keys = ON');
    initializeSqliteTables();
    console.log('SQLite database ready: data/cabconnect.sqlite');
  } else {
    if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required when NODE_ENV is not development.');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB connected');
  }
}

export async function seedUsers() {
  const users = collection('users');
  const defaults = [
    { username: 'admin', displayName: 'Administrator', role: 'admin', password: 'admin@123' },
    { username: 'chirag', displayName: 'Chirag', role: 'owner', password: 'chirag@123' }
  ];
  for (const user of defaults) {
    const existing = await users.findOne({ username: user.username });
    if (!existing) {
      const passwordHash = await argon2.hash(user.password);
      await users.insert({
        username: user.username,
        displayName: user.displayName,
        role: user.role,
        passwordHash,
        mustChangePassword: true,
        active: true
      });
    }
  }
}
