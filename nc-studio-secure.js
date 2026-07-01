// ==================================================
// NetCinema Admin Panel - admin.js (Supabase Cloud Edition)
// ==================================================

// =========================================
// Supabase Client Initialization
// =========================================
const SUPABASE_URL = 'https://vonltpyxqdfzuobphfxv.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZvbmx0cHl4cWRmenVvYnBoZnh2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTAxNzkxOSwiZXhwIjoyMDk2NTkzOTE5fQ.xZ8Nx1UuLQLxLdoBn5MAaMXwydozp567WodNu694D-E'; // Service Role Key
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// =========================================
// App State
// =========================================
let articles = [];
let trailers = [];
let categories = [];
let boxOfficeRecords = [];
let editingArticleId = null;
let editingTrailerId = null;

// Generate temporary ID if needed
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

// =========================================
// Fetch Data from Supabase
// =========================================
async function fetchAllData() {
    try {
        // Fetch Articles
        const { data: artData, error: artError } = await sb.from('articles').select('*').order('created_at', { ascending: false });
        if (artError) throw artError;
        articles = artData || [];

        // Fetch Trailers
        const { data: trlData, error: trlError } = await sb.from('trailers').select('*').order('created_at', { ascending: false });
        if (trlError) throw trlError;
        trailers = trlData || [];

        // Categories are hardcoded in populateCategorySelects, so we don't need to fetch from DB anymore.
        categories = [];

        renderDashboard();
        renderTrailersTable();
        populateCategorySelects();
    } catch (error) {
        console.error("Supabase Error:", error);
        showToast("⚠️ Database Error: " + (error.message || "Connection failed"));
    }
}

// =========================================
// View Switching Logic
// =========================================
const navLinks = document.querySelectorAll('.nav-link');
const allViews = document.querySelectorAll('.admin-view');

navLinks.forEach(link => {
    link.addEventListener('click', function (e) {
        e.preventDefault();
        const target = this.getAttribute('data-target');
        navLinks.forEach(l => l.classList.remove('active'));
        allViews.forEach(v => v.classList.remove('active-view'));
        this.classList.add('active');
        document.getElementById(target).classList.add('active-view');
    });
});

// =========================================
// Rich Text Editor
// =========================================
const editorContent = document.getElementById('article-content');
const toolbarBtns = document.querySelectorAll('.tool-btn:not(#btn-clear-format):not(#btn-paste-plain)');

toolbarBtns.forEach(btn => {
    btn.addEventListener('mousedown', function (e) {
        e.preventDefault();
        const command = this.getAttribute('data-command');
        const value = this.getAttribute('data-value') || null;
        if (command === 'createLink') {
            const url = prompt('Enter the URL (include https://):');
            if (url) document.execCommand('createLink', false, url);
        } else {
            document.execCommand(command, false, value);
        }
        updateToolbarState();
        editorContent.focus();
    });
});

function updateToolbarState() {
    const commands = ['bold', 'italic', 'underline', 'strikeThrough', 'insertOrderedList', 'insertUnorderedList', 'justifyLeft', 'justifyCenter', 'justifyRight', 'justifyFull'];
    commands.forEach(cmd => {
        const btn = document.querySelector(`.tool-btn[data-command="${cmd}"]`);
        if (btn) btn.classList.toggle('active-tool', document.queryCommandState(cmd));
    });
}

if (editorContent) {
    editorContent.addEventListener('keyup', updateToolbarState);
    editorContent.addEventListener('mouseup', updateToolbarState);
}

const clearBtn = document.getElementById('btn-clear-format');
if (clearBtn) {
    clearBtn.addEventListener('mousedown', function (e) {
        e.preventDefault();
        document.execCommand('removeFormat', false, null);
        editorContent.focus();
    });
}

