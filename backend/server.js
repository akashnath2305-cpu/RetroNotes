const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const db = require('./db');
const gemini = require('./gemini');
require('dotenv').config();

const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_skeumorphic_key';

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Initialize Database Schema on start
db.initDb();

// Authentication Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// UUID Validation Middleware
const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const validateUuidParam = (paramName) => (req, res, next, val) => {
  if (!uuidRegex.test(val)) {
    return res.status(400).json({ error: `Invalid ${paramName} format` });
  }
  next();
};

app.param('id', validateUuidParam('id'));
app.param('highlightId', validateUuidParam('highlightId'));
app.param('sideNoteId', validateUuidParam('sideNoteId'));

// ==========================================
// AUTH ENDPOINTS
// ==========================================

app.get("/", (req, res) => {
  res.send("Notes App Backend");
});

app.post('/api/auth/register', async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Username, email and password are required' });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const result = await db.query(
      'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id, username, email',
      [username, email, passwordHash]
    );

    const user = result.rows[0];
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({ user, token });
  } catch (error) {
    console.error('Registration error:', error);
    if (error.code === '23505') {
      res.status(400).json({ error: 'Email already registered' });
    } else {
      res.status(500).json({ error: 'Server registration error' });
    }
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      user: { id: user.id, username: user.username, email: user.email },
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server login error' });
  }
});



// ==========================================
// NOTEBOOKS ENDPOINTS
// ==========================================

// Get all notebooks for user
app.get('/api/notebooks', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, subject, cover_color, created_at FROM notebooks WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Fetch notebooks error:', error);
    res.status(500).json({ error: 'Error fetching notebooks' });
  }
});

// Create notebook
app.post('/api/notebooks', authenticateToken, async (req, res) => {
  const { subject, cover_color } = req.body;
  if (!subject) {
    return res.status(400).json({ error: 'Subject is required' });
  }

  try {
    const result = await db.query(
      'INSERT INTO notebooks (user_id, subject, cover_color) VALUES ($1, $2, $3) RETURNING *',
      [req.user.id, subject, cover_color || '#3d5afe']
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create notebook error:', error);
    res.status(500).json({ error: 'Error creating notebook' });
  }
});

// Update notebook cover (subject / color)
app.put('/api/notebooks/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { subject, cover_color } = req.body;

  if (!subject) {
    return res.status(400).json({ error: 'Subject is required' });
  }

  try {
    const result = await db.query(
      'UPDATE notebooks SET subject = $1, cover_color = $2 WHERE id = $3 AND user_id = $4 RETURNING *',
      [subject, cover_color, id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Notebook not found or unauthorized' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update notebook error:', error);
    res.status(500).json({ error: 'Error updating notebook' });
  }
});

// Delete notebook
app.delete('/api/notebooks/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    const result = await db.query(
      'DELETE FROM notebooks WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Notebook not found or unauthorized' });
    }

    res.json({ message: 'Notebook deleted successfully', id });
  } catch (error) {
    console.error('Delete notebook error:', error);
    res.status(500).json({ error: 'Error deleting notebook' });
  }
});

// Rename Chapter (bulk update notes in a notebook)
app.put('/api/notebooks/:id/chapters', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { oldChapterName, newChapterName } = req.body;

  if (!oldChapterName || !newChapterName) {
    return res.status(400).json({ error: 'oldChapterName and newChapterName are required' });
  }

  try {
    let result;
    if (oldChapterName === 'Uncategorized') {
      result = await db.query(
        "UPDATE notes SET chapter = $1 WHERE notebook_id = $2 AND (chapter = $3 OR chapter IS NULL OR chapter = '') AND user_id = $4 RETURNING id",
        [newChapterName, id, oldChapterName, req.user.id]
      );
    } else {
      result = await db.query(
        'UPDATE notes SET chapter = $1 WHERE notebook_id = $2 AND chapter = $3 AND user_id = $4 RETURNING id',
        [newChapterName, id, oldChapterName, req.user.id]
      );
    }

    res.json({ message: 'Chapter renamed successfully', updatedCount: result.rowCount });
  } catch (error) {
    console.error('Rename chapter error:', error);
    res.status(500).json({ error: 'Error renaming chapter' });
  }
});

