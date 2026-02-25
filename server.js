const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const marked = require('marked');
const { kv } = require('@vercel/kv');

const app = express();
const DATA_DIR = path.join(__dirname, 'data');
const SECTIONS_FILE = path.join(DATA_DIR, 'sections.json');
const TODOS_FILE = path.join(DATA_DIR, 'todos.json');
const NOTES_FILE = path.join(DATA_DIR, 'notes.json');
const AI_INSIGHTS_FILE = path.join(DATA_DIR, 'ai-insights.json');
const MORNING_BRIEFS_FILE = path.join(DATA_DIR, 'morning-briefs.json');
const ASSISTANT_MEMORIES_FILE = path.join(DATA_DIR, 'assistant-memories.json');
const PORTFOLIO_FILE = path.join(DATA_DIR, 'portfolio.json');
const JR_TODOS_FILE = path.join(DATA_DIR, 'jr-todos.json');
const AFFIRMATIONS_FILE = path.join(DATA_DIR, 'affirmations.json');
const ONE_THING_FILE = path.join(DATA_DIR, 'one-thing.json');
const GRATITUDE_FILE = path.join(DATA_DIR, 'gratitude.json');
const FOCUS_FILE = path.join(DATA_DIR, 'focus.json');
const DASHBOARD_LAYOUT_FILE = path.join(DATA_DIR, 'dashboard-layout.json');
const PORT = process.env.PORT || 3000;

const DEFAULT_LAYOUT_ORDER = ['affirmation', 'overview', 'crypto', 'calendar', 'portfolio', 'productivity', 'daily-brief', 'todos-notes-insights', 'workflow', 'market-briefs'];

// CoinGecko ID mapping for portfolio
const COINGECKO_IDS = { btc: 'bitcoin', eth: 'ethereum', sol: 'solana', bnb: 'binancecoin', ada: 'cardano', xrp: 'ripple', doge: 'dogecoin', avax: 'avalanche-2', link: 'chainlink', dot: 'polkadot', matic: 'matic-network', ltc: 'litecoin', uni: 'uniswap', atom: 'cosmos', near: 'near', apt: 'aptos', arb: 'arbitrum', op: 'optimism', inj: 'injective-protocol', sui: 'sui', sei: 'sei-network', pepe: 'pepe', wif: 'dogwifhat', bonk: 'bonk', floki: 'floki' };

// Crypto price cache (refresh every 60s)
let cryptoPriceCache = { data: null, ts: 0 };
const CACHE_TTL = 60000;

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readJsonFile(filePath, defaultVal = []) {
  try {
    ensureDataDir();
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(defaultVal, null, 2));
      return defaultVal;
    }
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return Array.isArray(data) ? data : defaultVal;
  } catch (err) {
    console.error('Error reading', filePath, err.message);
    return defaultVal;
  }
}

function writeJsonFile(filePath, data) {
  ensureDataDir();
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// Middleware to parse form data
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Set up EJS as template engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Route for the main dashboard
app.get('/', async (req, res) => {
  try {
    const keys = await kv.keys('insight:*');
    const insights = [];
    for (const key of keys) {
      const data = await kv.get(key);
      if (!data) continue;
      try {
        // New KV format: fullContent stored as string (no metadata JSON)
        // Extract metadata from the content's headers (first lines starting with **Date:**, **Category:**)
        const lines = data.split('\n');
        let title = 'Untitled';
        let dateStr = '';
        let category = '';
        let contentStart = 0;
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (line.startsWith('# ')) {
            title = line.replace(/^#\s+/, '').trim();
          } else if (line.startsWith('**Date:**')) {
            dateStr = line.replace(/^\*\*Date:\*\*\s*/, '').trim();
          } else if (line.startsWith('**Category:**')) {
            category = line.replace(/^\*\*Category:\*\*\s*/, '').trim();
          } else if (line.trim() === '' && !dateStr) {
            // Skip empty lines before content
            continue;
          } else {
            contentStart = i;
            break;
          }
        }
        const content = lines.slice(contentStart).join('\n');
        const html = marked.parse(content);
        const slug = key.split(':')[1]; // e.g. "2026-02-24-daily-affirmation"
        const date = new Date(dateStr || key.split(':')[1].split('-')[0:3].join('-'));
        insights.push({
          filename: `${slug}.md`,
          title,
          date: date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
          content: html,
          excerpt: getExcerpt(content)
        });
      } catch (e) {
        console.error('Error parsing insight from KV:', e);
        continue;
      }
    }
    // Sort by date descending (extract date from filename or stored date)
    insights.sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      return dateB - dateA;
    });

    const sections = readSections();
    const todos = readJsonFile(TODOS_FILE, []);
    const stats = {
      insightsCount: insights.length,
      todosTotal: (todos && todos.length) || 0,
      todosDone: (todos && todos.filter(t => t && t.done).length) || 0,
      sectionsOngoing: (sections && sections.filter(s => s && s.status === 'ongoing').length) || 0,
      sectionsAccomplished: (sections && sections.filter(s => s && s.status === 'accomplished').length) || 0
    };

    res.render('index', { insights, stats });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).render('error', { message: err.message || 'Failed to load dashboard' });
  }
});

