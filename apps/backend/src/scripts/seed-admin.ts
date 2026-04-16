/**
 * Seed script — creates a default admin account.
 *
 * Usage:  pnpm seed:admin          (from repo root)
 *         pnpm --filter backend seed:admin
 *
 * Reads MONGODB_URI from apps/backend/.env.
 * Safe to run multiple times — skips creation if the email already exists.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as mongoose from 'mongoose';
import * as bcrypt from 'bcrypt';

// ── Config ────────────────────────────────────────────────────────────────────

const ADMIN_EMAIL = 'admin@gradion.dev';
const ADMIN_PASSWORD = 'Admin@1234';

// ── Load .env manually (no dotenv dep required) ───────────────────────────────

function loadEnv(): void {
  const envPath = path.resolve(__dirname, '../../.env');
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed
      .slice(eqIdx + 1)
      .trim()
      .replace(/^["']|["']$/g, '');
    if (key && !(key in process.env)) {
      process.env[key] = value;
    }
  }
}

// ── Mongoose user schema (minimal — matches auth/schemas/user.schema.ts) ──────

const UserSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
  },
  { timestamps: true },
);

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  loadEnv();

  const uri = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/gradion';

  console.log('Connecting to MongoDB…');
  await mongoose.connect(uri);

  const User = mongoose.model('User', UserSchema);

  const existing = await User.findOne({ email: ADMIN_EMAIL }).exec();
  if (existing) {
    console.log(`\n✓ Admin account already exists — nothing to do.`);
    console.log(`  Email:    ${ADMIN_EMAIL}`);
    console.log(`  Password: (unchanged)\n`);
    await mongoose.disconnect();
    return;
  }

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  await User.create({ email: ADMIN_EMAIL, passwordHash, role: 'admin' });

  console.log('\n✓ Admin account created successfully.\n');
  console.log('  ┌─────────────────────────────────┐');
  console.log(`  │  Email:    ${ADMIN_EMAIL.padEnd(23)}│`);
  console.log(`  │  Password: ${ADMIN_PASSWORD.padEnd(23)}│`);
  console.log('  └─────────────────────────────────┘\n');
  console.log('  Log in at http://localhost:3000/login\n');

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