// ==========================================
// NOTES (DIARY PAGES) ENDPOINTS
// ==========================================

// Get all pages for a specific notebook
app.get('/api/notes', authenticateToken, async (req, res) => {
  const { notebook_id } = req.query;

  if (!notebook_id) {
    return res.status(400).json({ error: 'notebook_id query parameter is required' });
  }

  try {
    const result = await db.query(
      'SELECT id, notebook_id, title, content, chapter, page_marker_color, page_number, drawing_data, created_at, updated_at FROM notes WHERE user_id = $1 AND notebook_id = $2 ORDER BY chapter ASC, page_number ASC, created_at ASC',
      [req.user.id, notebook_id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Fetch notes error:', error);
    res.status(500).json({ error: 'Error fetching pages' });
  }
});

// Get detailed page (with highlights and side-notes)
app.get('/api/notes/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    // 1. Fetch note
    const noteResult = await db.query(
      'SELECT * FROM notes WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );

    if (noteResult.rows.length === 0) {
      return res.status(404).json({ error: 'Page not found' });
    }
    const note = noteResult.rows[0];

    // 2. Fetch highlights
    const highlightsResult = await db.query(
      'SELECT * FROM highlights WHERE note_id = $1',
      [id]
    );

    // 3. Fetch side notes
    const sideNotesResult = await db.query(
      'SELECT * FROM side_notes WHERE note_id = $1',
      [id]
    );

    res.json({
      ...note,
      highlights: highlightsResult.rows,
      sideNotes: sideNotesResult.rows
    });
  } catch (error) {
    console.error('Fetch note detail error:', error);
    res.status(500).json({ error: 'Error fetching page details' });
  }
});

// Create page inside a notebook
app.post('/api/notes', authenticateToken, async (req, res) => {
  const { notebook_id, title, content, chapter, page_marker_color, prompt } = req.body;

  if (!notebook_id) {
    return res.status(400).json({ error: 'notebook_id is required to create a page' });
  }

  try {
    // Check notebook ownership
    const notebookCheck = await db.query('SELECT id FROM notebooks WHERE id = $1 AND user_id = $2', [notebook_id, req.user.id]);
    if (notebookCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Notebook not found or unauthorized' });
    }

    let noteTitle = title || 'Untitled Page';
    let noteContent = content || '';

    if (prompt) {
      // Generate using Gemini
      const aiNote = await gemini.generateNoteFromPrompt(prompt);
      noteTitle = aiNote.title || noteTitle;
      noteContent = aiNote.content || noteContent;
    }

    // Auto-calculate next page_number in this notebook
    const pageNumResult = await db.query(
      'SELECT COALESCE(MAX(page_number), 0) + 1 AS next_page FROM notes WHERE notebook_id = $1',
      [notebook_id]
    );
    const nextPageNumber = pageNumResult.rows[0].next_page;

    const result = await db.query(
      'INSERT INTO notes (user_id, notebook_id, title, content, chapter, page_marker_color, page_number) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [req.user.id, notebook_id, noteTitle, noteContent, chapter || 'Uncategorized', page_marker_color || 'yellow', nextPageNumber]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create note error:', error);
    res.status(500).json({ error: 'Error creating page' });
  }
});

// Import document and generate notes automatically for every chapter
app.post('/api/notes/import-doc', authenticateToken, upload.single('file'), async (req, res) => {
  const { notebook_id } = req.body;
  const file = req.file;

  if (!notebook_id) {
    return res.status(400).json({ error: 'notebook_id is required' });
  }
  if (!file) {
    return res.status(400).json({ error: 'File uploader requires a valid document file' });
  }

  try {
    // Check notebook ownership
    const notebookCheck = await db.query('SELECT id FROM notebooks WHERE id = $1 AND user_id = $2', [notebook_id, req.user.id]);
    if (notebookCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Notebook not found or unauthorized' });
    }

    // Extract text content based on file type
    let documentText = '';
    const fileExtension = file.originalname.split('.').pop().toLowerCase();

    if (fileExtension === 'pdf') {
      try {
        documentText = await gemini.extractTextFromDocument(file.mimetype, file.buffer);
      } catch (geminiPdfErr) {
        console.error('Gemini PDF extraction failed:', geminiPdfErr);
        return res.status(400).json({ error: 'Failed to extract text from PDF file' });
      }
    } else if (fileExtension === 'docx') {
      try {
        const result = await mammoth.extractRawText({ buffer: file.buffer });
        documentText = result.value;
      } catch (docxErr) {
        console.error('DOCX parsing failed:', docxErr);
        return res.status(400).json({ error: 'Failed to extract text from DOCX file' });
      }
    } else if (fileExtension === 'txt' || fileExtension === 'md') {
      documentText = file.buffer.toString('utf8');
    } else if (['png', 'jpg', 'jpeg', 'webp'].includes(fileExtension)) {
      try {
        documentText = await gemini.extractTextFromDocument(file.mimetype, file.buffer);
      } catch (imgErr) {
        console.error('Image OCR failed:', imgErr);
        return res.status(400).json({ error: 'Failed to extract text from image file' });
      }
    } else {
      return res.status(400).json({ error: 'Unsupported file format. Please upload PDF, DOCX, TXT, MD, or an image (PNG, JPG, WEBP)' });
    }

    if (!documentText || documentText.trim().length === 0) {
      return res.status(400).json({ error: 'Document appears to be empty or unreadable' });
    }

    // Split text into chapters
    const chapters = gemini.splitDocumentIntoChapters(documentText);
    if (chapters.length === 0) {
      return res.status(400).json({ error: 'Failed to analyze chapter structures in the file' });
    }

    const createdNotes = [];
    
    // Get starting page number
    const pageNumResult = await db.query(
      'SELECT COALESCE(MAX(page_number), 0) AS max_page FROM notes WHERE notebook_id = $1',
      [notebook_id]
    );
    let pageCounter = pageNumResult.rows[0].max_page;

    for (let i = 0; i < chapters.length; i++) {
      const chapter = chapters[i];
      pageCounter++;

      // Generate notes via Gemini
      const aiNote = await gemini.generateNotesFromBookText(chapter.content, chapter.title);
      const noteTitle = aiNote.title || `Chapter ${i + 1}`;
      const noteContent = aiNote.content || '';

      const insertResult = await db.query(
        'INSERT INTO notes (user_id, notebook_id, title, content, chapter, page_marker_color, page_number) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
        [req.user.id, notebook_id, noteTitle, noteContent, 'Imported Document', 'yellow', pageCounter]
      );
      
      createdNotes.push({
        ...insertResult.rows[0],
        highlights: [],
        sideNotes: []
      });

      // Avoid hitting Gemini API rate limits (15 requests/minute on free tier)
      if (i < chapters.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 4000));
      }
    }

    res.status(201).json({
      message: `Successfully imported document and generated notes for ${chapters.length} chapters`,
      notes: createdNotes
    });
  } catch (err) {
    console.error('Import document error:', err);
    res.status(500).json({ error: 'Failed to import document and generate notes' });
  }
});