// =========================================
// Paste Handler
// =========================================
let preserveFormatting = true;
const pasteToggle = document.getElementById('btn-paste-plain');
if (pasteToggle) {
    pasteToggle.addEventListener('click', function () {
        preserveFormatting = !preserveFormatting;
        this.textContent = preserveFormatting ? '📋 Paste with Formatting: ON' : '📋 Paste with Formatting: OFF';
        this.classList.toggle('plain-mode', !preserveFormatting);
        this.classList.toggle('active', preserveFormatting);
    });
}

if (editorContent) {
    editorContent.addEventListener('paste', function (e) {
        e.preventDefault();
        if (preserveFormatting) {
            const htmlData = e.clipboardData.getData('text/html');
            if (htmlData) {
                document.execCommand('insertHTML', false, sanitizeHTML(htmlData));
            } else {
                const plain = e.clipboardData.getData('text/plain');
                if (window.marked) {
                    const parsed = marked.parse(plain);
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = parsed;
                    tempDiv.querySelectorAll('table thead tr').forEach(tr => {
                        const ths = tr.querySelectorAll('th');
                        let emptyCount = 0;
                        for(let i=1; i<ths.length; i++) {
                            if(!ths[i].textContent.trim()) emptyCount++;
                        }
                        if(emptyCount === ths.length - 1 && ths.length > 1) {
                            ths[0].setAttribute('colspan', ths.length);
                            for(let i=1; i<ths.length; i++) {
                                ths[i].remove();
                            }
                        }
                    });
                    document.execCommand('insertHTML', false, sanitizeHTML(tempDiv.innerHTML));
                } else {
                    const wrapped = plain.split('\n').map(l => l.trim() ? `<p>${escapeHTML(l)}</p>` : '').join('');
                    document.execCommand('insertHTML', false, wrapped || plain);
                }
            }
        } else {
            const plain = e.clipboardData.getData('text/plain');
            const wrapped = plain.split('\n').map(l => l.trim() ? `<p>${escapeHTML(l)}</p>` : '').join('');
            document.execCommand('insertHTML', false, wrapped);
        }
        updateWordCount();
    });
}

function sanitizeHTML(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    doc.querySelectorAll('script, style, meta, link, head').forEach(el => el.remove());
    const allowed = ['p','h1','h2','h3','h4','h5','h6','strong','b','em','i','u','s','ul','ol','li','a','blockquote','br','hr','span','div','table','thead','tbody','tr','th','td'];
    doc.body.querySelectorAll('*').forEach(el => {
        el.removeAttribute('class');
        el.removeAttribute('style');
        el.removeAttribute('id');
        if (!allowed.includes(el.tagName.toLowerCase())) el.replaceWith(...el.childNodes);
    });
    return doc.body.innerHTML;
}

