import express from 'express';
import cors from 'cors';
import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Database setup
const db = new sqlite3.Database(join(__dirname, 'parts.db'), (err) => {
  if (err) console.error(err.message);
  else console.log('Connected to SQLite database.');
});

// Create tables if they don't exist
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS parts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      barcode TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      category_id INTEGER,
      quantity INTEGER DEFAULT 0,
      price REAL,
      cost REAL,
      description TEXT,
      car_make TEXT,
      car_model TEXT,
      car_year_from INTEGER,
      car_year_to INTEGER,
      oe_number TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(category_id) REFERENCES categories(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS barcode_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      barcode TEXT NOT NULL,
      part_id INTEGER,
      action TEXT,
      quantity INTEGER,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(part_id) REFERENCES parts(id)
    )
  `);

  // Ensure new columns exist on older databases
  db.all(`PRAGMA table_info(parts)`, (err, columns) => {
    if (err) {
      console.error('PRAGMA table_info(parts) error:', err.message);
      return;
    }

    const existing = new Set(columns.map(col => col.name));
    const neededColumns = [
      { name: 'car_make', type: 'TEXT' },
      { name: 'car_model', type: 'TEXT' },
      { name: 'car_year_from', type: 'INTEGER' },
      { name: 'car_year_to', type: 'INTEGER' },
      { name: 'oe_number', type: 'TEXT' }
    ];

    neededColumns.forEach(column => {
      if (!existing.has(column.name)) {
        db.run(`ALTER TABLE parts ADD COLUMN ${column.name} ${column.type}`, (alterErr) => {
          if (alterErr) {
            console.error(`Failed to add column ${column.name}:`, alterErr.message);
          } else {
            console.log(`Added column ${column.name} to parts table.`);
          }
        });
      }
    });
  });
});

// Routes

// Get all parts
app.get('/api/parts', (req, res) => {
  db.all(`
    SELECT p.*, c.name as category_name 
    FROM parts p 
    LEFT JOIN categories c ON p.category_id = c.id
    ORDER BY p.name
  `, (err, rows) => {
    if (err) res.status(500).json({ error: err.message });
    else res.json(rows);
  });
});

// Get part by barcode
app.get('/api/parts/barcode/:barcode', (req, res) => {
  const { barcode } = req.params;
  db.get(`
    SELECT p.*, c.name as category_name 
    FROM parts p 
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.barcode = ?
  `, [barcode], (err, row) => {
    if (err) res.status(500).json({ error: err.message });
    else if (!row) res.status(404).json({ message: 'Part not found' });
    else res.json(row);
  });
});

// Get parts by OE number
app.get('/api/parts/oe/:oe_number', (req, res) => {
  const { oe_number } = req.params;
  db.all(`
    SELECT p.*, c.name as category_name 
    FROM parts p 
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.oe_number LIKE ?
    ORDER BY p.name
  `, [`%${oe_number}%`], (err, rows) => {
    if (err) res.status(500).json({ error: err.message });
    else if (!rows || rows.length === 0) res.status(404).json({ message: 'No parts found' });
    else res.json(rows.length === 1 ? rows[0] : rows);
  });
});

// Get parts by name
app.get('/api/parts/name/:name', (req, res) => {
  const { name } = req.params;
  db.all(`
    SELECT p.*, c.name as category_name 
    FROM parts p 
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.name LIKE ?
    ORDER BY p.name
  `, [`%${name}%`], (err, rows) => {
    if (err) res.status(500).json({ error: err.message });
    else if (!rows || rows.length === 0) res.status(404).json({ message: 'No parts found' });
    else res.json(rows.length === 1 ? rows[0] : rows);
  });
});

// Create new part from barcode
app.post('/api/parts', (req, res) => {
  const { barcode, name, category_id, quantity = 1, price = 0, cost = 0, description = '', car_make = '', car_model = '', car_year_from = null, car_year_to = null, oe_number = '' } = req.body;

  if (!barcode || !name) {
    return res.status(400).json({ error: 'Barcode and name are required' });
  }

  db.run(
    `INSERT INTO parts (barcode, name, category_id, quantity, price, cost, description, car_make, car_model, car_year_from, car_year_to, oe_number)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [barcode, name, category_id, quantity, price, cost, description, car_make, car_model, car_year_from, car_year_to, oe_number],
    function(err) {
      if (err) {
        if (err.message.includes('UNIQUE')) {
          return res.status(409).json({ error: 'Part with this barcode already exists' });
        }
        return res.status(500).json({ error: err.message });
      }
      res.status(201).json({ id: this.lastID, barcode, name });
    }
  );
});

// Update part quantity
app.put('/api/parts/:id/quantity', (req, res) => {
  const { id } = req.params;
  const { quantity, action } = req.body;

  db.get('SELECT * FROM parts WHERE id = ?', [id], (err, part) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!part) return res.status(404).json({ error: 'Part not found' });

    let newQuantity = quantity;
    if (action === 'add') newQuantity = part.quantity + quantity;
    else if (action === 'subtract') newQuantity = Math.max(0, part.quantity - quantity);

    db.run('UPDATE parts SET quantity = ? WHERE id = ?', [newQuantity, id], function(err) {
      if (err) return res.status(500).json({ error: err.message });

      db.run(
        'INSERT INTO barcode_log (part_id, barcode, action, quantity) VALUES (?, ?, ?, ?)',
        [id, part.barcode, action || 'update', quantity]
      );

      res.json({ id, quantity: newQuantity });
    });
  });
});