// Update page (title, content, chapter, page_marker_color, drawing_data)
app.put('/api/notes/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { title, content, chapter, page_marker_color, drawing_data } = req.body;

  try {
    const result = await db.query(
      'UPDATE notes SET title = $1, content = $2, chapter = COALESCE($3, chapter), page_marker_color = COALESCE($4, page_marker_color), drawing_data = COALESCE($5, drawing_data), updated_at = CURRENT_TIMESTAMP WHERE id = $6 AND user_id = $7 RETURNING *',
      [title, content, chapter, page_marker_color, drawing_data, id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Page not found or unauthorized' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update note error:', error);
    res.status(500).json({ error: 'Error updating page' });
  }
});

// Delete note
app.delete('/api/notes/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    const result = await db.query(
      'DELETE FROM notes WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Note not found or unauthorized' });
    }

    res.json({ message: 'Note deleted successfully', id });
  } catch (error) {
    console.error('Delete note error:', error);
    res.status(500).json({ error: 'Error deleting note' });
  }
});

// ==========================================
// HIGHLIGHTS & SIDE NOTES ENDPOINTS
// ==========================================

// Add highlight to a note
app.post('/api/notes/:id/highlights', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { start_index, end_index, color, text } = req.body;

  try {
    // Check note ownership
    const noteResult = await db.query('SELECT id FROM notes WHERE id = $1 AND user_id = $2', [id, req.user.id]);
    if (noteResult.rows.length === 0) {
      return res.status(404).json({ error: 'Note not found' });
    }

    // Delete overlapping highlights so the new highlight overrides them
    await db.query(
      'DELETE FROM highlights WHERE note_id = $1 AND start_index < $3 AND end_index > $2',
      [id, start_index, end_index]
    );

    const result = await db.query(
      'INSERT INTO highlights (note_id, start_index, end_index, color, text) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [id, start_index, end_index, color, text]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create highlight error:', error);
    res.status(500).json({ error: 'Error highlighting text' });
  }
});

