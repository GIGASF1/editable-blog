// State
let currentPostId = null;

// DOM elements
const blogList = document.getElementById('blog-list');
const postView = document.getElementById('post-view');
const editor = document.getElementById('editor');
const postsContainer = document.getElementById('posts-container');
const noPosts = document.getElementById('no-posts');

const viewTitle = document.getElementById('view-title');
const viewDate = document.getElementById('view-date');
const viewContent = document.getElementById('view-content');

const editorTitle = document.getElementById('editor-title');
const editorContent = document.getElementById('editor-content');
const fileInput = document.getElementById('file-input');

// Navigation helpers
function showView(view) {
  blogList.classList.add('hidden');
  postView.classList.add('hidden');
  editor.classList.add('hidden');
  view.classList.remove('hidden');
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
  });
}

// API calls
async function fetchPosts() {
  const res = await fetch('/api/posts');
  return res.json();
}

async function fetchPost(id) {
  const res = await fetch(`/api/posts/${id}`);
  return res.json();
}

async function createPost(title, content) {
  const res = await fetch('/api/posts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, content })
  });
  return res.json();
}

async function updatePost(id, title, content) {
  const res = await fetch(`/api/posts/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, content })
  });
  return res.json();
}

async function deletePost(id) {
  await fetch(`/api/posts/${id}`, { method: 'DELETE' });
}

async function uploadFile(file) {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch('/api/upload', { method: 'POST', body: formData });
  return res.json();
}

// Render post list
async function renderPostList() {
  const posts = await fetchPosts();
  postsContainer.innerHTML = '';

  if (posts.length === 0) {
    noPosts.classList.remove('hidden');
    return;
  }

  noPosts.classList.add('hidden');

  posts.forEach(post => {
    const card = document.createElement('div');
    card.className = 'post-card';
    card.innerHTML = `
      <h3>${escapeHtml(post.title)}</h3>
      <time>${formatDate(post.createdAt)}</time>
      <p class="preview">${escapeHtml(post.preview)}${post.preview.length >= 150 ? '...' : ''}</p>
    `;
    card.addEventListener('click', () => openPost(post.id));
    postsContainer.appendChild(card);
  });
}

// Open a single post
async function openPost(id) {
  const post = await fetchPost(id);
  currentPostId = post.id;
  viewTitle.textContent = post.title;
  viewDate.textContent = formatDate(post.updatedAt);
  viewContent.innerHTML = post.content;
  showView(postView);
}

// Open editor (new or edit)
function openEditor(post) {
  if (post) {
    currentPostId = post.id;
    editorTitle.value = post.title;
    editorContent.innerHTML = post.content;
  } else {
    currentPostId = null;
    editorTitle.value = '';
    editorContent.innerHTML = '';
  }
  showView(editor);
  editorTitle.focus();
}

// Save post
async function savePost() {
  const title = editorTitle.value.trim();
  const content = editorContent.innerHTML.trim();

  if (!title) {
    alert('Please enter a title');
    return;
  }
  if (!content) {
    alert('Please enter some content');
    return;
  }

  if (currentPostId) {
    await updatePost(currentPostId, title, content);
  } else {
    await createPost(title, content);
  }

  showView(blogList);
  await renderPostList();
}

// Handle file upload
async function handleFileUpload(file) {
  editorContent.classList.add('uploading');

  try {
    const result = await uploadFile(file);
    const isVideo = /\.(mp4|webm|mov)$/i.test(result.filename);

    if (isVideo) {
      const video = document.createElement('video');
      video.src = result.url;
      video.controls = true;
      video.style.maxWidth = '100%';
      editorContent.appendChild(video);
    } else {
      const img = document.createElement('img');
      img.src = result.url;
      img.style.maxWidth = '100%';
      editorContent.appendChild(img);
    }

    // Add a line break after the media so user can keep typing
    editorContent.appendChild(document.createElement('br'));
  } catch (err) {
    alert('Upload failed: ' + err.message);
  }

  editorContent.classList.remove('uploading');
}

// Escape HTML for safe text display
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// --- Event Listeners ---

// Site title -> go home
document.getElementById('site-title').addEventListener('click', () => {
  showView(blogList);
  renderPostList();
});

// New post button
document.getElementById('new-post-btn').addEventListener('click', () => {
  openEditor(null);
});

// Back button
document.getElementById('back-btn').addEventListener('click', () => {
  showView(blogList);
  renderPostList();
});

// Edit button
document.getElementById('edit-btn').addEventListener('click', async () => {
  const post = await fetchPost(currentPostId);
  openEditor(post);
});

// Delete button
document.getElementById('delete-btn').addEventListener('click', async () => {
  if (confirm('Are you sure you want to delete this post?')) {
    await deletePost(currentPostId);
    currentPostId = null;
    showView(blogList);
    await renderPostList();
  }
});

// Save button
document.getElementById('save-btn').addEventListener('click', savePost);

// Cancel button
document.getElementById('cancel-btn').addEventListener('click', () => {
  if (currentPostId) {
    openPost(currentPostId);
  } else {
    showView(blogList);
    renderPostList();
  }
});

// Toolbar commands
document.querySelectorAll('#toolbar button[data-cmd]').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    const cmd = btn.dataset.cmd;
    const value = btn.dataset.value || null;
    document.execCommand(cmd, false, value);
    editorContent.focus();
  });
});

// File input
fileInput.addEventListener('change', (e) => {
  if (e.target.files[0]) {
    handleFileUpload(e.target.files[0]);
    e.target.value = '';
  }
});

// Drag and drop on editor
editorContent.addEventListener('dragover', (e) => {
  e.preventDefault();
  editorContent.style.borderColor = '#2563eb';
});

editorContent.addEventListener('dragleave', () => {
  editorContent.style.borderColor = '#ddd';
});

editorContent.addEventListener('drop', (e) => {
  e.preventDefault();
  editorContent.style.borderColor = '#ddd';
  const file = e.dataTransfer.files[0];
  if (file && /^(image|video)\//.test(file.type)) {
    handleFileUpload(file);
  }
});

// Paste image handling
editorContent.addEventListener('paste', (e) => {
  const items = e.clipboardData?.items;
  if (!items) return;

  for (const item of items) {
    if (item.type.startsWith('image/')) {
      e.preventDefault();
      handleFileUpload(item.getAsFile());
      return;
    }
  }
});

// Initial load — ensure blog list is shown
showView(blogList);
renderPostList();