// Crypto prices API (CoinGecko - no key required)
app.get('/api/crypto-prices', async (req, res) => {
  try {
    const forceRefresh = req.query.refresh === '1';
    if (!forceRefresh && cryptoPriceCache.data && Date.now() - cryptoPriceCache.ts < CACHE_TTL) {
      return res.json(cryptoPriceCache.data);
    }
    const ids = 'bitcoin,ethereum,solana,binancecoin,cardano,ripple,dogecoin,avalanche-2,chainlink,polkadot';
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`;
    const resp = await fetch(url);
    const data = await resp.json();
    cryptoPriceCache = { data, ts: Date.now() };
    res.json(data);
  } catch (err) {
    console.error('Crypto prices error:', err);
    res.status(500).json({ error: 'Failed to fetch prices' });
  }
});

// Route for Assistant (tell assistant info to retain)
app.get('/assistant', (req, res) => {
  res.render('assistant');
});

// Route for Portfolio (crypto watchlist)
app.get('/portfolio', (req, res) => {
  res.render('portfolio');
});

// Route for adding new market brief (legacy - keep for form)
app.get('/add-insight', (req, res) => {
  res.render('add-insight');
});

// API endpoint to save new insight
app.post('/api/add-insight', async (req, res) => {
  try {
    const { title, date, category, content, notes } = req.body;
    const patterns = Array.isArray(req.body.patterns) ? req.body.patterns : (req.body.patterns ? [req.body.patterns] : []);
    
    const formattedDate = new Date(date).toISOString().split('T')[0];
    const slug = (title || 'insight').toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'insight';
    const key = `insight:${formattedDate}-${slug}`;
    
    let fullContent = `# ${title}\n\n`;
    fullContent += `**Date:** ${new Date(date).toLocaleDateString()}\n`;
    fullContent += `**Category:** ${category}\n\n`;
    if (patterns.length > 0) {
      fullContent += `## Patterns Observed\n`;
      patterns.forEach(pattern => {
        const patternLabels = {
          'narrative_hook': 'Clear narrative/hook',
          'high_volume': 'High volume-to-market-cap ratio',
          'community_active': 'Active community engagement',
          'cross_chain': 'Cross-chain connections',
          'established_team': 'Connection to established projects/teams',
          'utility_beyond_meme': 'Utility beyond pure meme',
          'compound_narrative': 'Combines multiple trending narratives'
        };
        fullContent += `- ✅ ${patternLabels[pattern] || pattern}\n`;
      });
      fullContent += `\n`;
    }
    fullContent += content;
    if (notes) {
      fullContent += `\n\n## Additional Notes\n${notes}`;
    }
    
    await kv.set(key, fullContent);
    
    res.redirect('/');
  } catch (error) {
    console.error('Error saving insight:', error);
    res.status(500).render('error', { message: 'Failed to save insight' });
  }
});\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'insight';
      
    const filename = `research-digest-${formattedDate}-${slug}.md`;
    
    // Create content with metadata
    let fullContent = `# ${title}\n\n`;
    fullContent += `**Date:** ${new Date(date).toLocaleDateString()}\n`;
    fullContent += `**Category:** ${category}\n\n`;
    
    if (patterns.length > 0) {
      fullContent += `## Patterns Observed\n`;
      patterns.forEach(pattern => {
        const patternLabels = {
          'narrative_hook': 'Clear narrative/hook',
          'high_volume': 'High volume-to-market-cap ratio',
          'community_active': 'Active community engagement',
          'cross_chain': 'Cross-chain connections',
          'established_team': 'Connection to established projects/teams',
          'utility_beyond_meme': 'Utility beyond pure meme',
          'compound_narrative': 'Combines multiple trending narratives'
        };
        fullContent += `- ✅ ${patternLabels[pattern] || pattern}\n`;
      });
      fullContent += `\n`;
    }
    
    fullContent += content;
    
    if (notes) {
      fullContent += `\n\n## Additional Notes\n${notes}`;
    }
    
    // Write the file to the insights directory
    const insightsDir = path.join(__dirname, 'insights');
    if (!fs.existsSync(insightsDir)) {
      fs.mkdirSync(insightsDir, { recursive: true });
    }
    
    const filePath = path.join(insightsDir, filename);
    fs.writeFileSync(filePath, fullContent);
    
    // Redirect back to dashboard
    res.redirect('/');
  } catch (error) {
    console.error('Error saving insight:', error);
    res.status(500).render('error', { message: 'Failed to save insight' });
  }
});