// Delete a highlight
app.delete('/api/notes/:id/highlights/:highlightId', authenticateToken, async (req, res) => {
  const { id, highlightId } = req.params;

  try {
    // Verify note is owned by user
    const noteResult = await db.query('SELECT id FROM notes WHERE id = $1 AND user_id = $2', [id, req.user.id]);
    if (noteResult.rows.length === 0) {
      return res.status(404).json({ error: 'Note not found' });
    }

    await db.query('DELETE FROM highlights WHERE id = $1 AND note_id = $2', [highlightId, id]);
    res.json({ message: 'Highlight removed successfully', highlightId });
  } catch (error) {
    console.error('Delete highlight error:', error);
    res.status(500).json({ error: 'Error deleting highlight' });
  }
});

// Add side note to a note
app.post('/api/notes/:id/sidenotes', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { highlight_id, content, position_y } = req.body;

  try {
    // Check note ownership
    const noteResult = await db.query('SELECT id FROM notes WHERE id = $1 AND user_id = $2', [id, req.user.id]);
    if (noteResult.rows.length === 0) {
      return res.status(404).json({ error: 'Note not found' });
    }

    const roundedY = position_y !== undefined ? Math.round(parseFloat(position_y)) : 0;
    const result = await db.query(
      'INSERT INTO side_notes (note_id, highlight_id, content, position_y) VALUES ($1, $2, $3, $4) RETURNING *',
      [id, highlight_id || null, content, roundedY]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create side note error:', error);
    res.status(500).json({ error: 'Error adding side note' });
  }
});

// Delete a side note
app.delete('/api/notes/:id/sidenotes/:sideNoteId', authenticateToken, async (req, res) => {
  const { id, sideNoteId } = req.params;

  try {
    // Verify note is owned by user
    const noteResult = await db.query('SELECT id FROM notes WHERE id = $1 AND user_id = $2', [id, req.user.id]);
    if (noteResult.rows.length === 0) {
      return res.status(404).json({ error: 'Note not found' });
    }

    await db.query('DELETE FROM side_notes WHERE id = $1 AND note_id = $2', [sideNoteId, id]);
    res.json({ message: 'Side note removed successfully', sideNoteId });
  } catch (error) {
    console.error('Delete side note error:', error);
    res.status(500).json({ error: 'Error deleting side note' });
  }
});

// ==========================================
// STICKY NOTES ENDPOINTS
// ==========================================

