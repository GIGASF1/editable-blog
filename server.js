require('dotenv').config();
const express = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = 3002;

// Supabase client (service role for server-side operations)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// File upload config (memory storage — we upload to Supabase, not disk)
const upload = multer({
  storage: multer.memoryStorage(),
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

// GET /api/posts — list all posts
app.get('/api/posts', async (req, res) => {
  const { data, error } = await supabase
    .from('posts')
    .select('id, title, content, created_at, updated_at')
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

  const posts = data.map(post => ({
    id: post.id,
    title: post.title,
    createdAt: post.created_at,
    updatedAt: post.updated_at,
    preview: post.content.replace(/<[^>]*>/g, '').slice(0, 150)
  }));

  res.json(posts);
});

// GET /api/posts/:id — get single post
app.get('/api/posts/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('posts')
    .select('*')
    .eq('id', req.params.id)
    .single();

  if (error || !data) return res.status(404).json({ error: 'Post not found' });

  res.json({
    id: data.id,
    title: data.title,
    content: data.content,
    createdAt: data.created_at,
    updatedAt: data.updated_at
  });
});

// POST /api/posts — create new post
app.post('/api/posts', async (req, res) => {
  const { title, content } = req.body;
  if (!title || !content) return res.status(400).json({ error: 'Title and content required' });

  const id = `post-${Date.now()}`;
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('posts')
    .insert({ id, title, content, created_at: now, updated_at: now })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });

  res.status(201).json({
    id: data.id,
    title: data.title,
    content: data.content,
    createdAt: data.created_at,
    updatedAt: data.updated_at
  });
});

// PUT /api/posts/:id — update post
app.put('/api/posts/:id', async (req, res) => {
  const { title, content } = req.body;
  const now = new Date().toISOString();

  const updates = { updated_at: now };
  if (title) updates.title = title;
  if (content) updates.content = content;

  const { data, error } = await supabase
    .from('posts')
    .update(updates)
    .eq('id', req.params.id)
    .select()
    .single();

  if (error || !data) return res.status(404).json({ error: 'Post not found' });

  res.json({
    id: data.id,
    title: data.title,
    content: data.content,
    createdAt: data.created_at,
    updatedAt: data.updated_at
  });
});

// DELETE /api/posts/:id — delete post
app.delete('/api/posts/:id', async (req, res) => {
  const { error } = await supabase
    .from('posts')
    .delete()
    .eq('id', req.params.id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ message: 'Post deleted' });
});

// POST /api/upload — upload image or video to Supabase Storage
app.post('/api/upload', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const ext = path.extname(req.file.originalname);
  const filename = `${Date.now()}-${uuidv4().slice(0, 8)}${ext}`;

  const { error } = await supabase.storage
    .from('uploads')
    .upload(filename, req.file.buffer, {
      contentType: req.file.mimetype
    });

  if (error) return res.status(500).json({ error: error.message });

  // Get the public URL
  const { data: urlData } = supabase.storage
    .from('uploads')
    .getPublicUrl(filename);

  res.json({ url: urlData.publicUrl, filename });
});

app.listen(PORT, () => {
  console.log(`Blog server running at http://localhost:${PORT}`);
  console.log(`Using Supabase at ${process.env.SUPABASE_URL}`);
});
