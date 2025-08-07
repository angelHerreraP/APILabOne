const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());



const db = mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'techshop'
});

db.connect((err) => {
  if (err) {
    console.error('Database connection failed:', err);
    process.exit(1);
  }
  console.log('Connected to database');
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
  console.log('Login attempt:', { username, password });
  
  // Query vulnerable
  const query = `SELECT * FROM users WHERE username = '${username}' AND password = '${password}'`;
  console.log('Query:', query);
  
  db.query(query, (err, results) => {
    if (err) {
      console.error('Database error:', err);
      res.status(500).json({ error: 'Database error' });
      return;
    }
    
    if (results.length > 0) {
      console.log('Login successful');
      res.json({ success: true, user: results[0] });
    } else {
      console.log('Login failed');
      res.status(401).json({ error: 'Invalid credentials' });
    }
  });
});


// Get all products (vulnerable to SQL injection)
app.get('/api/products', (req, res) => {
  const { search } = req.query;
  let query = 'SELECT * FROM products';
  if (search) {
    // Query vulnerable
    query += ` WHERE name LIKE '%${search}%' OR description LIKE '%${search}%'`;
  }
  db.query(query, (err, results) => {
    if (err) {
      console.error('Database error:', err);
      res.status(500).json({ error: 'Database error' });
      return;
    }
    res.json(results);
  });
});

// Get single product
app.get('/api/products/:id', (req, res) => {
  const { id } = req.params;
  const query = `SELECT * FROM products WHERE id = ${id}`;
  db.query(query, (err, results) => {
    if (err) {
      console.error('Database error:', err);
      res.status(500).json({ error: 'Database error' });
      return;
    }
    if (results.length > 0) {
      res.json(results[0]);
    } else {
      res.status(404).json({ error: 'Product not found' });
    }
  });
});


// Add review (vulnerable to XSS)
app.post('/api/reviews', (req, res) => {
  let { productId, content } = req.body;
  console.log('Review creation request:', req.body);
  // Validación básica
  if (!productId || isNaN(Number(productId))) {
    console.error('Invalid productId:', productId);
    return res.status(400).json({ error: 'productId inválido o faltante' });
  }
  if (!content || typeof content !== 'string') {
    console.error('Invalid content:', content);
    return res.status(400).json({ error: 'content inválido o faltante' });
  }
  productId = Number(productId);
  // No escapamos comillas simples para permitir XSS puro
  const query = `INSERT INTO reviews (product_id, content) VALUES (${productId}, '${content}')`;
  db.query(query, (err, result) => {
    if (err) {
      console.error('Database error:', err.sqlMessage || err);
      res.status(500).json({ error: 'Database error', details: err.sqlMessage || err });
      return;
    }
    db.query(`SELECT * FROM reviews WHERE id = ${result.insertId}`, (err2, results2) => {
      if (err2) {
        res.json({ success: true, id: result.insertId });
      } else {
        res.json({ success: true, review: results2[0] });
      }
    });
  });
});


// Get reviews for a product (vulnerable to XSS)
app.get('/api/reviews/:productId', (req, res) => {
  const { productId } = req.params;
  const query = `SELECT * FROM reviews WHERE product_id = ${productId} ORDER BY created_at DESC`;
  db.query(query, (err, results) => {
    if (err) {
      console.error('Database error:', err);
      res.status(500).json({ error: 'Database error' });
      return;
    }
    res.json(results);
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