// Get all stickies (supports filtering by note_id)
app.get('/api/stickies', authenticateToken, async (req, res) => {
  const { note_id } = req.query;
  try {
    let query = 'SELECT * FROM sticky_notes WHERE user_id = $1';
    const params = [req.user.id];

    if (note_id) {
      query += ' AND note_id = $2';
      params.push(note_id);
    } else {
      query += ' AND note_id IS NULL';
    }

    query += ' ORDER BY created_at DESC';
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Fetch stickies error:', error);
    res.status(500).json({ error: 'Error fetching stickies' });
  }
});

// Create sticky note
app.post('/api/stickies', authenticateToken, async (req, res) => {
  const { content, color, note_id, type } = req.body;
  if (!content) {
    return res.status(400).json({ error: 'Content is required' });
  }

  try {
    const result = await db.query(
      'INSERT INTO sticky_notes (user_id, content, color, note_id, type) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [req.user.id, content, color || '#FFE57F', note_id || null, type || 'manual']
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create sticky error:', error);
    res.status(500).json({ error: 'Error creating sticky note' });
  }
});

// Generate and add AI stickies (mnemonics/summaries) from note text
app.post('/api/stickies/ai', authenticateToken, async (req, res) => {
  const { text, type, note_id } = req.body; // type is 'mnemonic', 'summary', or 'short'

  if (!text) {
    return res.status(400).json({ error: 'Text content is required to generate stickies' });
  }

  try {
    const aiResponse = await gemini.generateMnemonicsOrShortNotes(text, type);
    const stickies = [];

    // Save each generated sticky to DB
    for (const item of aiResponse.items) {
      const result = await db.query(
        'INSERT INTO sticky_notes (user_id, content, color, note_id, type) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [req.user.id, item.content, item.color, note_id || null, type]
      );
      stickies.push(result.rows[0]);
    }

    res.status(201).json(stickies);
  } catch (error) {
    console.error('AI sticky notes error:', error);
    res.status(500).json({ error: 'Error generating sticky notes using AI' });
  }
});

// Delete sticky note
app.delete('/api/stickies/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    const result = await db.query(
      'DELETE FROM sticky_notes WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Sticky note not found or unauthorized' });
    }

    res.json({ message: 'Sticky note deleted successfully', id });
  } catch (error) {
    console.error('Delete sticky error:', error);
    res.status(500).json({ error: 'Error deleting sticky note' });
  }
});

// ==========================================
// AI TEXT ANALYZER & COMIC VISUALIZER ENDPOINTS
// ==========================================

// Explain/Analyze selected text
app.post('/api/ai/analyze', authenticateToken, async (req, res) => {
  const { selectedText, contextText } = req.body;

  if (!selectedText) {
    return res.status(400).json({ error: 'Selected text is required' });
  }

  try {
    const explanation = await gemini.explainOrAnalyzeText(selectedText, contextText || '');
    res.json({ explanation });
  } catch (error) {
    console.error('Text analysis error:', error);
    res.status(500).json({ error: 'Error analyzing text' });
  }
});

// Get note's comic layout
app.get('/api/notes/:id/comic', authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    // Check note ownership
    const noteResult = await db.query('SELECT id FROM notes WHERE id = $1 AND user_id = $2', [id, req.user.id]);
    if (noteResult.rows.length === 0) {
      return res.status(404).json({ error: 'Note not found' });
    }

    const result = await db.query('SELECT * FROM comics WHERE note_id = $1 ORDER BY created_at DESC LIMIT 1', [id]);

    if (result.rows.length === 0) {
      return res.json(null);
    }

    const comic = result.rows[0];
    res.json({
      id: comic.id,
      note_id: comic.note_id,
      panels: JSON.parse(comic.panels_json),
      created_at: comic.created_at
    });
  } catch (error) {
    console.error('Get comic error:', error);
    res.status(500).json({ error: 'Error retrieving comic visualization' });
  }
});