function escapeHTML(str) {
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

const wordCountEl = document.getElementById('word-count');
const charCountEl = document.getElementById('char-count');
function updateWordCount() {
    if (!editorContent || !wordCountEl) return;
    const text = editorContent.innerText || '';
    const chars = text.replace(/\n/g, '').length;
    const words = text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
    wordCountEl.textContent = `${words} word${words !== 1 ? 's' : ''}`;
    charCountEl.textContent = `${chars} character${chars !== 1 ? 's' : ''}`;
}
if (editorContent) editorContent.addEventListener('input', updateWordCount);

function getDirectImageUrl(url) {
    let id = null;
    
    // Format 1: /file/d/ID
    let match = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (match) id = match[1];
    
    // Format 2: ?id=ID (handles thumbnail?id=, open?id=, uc?id=)
    if (!id) {
        match = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
        if (match) id = match[1];
    }

    if (id) {
        // Most reliable Google Drive direct image URL (bypasses recent 403 blocks)
        return `https://lh3.googleusercontent.com/d/${id}=s1000?authuser=0`;
    }
    return url;
}

const coverInput = document.getElementById('article-cover');
const coverPreview = document.getElementById('cover-preview');
if (coverInput) {
    coverInput.addEventListener('input', function () {
        let url = this.value.trim();
        url = getDirectImageUrl(url);
        
        // Update input to direct URL if it was converted
        if (url !== this.value.trim() && url !== "") {
            this.value = url;
        }

        coverPreview.innerHTML = url
            ? `<img src="${url}" style="width:100%;height:100%;object-fit:cover;border-radius:6px;" onerror="this.parentElement.innerHTML='<span>❌ Invalid URL</span>'">`
            : '<span>Image Preview</span>';
    });
}

// =========================================
// Dashboard Render
// =========================================
function renderDashboard() {
    const tbody = document.querySelector('#dashboard-view .admin-table tbody');
    if (!tbody) return;

    document.getElementById('stat-total-articles').textContent = articles.length;
    document.getElementById('stat-total-trailers').textContent = trailers.length;
    
    // Quick categories stat if element exists
    const catStat = document.querySelectorAll('.stat-value')[1];
    if (catStat) catStat.textContent = categories.length;

    if (articles.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#555;padding:30px;">No articles yet. Add your first article!</td></tr>`;
        return;
    }

    tbody.innerHTML = articles.map(a => `
        <tr data-id="${a.id}">
            <td style="text-align: center;"><input type="checkbox" class="article-cb" value="${a.id}"></td>
            <td>${a.title}</td>
            <td>${a.category}</td>
            <td>${new Date(a.created_at).toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric'})}</td>
            <td><span class="badge badge-${a.status}">${a.status.charAt(0).toUpperCase()+a.status.slice(1)}</span></td>
            <td style="display:flex;gap:8px;">
                <button class="btn-action btn-edit-article" data-id="${a.id}">Edit</button>
                <button class="btn-delete btn-del-article" data-id="${a.id}">Delete</button>
            </td>
        </tr>
    `).join('');

    // Checkbox Logic
    const selectAll = document.getElementById('selectAllArticles');
    const checkboxes = tbody.querySelectorAll('.article-cb');
    const bulkDeleteBtn = document.getElementById('btn-bulk-delete');

    const updateBulkBtnVisibility = () => {
        const anyChecked = Array.from(checkboxes).some(cb => cb.checked);
        bulkDeleteBtn.style.display = anyChecked ? 'inline-block' : 'none';
    };

    if (selectAll) {
        selectAll.checked = false;
        selectAll.onchange = (e) => {
            checkboxes.forEach(cb => cb.checked = e.target.checked);
            updateBulkBtnVisibility();
        };
    }

    checkboxes.forEach(cb => {
        cb.onchange = updateBulkBtnVisibility;
    });

    tbody.querySelectorAll('.btn-edit-article').forEach(btn => {
        btn.addEventListener('click', () => editArticle(btn.getAttribute('data-id')));
    });

    tbody.querySelectorAll('.btn-del-article').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = btn.getAttribute('data-id');
            const art = articles.find(a => a.id == id);
            if (art && confirm(`Delete article "${art.title}"?`)) {
                const { error } = await sb.from('articles').delete().eq('id', id);
                if (error) { showToast("❌ Error deleting article"); console.error(error); return; }
                articles = articles.filter(a => a.id != id);
                renderDashboard();
                showToast("🗑️ Article deleted");
            }
        });
    });
}

// Bulk Delete Action
document.addEventListener('DOMContentLoaded', () => {
    const bulkDeleteBtn = document.getElementById('btn-bulk-delete');
    if (bulkDeleteBtn) {
        bulkDeleteBtn.addEventListener('click', async () => {
            const checkboxes = document.querySelectorAll('.article-cb:checked');
            if (checkboxes.length === 0) return;
            
            if (confirm(`Are you sure you want to delete ${checkboxes.length} selected articles?`)) {
                bulkDeleteBtn.textContent = 'Deleting...';
                bulkDeleteBtn.disabled = true;
                
                let successCount = 0;
                for (const cb of checkboxes) {
                    const { error } = await sb.from('articles').delete().eq('id', cb.value);
                    if (!error) {
                        articles = articles.filter(a => a.id != cb.value);
                        successCount++;
                    }
                }
                
                bulkDeleteBtn.textContent = 'Delete Selected';
                bulkDeleteBtn.disabled = false;
                renderDashboard();
                showToast(`🗑️ ${successCount} articles deleted`);
            }
        });
    }
});