// Helper function to extract date from filename
function extractDate(filename) {
  // Look for YYYY-MM-DD pattern in filename
  const dateMatch = filename.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (dateMatch) {
    return new Date(`${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`);
  }
  // If no date found, use file modification time
  const filePath = path.join(__dirname, 'insights', filename);
  try {
    const stats = fs.statSync(filePath);
    return stats.mtime;
  } catch (err) {
    return new Date();
  }
}

// Helper function to get a readable date from filename
function extractReadableDate(filename) {
  const dateMatch = filename.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (dateMatch) {
    const [, year, month, day] = dateMatch;
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  }
  return filename.split('.')[0]; // Return filename without extension if no date found
}

// Helper function to get a short excerpt from content
function getExcerpt(content) {
  // Get the first 200 characters and add ...
  const cleanContent = content.replace(/[#*_-]/g, ''); // Remove markdown formatting
  return cleanContent.substring(0, 200) + '...';
}

// Route for viewing individual insight
app.get('/insight/:filename', async (req, res) => {
  try {
    const filename = decodeURIComponent(req.params.filename);
    const slug = filename.replace(/\.md$/, '');
    const key = `insight:${slug}`;
    const data = await kv.get(key);
    if (!data) {
      return res.status(404).render('error', { message: 'Insight not found' });
    }
    // data is the full markdown content string
    const lines = data.split('\n');
    let title = 'Untitled';
    let dateStr = '';
    let contentStart = 0;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.startsWith('# ')) {
        title = line.replace(/^#\s+/, '').trim();
      } else if (line.startsWith('**Date:**')) {
        dateStr = line.replace(/^\*\*Date:\*\*\s*/, '').trim();
      } else if (line.trim() === '' && !dateStr) {
        continue;
      } else {
        contentStart = i;
        break;
      }
    }
    const content = lines.slice(contentStart).join('\n');
    const html = marked.parse(content);
    const date = new Date(dateStr || slug.split('-')[0:3].join('-'));
    res.render('insight', {
      filename,
      title,
      date: date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
      content: html
    });
  } catch (err) {
    console.error('Insight view error:', err);
    res.status(500).render('error', { message: 'Failed to load insight' });
  }
});

// Sections API - read/write sections.json for workflow cards
function readSections() {
  return readJsonFile(SECTIONS_FILE, []);
}

function writeSections(sections) {
  writeJsonFile(SECTIONS_FILE, sections);
}

app.get('/api/sections', (req, res) => {
  try {
    const sections = readSections();
    res.json(sections.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)));
  } catch (err) {
    console.error('Error reading sections:', err);
    res.status(500).json({ error: 'Failed to read sections' });
  }
});

app.post('/api/sections', (req, res) => {
  try {
    const sections = readSections();
    const { title, description, type, status, color, notes } = req.body;
    const newSection = {
      id: crypto.randomUUID(),
      title: title || 'Untitled',
      description: description || '',
      type: type || 'workflow',
      status: status || 'planned',
      color: color || 'default',
      notes: notes || '',
      order: sections.length,
      createdAt: new Date().toISOString()
    };
    sections.push(newSection);
    writeSections(sections);
    res.json(newSection);
  } catch (err) {
    console.error('Error creating section:', err);
    res.status(500).json({ error: 'Failed to create section' });
  }
});

