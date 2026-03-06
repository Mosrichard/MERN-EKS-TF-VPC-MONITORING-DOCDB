const express = require('express');
const mysql = require('mysql2/promise');
const crypto = require('crypto');

const app = express();
app.use(express.json());

let pool;

// Initialize MySQL connection pool
async function initDB() {
  pool = mysql.createPool({
    uri: process.env.DATABASE_URL || 'mysql://root:password@localhost:3306/merndb',
    waitForConnections: true,
    connectionLimit: 10
  });

  // Create tables if they don't exist
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS messages (
      id INT AUTO_INCREMENT PRIMARY KEY,
      from_user VARCHAR(255) NOT NULL,
      to_user VARCHAR(255) NOT NULL,
      message TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS todos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      task TEXT NOT NULL,
      done BOOLEAN DEFAULT FALSE
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS quotes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      username VARCHAR(255) NOT NULL,
      quote TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  console.log('Database initialized');
}

const auth = async (req, res, next) => {
  const token = req.headers.authorization;
  if (!token) return res.status(401).json({error: 'Unauthorized'});
  
  const [users] = await pool.query('SELECT * FROM users WHERE id = ?', [token]);
  if (users.length === 0) return res.status(401).json({error: 'Unauthorized'});
  
  req.userId = token;
  req.username = users[0].username;
  next();
};

app.post('/api/register', async (req, res) => {
  const {username, password} = req.body;
  const [existing] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
  if (existing.length > 0) return res.status(400).json({error: 'Username already exists'});
  
  const hash = crypto.createHash('sha256').update(password).digest('hex');
  await pool.query('INSERT INTO users (username, password) VALUES (?, ?)', [username, hash]);
  res.json({success: true});
});

app.post('/api/login', async (req, res) => {
  const {username, password} = req.body;
  const hash = crypto.createHash('sha256').update(password).digest('hex');
  const [users] = await pool.query('SELECT * FROM users WHERE username = ? AND password = ?', [username, hash]);
  if (users.length === 0) return res.status(401).json({error: 'Invalid credentials'});
  res.json({token: users[0].id.toString(), username: users[0].username});
});

app.get('/api/me', auth, (req, res) => {
  res.json({username: req.username});
});

app.get('/api/users', auth, async (req, res) => {
  const [users] = await pool.query('SELECT id as _id, username FROM users WHERE id != ?', [req.userId]);
  res.json(users);
});

app.get('/api/messages/:user', auth, async (req, res) => {
  const [messages] = await pool.query(
    'SELECT * FROM messages WHERE (from_user = ? AND to_user = ?) OR (from_user = ? AND to_user = ?) ORDER BY created_at ASC',
    [req.username, req.params.user, req.params.user, req.username]
  );
  res.json(messages.map(m => ({...m, from: m.from_user, to: m.to_user, createdAt: m.created_at})));
});

app.post('/api/messages', auth, async (req, res) => {
  const [result] = await pool.query(
    'INSERT INTO messages (from_user, to_user, message) VALUES (?, ?, ?)',
    [req.username, req.body.to, req.body.message]
  );
  res.json({id: result.insertId, from: req.username, to: req.body.to, message: req.body.message});
});

app.get('/api/todos', auth, async (req, res) => {
  const [todos] = await pool.query('SELECT * FROM todos WHERE user_id = ?', [req.userId]);
  res.json(todos.map(t => ({...t, _id: t.id})));
});

app.post('/api/todos', auth, async (req, res) => {
  const [result] = await pool.query('INSERT INTO todos (user_id, task, done) VALUES (?, ?, FALSE)', [req.userId, req.body.task]);
  res.json({_id: result.insertId, userId: req.userId, task: req.body.task, done: false});
});

app.put('/api/todos/:id', auth, async (req, res) => {
  await pool.query('UPDATE todos SET done = NOT done WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
  const [todos] = await pool.query('SELECT * FROM todos WHERE id = ?', [req.params.id]);
  res.json({...todos[0], _id: todos[0].id});
});

app.delete('/api/todos/:id', auth, async (req, res) => {
  await pool.query('DELETE FROM todos WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
  res.json({success: true});
});

app.get('/api/quotes', async (req, res) => {
  const [quotes] = await pool.query('SELECT * FROM quotes ORDER BY created_at DESC LIMIT 50');
  res.json(quotes.map(q => ({...q, _id: q.id, createdAt: q.created_at})));
});

app.post('/api/quotes', auth, async (req, res) => {
  const [result] = await pool.query('INSERT INTO quotes (user_id, username, quote) VALUES (?, ?, ?)', [req.userId, req.username, req.body.quote]);
  res.json({_id: result.insertId, userId: req.userId, username: req.username, quote: req.body.quote});
});

app.delete('/api/quotes/:id', auth, async (req, res) => {
  await pool.query('DELETE FROM quotes WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
  res.json({success: true});
});

initDB().then(() => {
  app.listen(3000, () => console.log('Backend running on port 3000'));
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});