// =========================================
// Article Editor
// =========================================
function getArticleFormData(status) {
    const title = document.getElementById('article-title').value.trim();
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    
    return {
        title: title,
        slug: slug,
        category: document.getElementById('article-category').value,
        content: editorContent.innerHTML.trim(),
        cover_image: document.getElementById('article-cover').value.trim(),
        trailer_url: document.getElementById('article-trailer').value.trim(),
        status
    };
}

function clearArticleForm() {
    document.getElementById('article-title').value = '';
    document.getElementById('article-category').value = '';
    editorContent.innerHTML = '';
    document.getElementById('article-cover').value = '';
    document.getElementById('article-trailer').value = '';
    if (coverPreview) coverPreview.innerHTML = '<span>Image Preview</span>';
    editingArticleId = null;
    updateWordCount();
    document.getElementById('article-form-title').textContent = 'Add New Article';
    document.getElementById('btn-publish').textContent = 'Publish Article';
    document.getElementById('btn-cancel-edit').style.display = 'none';
}

const cancelEditBtn = document.getElementById('btn-cancel-edit');
if (cancelEditBtn) {
    cancelEditBtn.addEventListener('click', function() {
        if (confirm('Are you sure you want to cancel editing? Unsaved changes will be lost.')) {
            clearArticleForm();
            navLinks.forEach(l => l.classList.remove('active'));
            allViews.forEach(v => v.classList.remove('active-view'));
            document.querySelector('[data-target="dashboard-view"]').classList.add('active');
            document.getElementById('dashboard-view').classList.add('active-view');
        }
    });
}

function editArticle(id) {
    const art = articles.find(a => a.id == id);
    if (!art) return;
    editingArticleId = id;

    navLinks.forEach(l => l.classList.remove('active'));
    allViews.forEach(v => v.classList.remove('active-view'));
    document.querySelector('[data-target="add-post-view"]').classList.add('active');
    document.getElementById('add-post-view').classList.add('active-view');

    document.getElementById('article-title').value = art.title;
    document.getElementById('article-category').value = art.category;
    editorContent.innerHTML = art.content || '';
    document.getElementById('article-cover').value = art.cover_image || '';
    document.getElementById('article-trailer').value = art.trailer_url || '';
    if (coverPreview && art.cover_image) {
        coverPreview.innerHTML = `<img src="${art.cover_image}" style="width:100%;height:100%;object-fit:cover;border-radius:6px;">`;
    }
    updateWordCount();

    document.getElementById('article-form-title').textContent = 'Edit Article';
    document.getElementById('btn-publish').textContent = 'Update Article';
    document.getElementById('btn-cancel-edit').style.display = 'inline-flex';
}

async function handleArticleSave(status) {
    const data = getArticleFormData(status);
    if (!data.title)    { alert('⚠️ Please enter a title.'); return; }
    if (!data.category) { alert('⚠️ Please select a category.'); return; }
    if (status === 'published' && !data.content)  { alert('⚠️ Please write some content.'); return; }

    const submitBtn = document.getElementById('btn-publish');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Saving...';
    submitBtn.disabled = true;

    try {
        if (editingArticleId) {
            const { data: updated, error } = await sb.from('articles').update(data).eq('id', editingArticleId).select();
            if (error) throw error;
            articles = articles.map(a => a.id == editingArticleId ? updated[0] : a);
            showToast('✅ Article updated successfully!');
        } else {
            const { data: inserted, error } = await sb.from('articles').insert([data]).select();
            if (error) throw error;
            articles.unshift(inserted[0]);
            showToast(status === 'published' ? '✅ Article published!' : '💾 Draft saved!');
        }

        clearArticleForm();
        navLinks.forEach(l => l.classList.remove('active'));
        allViews.forEach(v => v.classList.remove('active-view'));
        document.querySelector('[data-target="dashboard-view"]').classList.add('active');
        document.getElementById('dashboard-view').classList.add('active-view');
        renderDashboard();
    } catch (error) {
        console.error("Save error:", error);
        showToast("❌ Error saving article: " + (error.message || "Unknown error"));
    } finally {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    }
}