app.put('/api/sections/:id', (req, res) => {
  try {
    const sections = readSections();
    const idx = sections.findIndex(s => s.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Section not found' });
    const { title, description, type, status, color, order, notes } = req.body;
    if (title !== undefined) sections[idx].title = title;
    if (description !== undefined) sections[idx].description = description;
    if (type !== undefined) sections[idx].type = type;
    if (status !== undefined) sections[idx].status = status;
    if (color !== undefined) sections[idx].color = color;
    if (notes !== undefined) sections[idx].notes = notes;
    if (order !== undefined) sections[idx].order = order;
    writeSections(sections);
    res.json(sections[idx]);
  } catch (err) {
    console.error('Error updating section:', err);
    res.status(500).json({ error: 'Failed to update section' });
  }
});

app.delete('/api/sections/:id', (req, res) => {
  try {
    const sections = readSections();
    const filtered = sections.filter(s => s.id !== req.params.id);
    if (filtered.length === sections.length) return res.status(404).json({ error: 'Section not found' });
    writeSections(filtered);
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting section:', err);
    res.status(500).json({ error: 'Failed to delete section' });
  }
});

// Todos API - numeric priority: lower = more important (1 = highest)
function todoPriorityNum(p) {
  if (typeof p === 'number' && p >= 1 && p <= 10) return p;
  if (p === 'high') return 1;
  if (p === 'medium') return 5;
  if (p === 'low') return 10;
  return 5;
}
app.get('/api/todos', (req, res) => {
  try {
    const todos = readJsonFile(TODOS_FILE, [])
      .sort((a, b) => {
        const pa = todoPriorityNum(a.priority);
        const pb = todoPriorityNum(b.priority);
        if (pa !== pb) return pa - pb;
        return (a.order ?? 0) - (b.order ?? 0);
      });
    res.json(todos);
  } catch (err) {
    res.status(500).json({ error: 'Failed to read todos' });
  }
});

app.post('/api/todos', (req, res) => {
  try {
    const todos = readJsonFile(TODOS_FILE, []);
    const { text, dueDate, priority } = req.body;
    const p = typeof priority === 'number' ? Math.max(1, Math.min(10, priority)) : todoPriorityNum(priority);
    const todo = {
      id: crypto.randomUUID(),
      text: text || 'New task',
      done: false,
      dueDate: dueDate || null,
      priority: p,
      order: todos.length,
      createdAt: new Date().toISOString()
    };
    todos.push(todo);
    writeJsonFile(TODOS_FILE, todos);
    res.json(todo);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create todo' });
  }
});

app.put('/api/todos/reorder', (req, res) => {
  try {
    const { ids } = req.body; // array of todo ids in desired order
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'ids array required' });
    const todos = readJsonFile(TODOS_FILE, []);
    ids.forEach((id, i) => {
      const t = todos.find(x => x.id === id);
      if (t) t.order = i;
    });
    writeJsonFile(TODOS_FILE, todos);
    const sorted = readJsonFile(TODOS_FILE, []).sort((a, b) => {
      const pa = todoPriorityNum(a.priority);
      const pb = todoPriorityNum(b.priority);
      if (pa !== pb) return pa - pb;
      return (a.order ?? 0) - (b.order ?? 0);
    });
    res.json(sorted);
  } catch (err) {
    res.status(500).json({ error: 'Failed to reorder todos' });
  }
});