// Generate and save note's comic layout
app.post('/api/notes/:id/comic', authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    // Fetch and check note ownership
    const noteResult = await db.query('SELECT id, title, content FROM notes WHERE id = $1 AND user_id = $2', [id, req.user.id]);
    if (noteResult.rows.length === 0) {
      return res.status(404).json({ error: 'Note not found' });
    }

    const note = noteResult.rows[0];
    const comicData = await gemini.generateComicStrip(note.title, note.content);

    const panelsJson = JSON.stringify(comicData.panels);

    // Save to database, replacing previous comic if it exists
    await db.query('DELETE FROM comics WHERE note_id = $1', [id]);
    const result = await db.query(
      'INSERT INTO comics (note_id, panels_json) VALUES ($1, $2) RETURNING *',
      [id, panelsJson]
    );

    res.status(201).json({
      id: result.rows[0].id,
      note_id: result.rows[0].note_id,
      panels: comicData.panels,
      created_at: result.rows[0].created_at
    });
  } catch (error) {
    console.error('Generate comic error:', error);
    res.status(500).json({ error: 'Error generating comic visualization' });
  }
});

// Get note's quiz
app.get('/api/notes/:id/quiz', authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    // Check note ownership
    const noteResult = await db.query('SELECT id FROM notes WHERE id = $1 AND user_id = $2', [id, req.user.id]);
    if (noteResult.rows.length === 0) {
      return res.status(404).json({ error: 'Note not found' });
    }

    const result = await db.query('SELECT * FROM quizzes WHERE note_id = $1 ORDER BY created_at DESC LIMIT 1', [id]);

    if (result.rows.length === 0) {
      return res.json(null);
    }

    const quiz = result.rows[0];
    res.json({
      id: quiz.id,
      note_id: quiz.note_id,
      questions: JSON.parse(quiz.quiz_json),
      created_at: quiz.created_at
    });
  } catch (error) {
    console.error('Get quiz error:', error);
    res.status(500).json({ error: 'Error retrieving quiz' });
  }
});

// Generate and save note's quiz
app.post('/api/notes/:id/quiz', authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    // Fetch and check note ownership
    const noteResult = await db.query('SELECT id, title, content FROM notes WHERE id = $1 AND user_id = $2', [id, req.user.id]);
    if (noteResult.rows.length === 0) {
      return res.status(404).json({ error: 'Note not found' });
    }

    const note = noteResult.rows[0];
    const quizData = await gemini.generateQuiz(note.title, note.content);

    const quizJson = JSON.stringify(quizData.questions);

    // Save to database, replacing previous quiz if it exists
    await db.query('DELETE FROM quizzes WHERE note_id = $1', [id]);
    const result = await db.query(
      'INSERT INTO quizzes (note_id, quiz_json) VALUES ($1, $2) RETURNING *',
      [id, quizJson]
    );

    res.status(201).json({
      id: result.rows[0].id,
      note_id: result.rows[0].note_id,
      questions: quizData.questions,
      created_at: result.rows[0].created_at
    });
  } catch (error) {
    console.error('Generate quiz error:', error);
    res.status(500).json({ error: 'Error generating quiz' });
  }
});

// ==========================================
// FEEDBACK HUB ENDPOINTS
// ==========================================

// Get all feedbacks
app.get('/api/feedbacks', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT f.id, f.content, f.type, f.status, f.created_at, u.username
       FROM feedbacks f
       LEFT JOIN users u ON f.user_id = u.id
       ORDER BY f.created_at DESC`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Fetch feedbacks error:', error);
    res.status(500).json({ error: 'Error fetching feedbacks' });
  }
});

// Create feedback
app.post('/api/feedbacks', authenticateToken, async (req, res) => {
  const { content, type } = req.body;
  if (!content) {
    return res.status(400).json({ error: 'Feedback content is required' });
  }

  try {
    const result = await db.query(
      'INSERT INTO feedbacks (user_id, content, type) VALUES ($1, $2, $3) RETURNING *',
      [req.user.id, content, type || 'General']
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create feedback error:', error);
    res.status(500).json({ error: 'Error submitting feedback' });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