document.getElementById('btn-publish').addEventListener('click', () => handleArticleSave('published'));
document.querySelector('.btn-secondary').addEventListener('click', () => handleArticleSave('draft'));

// =========================================
// Dynamic Category Selects
// =========================================
function populateCategorySelects() {
    const artCat = document.getElementById('article-category');
    const trlCat = document.getElementById('trailer-category');
    
    let catsToUse = categories;
    if (categories.length === 0) {
        // Fallback default categories if database is empty
        catsToUse = [
            { slug: 'movie-reviews', name: 'Movie Reviews' },
            { slug: 'movie-news', name: 'Movie News' },
            { slug: 'box-office', name: 'Box Office' },
            { slug: 'tv-reviews', name: 'TV Reviews' },
            { slug: 'trailers', name: 'Trailers' },
            { slug: 'celebs', name: 'Celebs' },
            { slug: 'top-stories', name: 'Top Stories' }
        ];
    }

    const optionsHtml = `<option value="">Select Category...</option>` + 
        catsToUse.map(c => `<option value="${c.slug}">${c.name}</option>`).join('');
    
    if (artCat) artCat.innerHTML = optionsHtml;
    if (trlCat) trlCat.innerHTML = optionsHtml;
}

// =========================================
// Categories Logic
// =========================================
const catNameInput = document.getElementById('new-cat-name');
const catSlugInput = document.getElementById('new-cat-slug');
const addCatBtn    = document.getElementById('btn-add-category');
const catTbody     = document.getElementById('categories-tbody');

if (catNameInput) {
    catNameInput.addEventListener('input', function () {
        catSlugInput.value = this.value.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    });
}

function renderCategoriesTable() {
    if (!catTbody) return;
    if (categories.length === 0) {
        catTbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:#555;">No categories found.</td></tr>`;
        return;
    }
    
    catTbody.innerHTML = categories.map((c, i) => `
        <tr>
            <td>${i + 1}</td>
            <td>${c.name}</td>
            <td><span class="slug-badge">${c.slug}</span></td>
            <td><button class="btn-delete" data-id="${c.id}">Delete</button></td>
        </tr>
    `).join('');

    catTbody.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = btn.getAttribute('data-id');
            const c = categories.find(x => x.id == id);
            if (c && confirm(`Delete category "${c.name}"?`)) {
                const { error } = await sb.from('categories').delete().eq('id', id);
                if (error) { showToast("❌ Error deleting category"); return; }
                categories = categories.filter(x => x.id != id);
                renderCategoriesTable();
                populateCategorySelects();
                showToast("🗑️ Category deleted");
            }
        });
    });
}

if (addCatBtn) {
    addCatBtn.addEventListener('click', async function () {
        const name = catNameInput.value.trim();
        const slug = catSlugInput.value.trim();
        if (!name) { alert('⚠️ Please enter a category name.'); return; }

        addCatBtn.disabled = true;
        try {
            const { data, error } = await sb.from('categories').insert([{ name, slug }]).select();
            if (error) throw error;
            categories.unshift(data[0]);
            renderCategoriesTable();
            populateCategorySelects();
            catNameInput.value = '';
            catSlugInput.value = '';
            catNameInput.focus();
            showToast(`✅ Category "${name}" added!`);
        } catch (error) {
            console.error(error);
            showToast("❌ Error adding category");
        } finally {
            addCatBtn.disabled = false;
        }
    });
}

// =========================================
// Trailers Logic
// =========================================
const trailerTitleInput = document.getElementById('trailer-title');
const trailerCatInput   = document.getElementById('trailer-category');
const trailerYtInput    = document.getElementById('trailer-youtube');
const trailerPreview    = document.getElementById('trailer-preview');
const addTrailerBtn     = document.getElementById('btn-add-trailer');