app.put('/api/todos/:id', (req, res) => {
  try {
    const todos = readJsonFile(TODOS_FILE, []);
    const idx = todos.findIndex(t => t.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Todo not found' });
    const { text, done, dueDate, priority, order } = req.body;
    if (text !== undefined) todos[idx].text = text;
    if (done !== undefined) todos[idx].done = done;
    if (dueDate !== undefined) todos[idx].dueDate = dueDate;
    if (priority !== undefined) todos[idx].priority = typeof priority === 'number' ? Math.max(1, Math.min(10, priority)) : todoPriorityNum(priority);
    if (order !== undefined) todos[idx].order = order;
    writeJsonFile(TODOS_FILE, todos);
    res.json(todos[idx]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update todo' });
  }
});

app.delete('/api/todos/:id', (req, res) => {
  try {
    const todos = readJsonFile(TODOS_FILE, []);
    const filtered = todos.filter(t => t.id !== req.params.id);
    if (filtered.length === todos.length) return res.status(404).json({ error: 'Todo not found' });
    writeJsonFile(TODOS_FILE, filtered);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete todo' });
  }
});

// Jr's Todos API (same structure as todos)
app.get('/api/jr-todos', (req, res) => {
  try {
    const todos = readJsonFile(JR_TODOS_FILE, [])
      .sort((a, b) => {
        const pa = todoPriorityNum(a.priority);
        const pb = todoPriorityNum(b.priority);
        if (pa !== pb) return pa - pb;
        return (a.order ?? 0) - (b.order ?? 0);
      });
    res.json(todos);
  } catch (err) {
    res.status(500).json({ error: 'Failed to read Jr todos' });
  }
});

app.post('/api/jr-todos', (req, res) => {
  try {
    const todos = readJsonFile(JR_TODOS_FILE, []);
    const { text, dueDate, priority } = req.body;
    const p = typeof priority === 'number' ? Math.max(1, Math.min(10, priority)) : todoPriorityNum(priority);
    const todo = {
      id: crypto.randomUUID(),
      text: text || 'New task',
      done: false,
      dueDate: dueDate || null,
      priority: p,
      order: todos.length,
      createdAt: new Date().toISOString()
    };
    todos.push(todo);
    writeJsonFile(JR_TODOS_FILE, todos);
    res.json(todo);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create Jr todo' });
  }
});

app.put('/api/jr-todos/reorder', (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'ids array required' });
    const todos = readJsonFile(JR_TODOS_FILE, []);
    ids.forEach((id, i) => {
      const t = todos.find(x => x.id === id);
      if (t) t.order = i;
    });
    writeJsonFile(JR_TODOS_FILE, todos);
    const sorted = readJsonFile(JR_TODOS_FILE, []).sort((a, b) => {
      const pa = todoPriorityNum(a.priority);
      const pb = todoPriorityNum(b.priority);
      if (pa !== pb) return pa - pb;
      return (a.order ?? 0) - (b.order ?? 0);
    });
    res.json(sorted);
  } catch (err) {
    res.status(500).json({ error: 'Failed to reorder Jr todos' });
  }
});

