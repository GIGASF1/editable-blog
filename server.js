const express = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3002;

const POSTS_DIR = path.join(__dirname, 'data', 'posts');
const UPLOADS_DIR = path.join(__dirname, 'public', 'uploads');

// Ensure directories exist
fs.mkdirSync(POSTS_DIR, { recursive: true });
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// File upload config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${uuidv4().slice(0, 8)}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    const allowed = /\.(jpg|jpeg|png|gif|webp|mp4|webm|mov|svg)$/i;
    if (allowed.test(path.extname(file.originalname))) {
      cb(null, true);
    } else {
      cb(new Error('Only image and video files are allowed'));
    }
  }
});

// Helper: read a post file
function readPost(id) {
  const filePath = path.join(POSTS_DIR, `${id}.json`);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

// Helper: write a post file
function writePost(post) {
  const filePath = path.join(POSTS_DIR, `${post.id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(post, null, 2));
}

// GET /api/posts — list all posts
app.get('/api/posts', (req, res) => {
  const files = fs.readdirSync(POSTS_DIR).filter(f => f.endsWith('.json'));
  const posts = files.map(f => {
    const data = JSON.parse(fs.readFileSync(path.join(POSTS_DIR, f), 'utf-8'));
    return {
      id: data.id,
      title: data.title,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      preview: data.content.replace(/<[^>]*>/g, '').slice(0, 150)
    };
  });
  posts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(posts);
});

// GET /api/posts/:id — get single post
app.get('/api/posts/:id', (req, res) => {
  const post = readPost(req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  res.json(post);
});

// POST /api/posts — create new post
app.post('/api/posts', (req, res) => {
  const { title, content } = req.body;
  if (!title || !content) return res.status(400).json({ error: 'Title and content required' });

  const post = {
    id: `post-${Date.now()}`,
    title,
    content,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  writePost(post);
  res.status(201).json(post);
});

// PUT /api/posts/:id — update post
app.put('/api/posts/:id', (req, res) => {
  const existing = readPost(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Post not found' });

  const { title, content } = req.body;
  existing.title = title || existing.title;
  existing.content = content || existing.content;
  existing.updatedAt = new Date().toISOString();
  writePost(existing);
  res.json(existing);
});

// DELETE /api/posts/:id — delete post
app.delete('/api/posts/:id', (req, res) => {
  const filePath = path.join(POSTS_DIR, `${req.params.id}.json`);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Post not found' });
  fs.unlinkSync(filePath);
  res.json({ message: 'Post deleted' });
});

// POST /api/upload — upload image or video
app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const url = `/uploads/${req.file.filename}`;
  res.json({ url, filename: req.file.filename });
});

app.listen(PORT, () => {
  console.log(`Blog server running at http://localhost:${PORT}`);
});