function getYouTubeId(url) {
    const match = url.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([a-zA-Z0-9_-]{11})/);
    return match ? match[1] : null;
}

if (trailerYtInput) {
    trailerYtInput.addEventListener('input', function () {
        const id = getYouTubeId(this.value.trim());
        trailerPreview.innerHTML = id
            ? `<iframe src="https://www.youtube.com/embed/${id}" allowfullscreen></iframe>`
            : '<span>&#9654; YouTube Preview</span>';
    });
}

function renderTrailersTable() {
    const tbody = document.getElementById('trailers-tbody');
    if (!tbody) return;

    if (trailers.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#555;padding:30px;">No trailers yet.</td></tr>`;
        return;
    }

    tbody.innerHTML = trailers.map((t, i) => `
        <tr data-id="${t.id}">
            <td>${i + 1}</td>
            <td>${t.title}</td>
            <td>${t.category_label || t.category}</td>
            <td><a href="${t.yt_url}" target="_blank" class="yt-link">&#9654; Watch</a></td>
            <td style="display:flex;gap:8px;">
                <button class="btn-action btn-edit-trailer" data-id="${t.id}">Edit</button>
                <button class="btn-delete btn-del-trailer" data-id="${t.id}">Delete</button>
            </td>
        </tr>
    `).join('');

    tbody.querySelectorAll('.btn-edit-trailer').forEach(btn => {
        btn.addEventListener('click', () => editTrailer(btn.getAttribute('data-id')));
    });

    tbody.querySelectorAll('.btn-del-trailer').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = btn.getAttribute('data-id');
            const t = trailers.find(x => x.id == id);
            if (t && confirm(`Delete trailer "${t.title}"?`)) {
                const { error } = await sb.from('trailers').delete().eq('id', id);
                if (error) { showToast("❌ Error deleting trailer"); return; }
                trailers = trailers.filter(x => x.id != id);
                renderTrailersTable();
                showToast("🗑️ Trailer deleted");
            }
        });
    });
}

function editTrailer(id) {
    const t = trailers.find(x => x.id == id);
    if (!t) return;
    editingTrailerId = id;

    trailerTitleInput.value = t.title;
    trailerCatInput.value = t.category;
    trailerYtInput.value = t.yt_url;

    const ytId = getYouTubeId(t.yt_url);
    if (ytId && trailerPreview) {
        trailerPreview.innerHTML = `<iframe src="https://www.youtube.com/embed/${ytId}" allowfullscreen></iframe>`;
    }

    addTrailerBtn.textContent = '✏️ Update Trailer';
}

if (addTrailerBtn) {
    addTrailerBtn.addEventListener('click', async function () {
        const title    = trailerTitleInput.value.trim();
        const category = trailerCatInput.value;
        const yt_url   = trailerYtInput.value.trim();
        const id       = getYouTubeId(yt_url);

        if (!title)    { alert('⚠️ Please enter a title.'); return; }
        if (!category) { alert('⚠️ Please select a category.'); return; }
        if (!id)       { alert('⚠️ Please enter a valid YouTube URL.'); return; }

        const catObj = categories.find(c => c.slug === category);
        const category_label = catObj ? catObj.name : category;

        const payload = { title, category, category_label, yt_url };
        addTrailerBtn.disabled = true;

        try {
            if (editingTrailerId) {
                const { data, error } = await sb.from('trailers').update(payload).eq('id', editingTrailerId).select();
                if (error) throw error;
                trailers = trailers.map(t => t.id == editingTrailerId ? data[0] : t);
                editingTrailerId = null;
                addTrailerBtn.textContent = '+ Add Trailer';
                showToast('✅ Trailer updated!');
            } else {
                const { data, error } = await sb.from('trailers').insert([payload]).select();
                if (error) throw error;
                trailers.unshift(data[0]);
                showToast('✅ Trailer added!');
            }
            renderTrailersTable();
            
            trailerTitleInput.value = '';
            trailerCatInput.value = '';
            trailerYtInput.value = '';
            trailerPreview.innerHTML = '<span>&#9654; YouTube Preview</span>';
        } catch (error) {
            console.error("Save error:", error);
            showToast("❌ Error saving trailer: " + (error.message || "Unknown error"));
        } finally {
            addTrailerBtn.disabled = false;
        }
    });
}