app.put('/api/jr-todos/:id', (req, res) => {
  try {
    const todos = readJsonFile(JR_TODOS_FILE, []);
    const idx = todos.findIndex(t => t.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Jr todo not found' });
    const { text, done, dueDate, priority, order } = req.body;
    if (text !== undefined) todos[idx].text = text;
    if (done !== undefined) todos[idx].done = done;
    if (dueDate !== undefined) todos[idx].dueDate = dueDate;
    if (priority !== undefined) todos[idx].priority = typeof priority === 'number' ? Math.max(1, Math.min(10, priority)) : todoPriorityNum(priority);
    if (order !== undefined) todos[idx].order = order;
    writeJsonFile(JR_TODOS_FILE, todos);
    res.json(todos[idx]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update Jr todo' });
  }
});

app.delete('/api/jr-todos/:id', (req, res) => {
  try {
    const todos = readJsonFile(JR_TODOS_FILE, []);
    const filtered = todos.filter(t => t.id !== req.params.id);
    if (filtered.length === todos.length) return res.status(404).json({ error: 'Jr todo not found' });
    writeJsonFile(JR_TODOS_FILE, filtered);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete Jr todo' });
  }
});

// Affirmations API
app.get('/api/affirmations', (req, res) => {
  try {
    const items = readJsonFile(AFFIRMATIONS_FILE, []).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const today = new Date().toISOString().split('T')[0];
    const todayAff = items.find(a => (a.date || '').startsWith(today)) || items[0];
    res.json({ list: items, today: todayAff || null });
  } catch (err) {
    res.status(500).json({ error: 'Failed to read affirmations' });
  }
});

app.post('/api/affirmations', (req, res) => {
  try {
    const items = readJsonFile(AFFIRMATIONS_FILE, []);
    const { text } = req.body;
    const today = new Date().toISOString().split('T')[0];
    const existing = items.findIndex(a => (a.date || '').startsWith(today));
    const aff = { id: crypto.randomUUID(), text: text || '', date: today, createdAt: new Date().toISOString() };
    if (existing >= 0) items[existing] = aff;
    else items.unshift(aff);
    writeJsonFile(AFFIRMATIONS_FILE, items);
    res.json(aff);
  } catch (err) {
    res.status(500).json({ error: 'Failed to save affirmation' });
  }
});

app.put('/api/affirmations/:id', (req, res) => {
  try {
    const items = readJsonFile(AFFIRMATIONS_FILE, []);
    const idx = items.findIndex(a => a.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Not found' });
    const { text } = req.body;
    if (text !== undefined) items[idx].text = text;
    items[idx].updatedAt = new Date().toISOString();
    writeJsonFile(AFFIRMATIONS_FILE, items);
    res.json(items[idx]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update affirmation' });
  }
});

app.delete('/api/affirmations/:id', (req, res) => {
  try {
    const items = readJsonFile(AFFIRMATIONS_FILE, []);
    const filtered = items.filter(a => a.id !== req.params.id);
    if (filtered.length === items.length) return res.status(404).json({ error: 'Not found' });
    writeJsonFile(AFFIRMATIONS_FILE, filtered);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete affirmation' });
  }
});

// One Thing API (today's most important task)
app.get('/api/one-thing', (req, res) => {
  try {
    const data = readJsonFile(ONE_THING_FILE, {});
    const today = new Date().toISOString().split('T')[0];
    res.json({ text: (data.date === today ? data.text : '') || '', date: today });
  } catch (err) {
    res.status(500).json({ error: 'Failed to read' });
  }
});

app.post('/api/one-thing', (req, res) => {
  try {
    const { text } = req.body;
    const today = new Date().toISOString().split('T')[0];
    const data = { date: today, text: text || '' };
    writeJsonFile(ONE_THING_FILE, data);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to save' });
  }
});

// Gratitude API (3 things)
app.get('/api/gratitude', (req, res) => {
  try {
    const data = readJsonFile(GRATITUDE_FILE, {});
    const today = new Date().toISOString().split('T')[0];
    const items = data.date === today ? (data.items || []) : [];
    res.json({ date: today, items: Array.isArray(items) ? items : [] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to read' });
  }
});

app.post('/api/gratitude', (req, res) => {
  try {
    const { items } = req.body;
    const today = new Date().toISOString().split('T')[0];
    const arr = Array.isArray(items) ? items.slice(0, 3).map(s => String(s || '')) : [];
    const data = { date: today, items: arr };
    writeJsonFile(GRATITUDE_FILE, data);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to save' });
  }
});

// Focus/Intention API
app.get('/api/focus', (req, res) => {
  try {
    const data = readJsonFile(FOCUS_FILE, {});
    const today = new Date().toISOString().split('T')[0];
    res.json({ text: (data.date === today ? data.text : '') || '', date: today });
  } catch (err) {
    res.status(500).json({ error: 'Failed to read' });
  }
});

app.post('/api/focus', (req, res) => {
  try {
    const { text } = req.body;
    const today = new Date().toISOString().split('T')[0];
    const data = { date: today, text: text || '' };
    writeJsonFile(FOCUS_FILE, data);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to save' });
  }
});

// Notes API
app.get('/api/notes', (req, res) => {
  try {
    const notes = readJsonFile(NOTES_FILE, []).sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
    res.json(notes);
  } catch (err) {
    res.status(500).json({ error: 'Failed to read notes' });
  }
});

app.post('/api/notes', (req, res) => {
  try {
    const notes = readJsonFile(NOTES_FILE, []);
    const { title, content } = req.body;
    const note = {
      id: crypto.randomUUID(),
      title: title || 'Untitled Note',
      content: content || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    notes.push(note);
    writeJsonFile(NOTES_FILE, notes);
    res.json(note);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create note' });
  }
});

app.put('/api/notes/:id', (req, res) => {
  try {
    const notes = readJsonFile(NOTES_FILE, []);
    const idx = notes.findIndex(n => n.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Note not found' });
    const { title, content } = req.body;
    if (title !== undefined) notes[idx].title = title;
    if (content !== undefined) notes[idx].content = content;
    notes[idx].updatedAt = new Date().toISOString();
    writeJsonFile(NOTES_FILE, notes);
    res.json(notes[idx]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update note' });
  }
});

app.delete('/api/notes/:id', (req, res) => {
  try {
    const notes = readJsonFile(NOTES_FILE, []);
    const filtered = notes.filter(n => n.id !== req.params.id);
    if (filtered.length === notes.length) return res.status(404).json({ error: 'Note not found' });
    writeJsonFile(NOTES_FILE, filtered);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete note' });
  }
});

// AI Insights API (notes from AI agent - user can add manually or integrate later)
app.get('/api/ai-insights', (req, res) => {
  try {
    const insights = readJsonFile(AI_INSIGHTS_FILE, []).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(insights);
  } catch (err) {
    res.status(500).json({ error: 'Failed to read AI insights' });
  }
});

app.post('/api/ai-insights', (req, res) => {
  try {
    const insights = readJsonFile(AI_INSIGHTS_FILE, []);
    const { title, content, source } = req.body;
    const insight = {
      id: crypto.randomUUID(),
      title: title || 'AI Insight',
      content: content || '',
      source: source || 'manual',
      createdAt: new Date().toISOString()
    };
    insights.push(insight);
    writeJsonFile(AI_INSIGHTS_FILE, insights);
    res.json(insight);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create AI insight' });
  }
});

app.delete('/api/ai-insights/:id', (req, res) => {
  try {
    const insights = readJsonFile(AI_INSIGHTS_FILE, []);
    const filtered = insights.filter(i => i.id !== req.params.id);
    if (filtered.length === insights.length) return res.status(404).json({ error: 'AI insight not found' });
    writeJsonFile(AI_INSIGHTS_FILE, filtered);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete AI insight' });
  }
});

// Assistant memories API (info user tells assistant to retain)
app.get('/api/assistant-memories', (req, res) => {
  try {
    const memories = readJsonFile(ASSISTANT_MEMORIES_FILE, []).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(memories);
  } catch (err) {
    res.status(500).json({ error: 'Failed to read memories' });
  }
});

app.post('/api/assistant-memories', (req, res) => {
  try {
    const memories = readJsonFile(ASSISTANT_MEMORIES_FILE, []);
    const { content } = req.body;
    const memory = {
      id: crypto.randomUUID(),
      content: content || '',
      createdAt: new Date().toISOString()
    };
    memories.push(memory);
    writeJsonFile(ASSISTANT_MEMORIES_FILE, memories);
    res.json(memory);
  } catch (err) {
    res.status(500).json({ error: 'Failed to save memory' });
  }
});

app.delete('/api/assistant-memories/:id', (req, res) => {
  try {
    const memories = readJsonFile(ASSISTANT_MEMORIES_FILE, []);
    const filtered = memories.filter(m => m.id !== req.params.id);
    if (filtered.length === memories.length) return res.status(404).json({ error: 'Memory not found' });
    writeJsonFile(ASSISTANT_MEMORIES_FILE, filtered);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete memory' });
  }
});

// Morning Briefs API (from agent Jr)
app.get('/api/morning-briefs', (req, res) => {
  try {
    const briefs = readJsonFile(MORNING_BRIEFS_FILE, []).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(briefs);
  } catch (err) {
    res.status(500).json({ error: 'Failed to read morning briefs' });
  }
});

app.post('/api/morning-briefs', (req, res) => {
  try {
    const briefs = readJsonFile(MORNING_BRIEFS_FILE, []);
    const { title, content } = req.body;
    const brief = {
      id: crypto.randomUUID(),
      title: title || 'Morning Brief',
      content: content || '',
      source: 'Jr',
      createdAt: new Date().toISOString()
    };
    briefs.push(brief);
    writeJsonFile(MORNING_BRIEFS_FILE, briefs);
    res.json(brief);
  } catch (err) {
    res.status(500).json({ error: 'Failed to save morning brief' });
  }
});

// Portfolio API (crypto watchlist)
app.get('/api/dashboard-layout', (req, res) => {
  try {
    const data = readJsonFile(DASHBOARD_LAYOUT_FILE, {});
    const order = Array.isArray(data.order) ? data.order : DEFAULT_LAYOUT_ORDER;
    const sizes = data.sizes && typeof data.sizes === 'object' ? data.sizes : {};
    res.json({ order, sizes });
  } catch (err) {
    res.status(500).json({ error: 'Failed to read layout' });
  }
});

app.put('/api/dashboard-layout', (req, res) => {
  try {
    const { order, sizes } = req.body;
    if (!Array.isArray(order) || order.length === 0) return res.status(400).json({ error: 'order array required' });
    const data = { order };
    if (sizes && typeof sizes === 'object') data.sizes = sizes;
    writeJsonFile(DASHBOARD_LAYOUT_FILE, data);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to save layout' });
  }
});

app.get('/api/portfolio', (req, res) => {
  try {
    const items = readJsonFile(PORTFOLIO_FILE, []);
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: 'Failed to read portfolio' });
  }
});

app.post('/api/portfolio', async (req, res) => {
  try {
    const items = readJsonFile(PORTFOLIO_FILE, []);
    const { symbol } = req.body;
    const sym = (symbol || '').toLowerCase().trim();
    const coingeckoId = COINGECKO_IDS[sym];
    if (!coingeckoId) {
      return res.status(400).json({ error: 'Unknown symbol. Try: BTC, ETH, SOL, BNB, ADA, XRP, DOGE, AVAX, LINK, DOT, MATIC, LTC, UNI, ATOM, NEAR, APT, ARB, OP, SUI, SEI, PEPE, BONK, FLOKI' });
    }
    if (items.some(i => i.coingeckoId === coingeckoId)) {
      return res.status(400).json({ error: 'Already in watchlist' });
    }
    const names = { bitcoin: 'Bitcoin', ethereum: 'Ethereum', solana: 'Solana', binancecoin: 'BNB', cardano: 'Cardano', ripple: 'XRP', dogecoin: 'Dogecoin', 'avalanche-2': 'Avalanche', chainlink: 'Chainlink', polkadot: 'Polkadot', 'matic-network': 'Polygon', litecoin: 'Litecoin', uniswap: 'Uniswap', cosmos: 'Cosmos', near: 'NEAR', aptos: 'Aptos', arbitrum: 'Arbitrum', optimism: 'Optimism', 'injective-protocol': 'Injective', sui: 'Sui', 'sei-network': 'Sei', pepe: 'Pepe', dogwifhat: 'dogwifhat', bonk: 'Bonk', floki: 'Floki' };
    const item = { id: crypto.randomUUID(), symbol: sym.toUpperCase(), coingeckoId, name: names[coingeckoId] || sym.toUpperCase(), addedAt: new Date().toISOString() };
    items.push(item);
    writeJsonFile(PORTFOLIO_FILE, items);
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: 'Failed to add to portfolio' });
  }
});

app.delete('/api/portfolio/:id', (req, res) => {
  try {
    const items = readJsonFile(PORTFOLIO_FILE, []);
    const filtered = items.filter(i => i.id !== req.params.id);
    if (filtered.length === items.length) return res.status(404).json({ error: 'Not found' });
    writeJsonFile(PORTFOLIO_FILE, filtered);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove from portfolio' });
  }
});

app.get('/api/portfolio-prices', async (req, res) => {
  try {
    const items = readJsonFile(PORTFOLIO_FILE, []);
    if (items.length === 0) return res.json({});
    const ids = [...new Set(items.map(i => i.coingeckoId))].join(',');
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`;
    const resp = await fetch(url);
    const data = await resp.json();
    res.json(data);
  } catch (err) {
    console.error('Portfolio prices error:', err);
    res.status(500).json({ error: 'Failed to fetch prices' });
  }
});

// Vercel compatibility: export handler for serverless functions (only when vercel is available)
module.exports = app;
try {
  module.exports.handler = require('vercel/node')(app);
} catch (err) {
  // vercel not installed - fine for local development
}

if (require.main === module) {
  const HOST = process.env.HOST || '0.0.0.0'; // Listen on all interfaces so other devices (e.g. OpenClaw) can reach it
  function startServer(port) {
    const server = app.listen(port, HOST, () => {
      console.log(`Market Insights Dashboard running on http://localhost:${port}`);
      if (HOST === '0.0.0.0') console.log(`  Also reachable on your network at http://<this-machine-ip>:${port}`);
      console.log(`Created by Jr (Junior) for Jay`);
    });
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.log(`Port ${port} in use, trying ${port + 1}...`);
        startServer(port + 1);
      } else {
        throw err;
      }
    });
  }
  startServer(PORT);
}

// Add a new affirmation for today
(async () => {
  try {
    const key = `affirmation:2026-02-25`;
    const existing = await kv.get(key);
    if (!existing) {
      const affirmation = `I am aligned with abundance. Every decision I make creates value, and every insight I gain moves me closer to my goals.`;
      await kv.set(key, affirmation);
    }
  } catch (err) {
    console.log('Affirmation setup skipped:', err.message);
  }
})();
}