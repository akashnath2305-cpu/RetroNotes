const { Pool } = require('pg');
require('dotenv').config();

// Create connection pool
// Can use DATABASE_URL or fallback to separate credentials
const connectionString = process.env.DATABASE_URL;

const pool = new Pool(
  connectionString
    ? { connectionString, ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false }
    : {
        user: process.env.DB_USER || 'postgres',
        host: process.env.DB_HOST || 'localhost',
        database: process.env.DB_NAME || 'ai_notes_db',
        password: process.env.DB_PASSWORD || 'postgres',
        port: parseInt(process.env.DB_PORT || '5432'),
      }
);

// Database initialization query
const initDbQuery = `
  CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

  CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS notebooks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subject VARCHAR(255) NOT NULL,
    cover_color VARCHAR(50) NOT NULL DEFAULT '#3f51b5',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    notebook_id UUID REFERENCES notebooks(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    chapter VARCHAR(255) DEFAULT 'Uncategorized',
    page_marker_color VARCHAR(50),
    page_number INT,
    drawing_data TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS highlights (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    start_index INT NOT NULL,
    end_index INT NOT NULL,
    color VARCHAR(50) NOT NULL,
    text TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS side_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    highlight_id UUID REFERENCES highlights(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    position_y INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sticky_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    note_id UUID REFERENCES notes(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    color VARCHAR(50) NOT NULL,
    type VARCHAR(50) DEFAULT 'manual',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS comics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    panels_json TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS quizzes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    quiz_json TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS feedbacks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    type VARCHAR(50) DEFAULT 'General',
    status VARCHAR(50) DEFAULT 'Pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`;

const initDb = async () => {
  try {
    const client = await pool.connect();
    console.log('Connected to PostgreSQL successfully. Initializing database schema...');
    
    // Create UUID extension first
    await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');
    
    // Execute schema queries (creates tables if they do not exist)
    await client.query(initDbQuery);
    
    // Run incremental migrations to alter tables if database already existed
    await client.query('ALTER TABLE notes ADD COLUMN IF NOT EXISTS notebook_id UUID REFERENCES notebooks(id) ON DELETE CASCADE;');
    await client.query('ALTER TABLE notes ADD COLUMN IF NOT EXISTS page_marker_color VARCHAR(50);');
    await client.query('ALTER TABLE notes ADD COLUMN IF NOT EXISTS page_number INT;');
    await client.query('ALTER TABLE notes ADD COLUMN IF NOT EXISTS chapter VARCHAR(255) DEFAULT \'Uncategorized\';');
    await client.query('ALTER TABLE notes ADD COLUMN IF NOT EXISTS drawing_data TEXT;');
    await client.query('ALTER TABLE sticky_notes ADD COLUMN IF NOT EXISTS note_id UUID REFERENCES notes(id) ON DELETE CASCADE;');
    await client.query('ALTER TABLE sticky_notes ADD COLUMN IF NOT EXISTS type VARCHAR(50) DEFAULT \'manual\';');
    
    // Create feedbacks table if not exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS feedbacks (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        content TEXT NOT NULL,
        type VARCHAR(50) DEFAULT 'General',
        status VARCHAR(50) DEFAULT 'Pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    console.log('Database tables successfully checked/created.');
    
    client.release();
  } catch (err) {
    console.error('Failed to initialize database tables:', err.message);
    console.error('Make sure PostgreSQL is running and credentials in .env are correct.');
  }
};

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
  initDb,
};
