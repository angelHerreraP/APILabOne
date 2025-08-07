const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Inicializa la base de datos SQLite embebida
const db = new sqlite3.Database('./techshop.db', (err) => {
  if (err) {
    console.error('Database connection failed:', err);
    process.exit(1);
  }
  console.log('Connected to SQLite database');
});

// Crea tablas si no existen y agrega datos de ejemplo
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT,
    password TEXT
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    description TEXT
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER,
    content TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  db.get('SELECT COUNT(*) as count FROM users', (err, row) => {
    if (row.count === 0) {
      db.run(`INSERT INTO users (username, password) VALUES ('admin', 'admin'), ('user', 'user')`);
      db.run(`INSERT INTO products (name, description) VALUES ('Laptop', 'Laptop vulnerable'), ('Phone', 'Phone vulnerable')`);
    }
  });
});

// Test route
app.get('/api/test', (req, res) => {
  res.json({ message: 'API is working!' });
});

// Root route
app.get('/', (req, res) => {
  res.send('API is running');
});

// Endpoint vulnerable a SQL Injection
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const query = `SELECT * FROM users WHERE username = '${username}' AND password = '${password}'`;
  db.all(query, (err, rows) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (rows.length > 0) res.json({ success: true, user: rows[0] });
    else res.status(401).json({ error: 'Invalid credentials' });
  });
});

// Get all products (vulnerable to SQL injection)
app.get('/api/products', (req, res) => {
  const { search } = req.query;
  let query = 'SELECT * FROM products';
  if (search) {
    query += ` WHERE name LIKE '%${search}%' OR description LIKE '%${search}%'`;
  }
  db.all(query, (err, rows) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json(rows);
  });
});

// Get single product
app.get('/api/products/:id', (req, res) => {
  const { id } = req.params;
  const query = `SELECT * FROM products WHERE id = ${id}`;
  db.get(query, (err, row) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (row) res.json(row);
    else res.status(404).json({ error: 'Product not found' });
  });
});

// Add review (vulnerable a XSS)
app.post('/api/reviews', (req, res) => {
  let { productId, content } = req.body;
  if (!productId || isNaN(Number(productId))) {
    return res.status(400).json({ error: 'productId inválido o faltante' });
  }
  if (!content || typeof content !== 'string') {
    return res.status(400).json({ error: 'content inválido o faltante' });
  }
  productId = Number(productId);
  db.run(
    `INSERT INTO reviews (product_id, content) VALUES (?, ?)`,
    [productId, content],
    function (err) {
      if (err) return res.status(500).json({ error: 'Database error', details: err.message });
      db.get(`SELECT * FROM reviews WHERE id = ${this.lastID}`, (err2, review) => {
        if (err2) res.json({ success: true, id: this.lastID });
        else res.json({ success: true, review });
      });
    }
  );
});

// Get reviews for a product (vulnerable to XSS)
app.get('/api/reviews/:productId', (req, res) => {
  const { productId } = req.params;
  const query = `SELECT * FROM reviews WHERE product_id = ${productId} ORDER BY created_at DESC`;
  db.all(query, (err, rows) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json(rows);
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});