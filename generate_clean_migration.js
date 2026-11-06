const fs = require('fs');
const path = require('path');

const migrationsDir = './supabase/migrations';
const files = fs.readdirSync(migrationsDir).sort();

console.log('Total migration files found:', files.length);

const out = [];

out.push(`-- ========================================================`);
out.push(`-- GEFLOW AI COMPREHENSIVE PRODUCTION SCHEMA MIGRATION`);
out.push(`-- Target Project: jwdztevnodxoeyhcmrnf.supabase.co`);
out.push(`-- ========================================================`);
out.push(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);
out.push(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);
out.push(``);

for (const file of files) {
  if (!file.endsWith('.sql')) continue;
  // Skip redundant duplicate / outdated migration files if any
  const fullPath = path.join(migrationsDir, file);
  const content = fs.readFileSync(fullPath, 'utf8');
  out.push(`-- >>> Migration File: ${file} <<< --`);
  out.push(content);
  out.push(`\n`);
}

fs.writeFileSync('./geflow_all_migrations.sql', out.join('\n'), 'utf8');
console.log('Combined migration written to ./geflow_all_migrations.sql. Size:', fs.statSync('./geflow_all_migrations.sql').size, 'bytes');