// Get categories
app.get('/api/categories', (req, res) => {
  db.all('SELECT * FROM categories', (err, rows) => {
    if (err) res.status(500).json({ error: err.message });
    else res.json(rows);
  });
});

// Update part details (including car info)
app.put('/api/parts/:id', (req, res) => {
  const { id } = req.params;
  const { name, category_id, price, cost, description, car_make, car_model, car_year_from, car_year_to, oe_number } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Part name is required' });
  }

  db.run(
    `UPDATE parts SET name = ?, category_id = ?, price = ?, cost = ?, description = ?, car_make = ?, car_model = ?, car_year_from = ?, car_year_to = ?, oe_number = ? WHERE id = ?`,
    [name, category_id, price, cost, description, car_make, car_model, car_year_from, car_year_to, oe_number, id],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id, message: 'Part updated successfully' });
    }
  );
});

// Create category
app.post('/api/categories', (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Category name is required' });

  db.run('INSERT INTO categories (name) VALUES (?)', [name], function(err) {
    if (err) {
      if (err.message.includes('UNIQUE')) {
        return res.status(409).json({ error: 'Category already exists' });
      }
      return res.status(500).json({ error: err.message });
    }
    res.status(201).json({ id: this.lastID, name });
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Search endpoint
app.get('/api/search', async (req, res) => {
  const query = req.query.q;
  
  if (!query) {
    return res.status(400).json({ error: 'Query parameter is required' });
  }

  try {
    const results = [];
    
    // Pirma bandyti surasties panašias detales iš duomenų bazės
    try {
      const dbResults = await new Promise((resolve, reject) => {
        db.all(`
          SELECT id, name, barcode, oe_number, price, car_make, car_model 
          FROM parts 
          WHERE name LIKE ? OR oe_number LIKE ? 
          LIMIT 5
        `, [`%${query}%`, `%${query}%`], (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });
      
      if (dbResults && dbResults.length > 0) {
        dbResults.forEach(part => {
          results.push({
            title: `📦 ${part.name}${part.oe_number ? ' (OE: ' + part.oe_number + ')' : ''}`,
            description: `Barkodas: ${part.barcode}${part.car_make ? ' | ' + part.car_make : ''}${part.price ? ' | ' + part.price + '€' : ''}`,
            url: '#local-result',
            isLocal: true
          });
        });
      }
    } catch (e) {
      console.error('Database search error:', e);
    }

    // Web paieška per DuckDuckGo
    try {
      const fetchPromise = fetch(
        `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&kp=-1&no_html=1`
      );
      
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), 5000)
      );
      
      const webResponse = await Promise.race([fetchPromise, timeoutPromise]);
      const webData = await webResponse.json();
      
      if (webData.Results && Array.isArray(webData.Results) && webData.Results.length > 0) {
        webData.Results.slice(0, 5).forEach(result => {
          if (result.FirstURL) {
            results.push({
              title: result.Result.substring(0, 100),
              description: result.Text.substring(0, 150) || 'Nėra aprašymo',
              url: result.FirstURL,
              isLocal: false
            });
          }
        });
      }
    } catch (e) {
      console.error('Web search error:', e.message);
    }

    // Jei nėra duomenų arba DuckDuckGo nepavyko, sugeneruoti pagalbines nuorodas
    if (results.length < 3) {
      const webSuggestions = [
        {
          title: `🌐 Google paieška: "${query}"`,
          description: 'Atidarykite Google paieško naujo skirtuko',
          url: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
          isLocal: false
        },
        {
          title: `🛒 eBay: "${query}"`,
          description: 'Raskite šią detalę eBay interneto parduotuvėje',
          url: `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(query)}`,
          isLocal: false
        },
        {
          title: `🚚 AliExpress: "${query}"`,
          description: 'Raskite šią detalę AliExpress su greita pristatymo opcion',
          url: `https://www.aliexpress.com/wholesale?SearchText=${encodeURIComponent(query)}`,
          isLocal: false
        },
        {
          title: `🔧 Amazon: "${query}"`,
          description: 'Paieškai Amazon plattformoje',
          url: `https://www.amazon.com/s?k=${encodeURIComponent(query)}`,
          isLocal: false
        }
      ];
      
      // Pridėti tik tuos kurie nėra dar jau pasirodę
      webSuggestions.forEach(suggestion => {
        if (!results.find(r => r.url === suggestion.url)) {
          results.push(suggestion);
        }
      });
    }
    
    res.json(results.length > 0 ? results : [
      {
        title: '🌐 Google paieška',
        description: `Ieškoti "${query}" Google`,
        url: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
        isLocal: false
      }
    ]);
  } catch (error) {
    console.error('Search error:', error);
    res.json([
      {
        title: '🌐 Google paieška',
        description: `Ieškoti "${query}" Google`,
        url: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
        isLocal: false
      }
    ]);
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