// TMDB Poster Fetch
const TMDB_BEARER = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9';
const TMDB_API_KEY_ADMIN = '6eb12dddcc6ac8f7c47f392552b38a47';

document.addEventListener('click', async function(e) {
    if (e.target && e.target.id === 'btn-fetch-tmdb') {
        const movieInput = document.getElementById('bo-movie');
        const coverInput = document.getElementById('bo-cover');
        const coverPrev  = document.getElementById('bo-cover-preview');
        const btn        = e.target;

        const query = movieInput ? movieInput.value.trim() : '';
        if (!query) { showToast('⚠️ Enter a movie name first'); return; }

        btn.textContent = 'Searching...';
        btn.disabled = true;

        try {
            const url = `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY_ADMIN}&query=${encodeURIComponent(query)}&language=en-US&page=1`;
            const res = await fetch(url);
            
            if (!res.ok) throw new Error('TMDB API error: ' + res.status);
            
            const data = await res.json();

            if (data.results && data.results.length > 0) {
                // Pick best match (first result)
                const movie = data.results[0];
                const posterPath = movie.poster_path;

                if (posterPath) {
                    const posterUrl = `https://image.tmdb.org/t/p/w500${posterPath}`;
                    if (coverInput) coverInput.value = posterUrl;
                    if (coverPrev)  coverPrev.innerHTML = `<img src="${posterUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:6px;" onerror="this.parentNode.innerHTML='<span>Preview failed</span>'">`;
                    showToast(`✅ Poster found: ${movie.title}`);
                } else {
                    showToast('⚠️ No poster available for this movie on TMDB');
                }
            } else {
                showToast('⚠️ Movie not found. Try a different title.');
            }
        } catch (err) {
            console.error('TMDB Fetch Error:', err);
            showToast('❌ TMDB Error: ' + err.message);
        } finally {
            btn.textContent = 'Get Poster';
            btn.disabled = false;
        }
    }
});

// =========================================
// Toast Notification
// =========================================
function showToast(message) {
    let toast = document.getElementById('admin-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'admin-toast';
        toast.style.cssText = `
            position:fixed; bottom:32px; right:32px; background:#181a20;
            border:1px solid #bfa175; color:#fff; padding:14px 24px;
            border-radius:8px; font-size:14px; z-index:9999;
            box-shadow:0 8px 32px rgba(0,0,0,0.4);
            transition: opacity 0.3s; opacity:0;
        `;
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.style.opacity = '1';
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => { toast.style.opacity = '0'; }, 3000);
}

// =========================================
// Box Office CRUD Logic
// =========================================
let editingBoId = null;

function renderBoTable() {
    const boTbody = document.getElementById('bo-tbody');
    if (!boTbody) return;

    if (boxOfficeRecords.length === 0) {
        boTbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#555;padding:30px;">No box office records yet. Add your first entry!</td></tr>`;
        return;
    }

    boTbody.innerHTML = boxOfficeRecords.map(bo => `
        <tr data-id="${bo.id}">
            <td>${bo.rank}</td>
            <td>${bo.movie}</td>
            <td>${bo.weekend_gross || '-'}</td>
            <td>${bo.total_gross || '-'}</td>
            <td style="display:flex;gap:8px;">
                <button class="btn-action btn-edit-bo" data-id="${bo.id}">Edit</button>
                <button class="btn-delete btn-del-bo" data-id="${bo.id}">Delete</button>
            </td>
        </tr>
    `).join('');

    boTbody.querySelectorAll('.btn-edit-bo').forEach(btn => {
        btn.addEventListener('click', () => editBo(btn.getAttribute('data-id')));
    });
    boTbody.querySelectorAll('.btn-del-bo').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = btn.getAttribute('data-id');
            if (confirm('Delete this box office record?')) {
                const { error } = await sb.from('box_office').delete().eq('id', id);
                if (error) { showToast('❌ Error deleting record'); return; }
                boxOfficeRecords = boxOfficeRecords.filter(x => x.id != id);
                renderBoTable();
                showToast('🗑️ Record deleted');
            }
        });
    });
}

function editBo(id) {
    const bo = boxOfficeRecords.find(x => x.id == id);
    if (!bo) return;
    editingBoId = id;

    document.getElementById('bo-rank').value    = bo.rank;
    document.getElementById('bo-movie').value   = bo.movie;
    document.getElementById('bo-cover').value   = bo.cover_image || '';
    document.getElementById('bo-weekend').value = bo.weekend_gross || '';
    document.getElementById('bo-total').value   = bo.total_gross || '';
    document.getElementById('bo-weeks').value   = bo.weeks || '';
    document.getElementById('bo-change').value  = bo.change || '';

    const prev = document.getElementById('bo-cover-preview');
    if (prev && bo.cover_image) {
        prev.innerHTML = `<img src="${bo.cover_image}" style="width:100%;height:100%;object-fit:cover;border-radius:6px;">`;
    }

    const saveBtn = document.getElementById('btn-save-bo');
    const cancelBtn = document.getElementById('btn-cancel-bo-edit');
    if (saveBtn) saveBtn.textContent = '✏️ Update Entry';
    if (cancelBtn) cancelBtn.style.display = 'inline-block';
}

function clearBoForm() {
    editingBoId = null;
    ['bo-rank','bo-movie','bo-cover','bo-weekend','bo-total','bo-weeks','bo-change'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    const prev = document.getElementById('bo-cover-preview');
    if (prev) prev.innerHTML = '<span>Image Preview</span>';
    const saveBtn = document.getElementById('btn-save-bo');
    const cancelBtn = document.getElementById('btn-cancel-bo-edit');
    if (saveBtn) saveBtn.textContent = 'Save Entry';
    if (cancelBtn) cancelBtn.style.display = 'none';
}

// Cancel Edit
document.addEventListener('click', function(e) {
    if (e.target && e.target.id === 'btn-cancel-bo-edit') {
        clearBoForm();
    }
});

// Save Entry
document.addEventListener('click', async function(e) {
    if (e.target && e.target.id === 'btn-save-bo') {
        const btn = e.target;

        const payload = {
            rank:          parseInt(document.getElementById('bo-rank')?.value),
            movie:         document.getElementById('bo-movie')?.value.trim(),
            cover_image:   document.getElementById('bo-cover')?.value.trim(),
            weekend_gross: document.getElementById('bo-weekend')?.value.trim(),
            total_gross:   document.getElementById('bo-total')?.value.trim(),
            weeks:         document.getElementById('bo-weeks')?.value.trim(),
            change:        document.getElementById('bo-change')?.value.trim()
        };

        if (!payload.rank || !payload.movie) {
            showToast('⚠️ Rank and Movie Title are required.');
            return;
        }

        btn.disabled = true;
        btn.textContent = 'Saving...';

        try {
            if (editingBoId) {
                const { data, error } = await sb.from('box_office').update(payload).eq('id', editingBoId).select();
                if (error) throw error;
                boxOfficeRecords = boxOfficeRecords.map(x => x.id == editingBoId ? data[0] : x);
                showToast('✅ Box Office updated!');
            } else {
                const { data, error } = await sb.from('box_office').insert([payload]).select();
                if (error) throw error;
                boxOfficeRecords.push(data[0]);
                showToast('✅ Box Office entry added!');
            }
            boxOfficeRecords.sort((a, b) => a.rank - b.rank);
            clearBoForm();
            renderBoTable();
        } catch (error) {
            console.error('Box Office save error:', error);
            showToast('❌ Error saving: ' + (error.message || 'Unknown error'));
        } finally {
            btn.disabled = false;
        }
    }
});

// =========================================
// Init
// =========================================
fetchAllData();
