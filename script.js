// ==================================================
// NetCinema News - Main Client Script (Supabase)
// ==================================================

// Supabase Configuration
const SUPABASE_URL = 'https://vonltpyxqdfzuobphfxv.supabase.co';
const SUPABASE_KEY = 'sb_publishable_6rBCcEVqoBVraBcc5duxrA_dkbOaB-H';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);



function optimizeImage(url, width = 800) {
    if (!url) return FALLBACK_IMAGE;
    if (url.includes('lh3.googleusercontent.com')) return url.replace(/=s\d+/, =s// Fallback Image
const FALLBACK_IMAGE = 'https://via.placeholder.com/800x450?text=NetCinema';{width});
    return url;
}

// =========================================
// Utility Functions
// =========================================
function timeAgo(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);

    if (seconds < 60) return "Just now";
    if (seconds < 3600) return Math.floor(seconds / 60) + " minutes ago";
    if (seconds < 86400) return Math.floor(seconds / 3600) + " hours ago";
    return Math.floor(seconds / 86400) + " days ago";
}

function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric'
    });
}

function getUrlParam(param) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
}

// =========================================
// Data Fetching Functions
// =========================================
async function fetchLatestArticles(limit = 10) {
    const { data, error } = await sb
        .from('articles')
        .select('*')
        .eq('status', 'published')
        .neq('category', 'trailers')
        .order('created_at', { ascending: false })
        .limit(limit);
    if (error) { console.error('Error fetching latest articles:', error); return []; }
    return data;
}

async function fetchArticlesByCategory(category, limit = 20) {
    const { data, error } = await sb
        .from('articles')
        .select('*')
        .eq('status', 'published')
        .eq('category', category)
        .order('created_at', { ascending: false })
        .limit(limit);
    if (error) { console.error(`Error fetching category ${category}:`, error); return []; }
    return data;
}

async function fetchArticleBySlug(slug) {
    try {
        const { data, error } = await sb.from('articles').select('*').eq('slug', slug).single();
        if (error) throw error;
        return data;
    } catch (error) {
        console.error(`Error fetching article by slug ${slug}:`, error);
        return null;
    }
}

async function fetchTrailers() {
    const { data, error } = await sb
        .from('trailers')
        .select('*')
        .order('created_at', { ascending: false });
    if (error) { console.error('Error fetching trailers:', error); return []; }
    return data;
}

// =========================================
// Rendering Functions
// =========================================

// =========================================
// Box Office Fetch
// =========================================
async function fetchBoxOffice() {
    const { data, error } = await sb
        .from('box_office')
        .select('*')
        .order('rank', { ascending: true });
    if (error && error.code !== '42P01') { console.error('Error fetching box office:', error); return []; }
    return data || [];
}

// Generate HTML for a small sidebar item
function renderSidebarItem(article) {
    const img = optimizeImage(article.cover_image || FALLBACK_IMAGE, 500);
    return `
        <article class="sidebar-item" onclick="window.location.href='article.html?slug=${article.slug}'" style="cursor:pointer;">
            <div class="sidebar-item-content">
                <span class="time">${timeAgo(article.created_at)}</span>
                <h3>${article.title}</h3>
            </div>
            <img src="${img}" alt="${article.title}" loading="lazy">
        </article>
    `;
}

// Generate HTML for a standard grid card
function renderGridCard(article) {
    const img = optimizeImage(article.cover_image || FALLBACK_IMAGE, 500);
    return `
        <article class="small-card card" onclick="window.location.href='article.html?slug=${article.slug}'" style="cursor:pointer;">
            <img src="${img}" alt="${article.title}" loading="lazy">
            <div class="card-content">
                <h4>${article.title}</h4>
            </div>
        </article>
    `;
}

// Generate HTML for an exclusive card (used in lower sections)
function renderExclusiveCard(article) {
    const img = optimizeImage(article.cover_image || FALLBACK_IMAGE, 500);
    const catLabel = article.category.toUpperCase().replace('-', ' ');
    return `
        <article class="exclusive-card card" onclick="window.location.href='article.html?slug=${article.slug}'" style="cursor:pointer;">
            <img src="${img}" alt="${article.title}" loading="lazy">
            <div class="card-content">
                <span class="date" style="color:#2c5e9e; font-weight:bold; text-transform:uppercase; font-size:12px;">${catLabel}</span>
                <h4>${article.title}</h4>
                <div class="read-more" style="color:#bfa175; margin-top:10px; font-size:14px; font-weight:bold;">Read More &rarr;</div>
            </div>
        </article>
    `;
}

// Generate HTML for a Box Office Card
function renderBoxOfficeCard(bo) {
    const img = optimizeImage(bo.cover_image || FALLBACK_IMAGE, 500);
    return `
        <article class="small-card card">
            <img src="${img}" alt="${bo.movie}" loading="lazy">
            <div class="card-content">
                <span class="tag" style="background-color: #bfa175; color: #000;">#${bo.rank}</span>
                <h4 style="margin-top: 8px;">${bo.movie}</h4>
                <div style="color: #4CAF50; font-weight: bold; margin-top: 5px; font-size: 14px;">${bo.weekend_gross} Weekend</div>
            </div>
        </article>
    `;
}

// =========================================
// Page Specific Initializers
// =========================================

async function initHomePage() {
    const articles = await fetchLatestArticles(10);

    // Main Hero
    const heroContainer = document.getElementById('dynamic-hero');
    if (heroContainer && articles.length > 0) {
        const heroArt = articles[0];
        const img = optimizeImage(heroArt.cover_image || FALLBACK_IMAGE, 500);
        heroContainer.innerHTML = `
            <article class="main-card card" onclick="window.location.href='article.html?slug=${heroArt.slug}'" style="cursor:pointer;">
                <img src="${img}" alt="${heroArt.title}" fetchpriority="high">
                <div class="card-content main-content">
                    <h2>${heroArt.title}</h2>
                </div>
            </article>
        `;
    }

    // Sidebar (Latest News)
    const sidebarContainer = document.getElementById('dynamic-sidebar');
    if (sidebarContainer) {
        const sidebarArticles = articles.slice(1, 5); // 4 articles to align with hero image height
        sidebarContainer.innerHTML = sidebarArticles.length > 0
            ? sidebarArticles.map(renderSidebarItem).join('')
            : '<p style="color:#a0a5b1; padding:20px;">Publish more articles to see them here.</p>';
    }

    // Hero Bottom row - show next 4 articles (5 to 8)
    const bottomContainer = document.getElementById('dynamic-hero-bottom');
    if (bottomContainer) {
        const bottomArticles = articles.slice(5, 9);
        bottomContainer.innerHTML = bottomArticles.length > 0
            ? bottomArticles.map(renderGridCard).join('')
            : '';
    }

    // Load category previews for the bottom section
    initHomeCategoryReviews();

    // Load Lower Sections (Movie News, Exclusive Stories, Celebs) in parallel
    const [movieNewsArticles, topStoriesArticles, celebsArticles, trailers] = await Promise.all([
        fetchArticlesByCategory('movie-news', 5),
        fetchArticlesByCategory('top-stories', 5),
        fetchArticlesByCategory('celebs', 5),
        fetchTrailers()
    ]);

    const mnContainer = document.getElementById('dynamic-movie-news');
    if (mnContainer) mnContainer.innerHTML = movieNewsArticles.length > 0 ? movieNewsArticles.map(renderExclusiveCard).join('') : '<p style="color:#a0a5b1;">No movie news yet.</p>';

    const tsContainer = document.getElementById('dynamic-exclusive-stories');
    if (tsContainer) tsContainer.innerHTML = topStoriesArticles.length > 0 ? topStoriesArticles.map(renderExclusiveCard).join('') : '<p style="color:#a0a5b1;">No exclusive stories yet.</p>';

    const celebsContainer = document.getElementById('dynamic-celebs');
    if (celebsContainer) celebsContainer.innerHTML = celebsArticles.length > 0 ? celebsArticles.map(renderExclusiveCard).join('') : '<p style="color:#a0a5b1;">No celeb news yet.</p>';

    // Load Trailers for Home
    const trailersContainer = document.getElementById('dynamic-home-trailers');
    if (trailersContainer) {
        if (trailers.length > 0) {
            trailersContainer.innerHTML = trailers.slice(0, 5).map(t => {
                const ytId = getYouTubeId(t.yt_url);
                const thumbUrl = ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : FALLBACK_IMAGE;
                return `
                    <article class="exclusive-card card trailer-card" onclick="openVideoModal('${ytId}')">
                        <img src="${thumbUrl}" alt="${t.title}" loading="lazy">
                        <div class="card-content">
                            <span class="yt-tag">&#9654; YouTube</span>
                            <div class="play-btn">&#9654;</div>
                            <span class="date franchise" style="color: #fff; font-weight:bold; text-transform:uppercase; font-size:12px;">${t.category_label || t.category}</span>
                            <h4>${t.title}</h4>
                        </div>
                    </article>
                `;
            }).join('');
        } else {
            trailersContainer.innerHTML = '<p style="color:#a0a5b1;">No trailers yet.</p>';
        }
    }
}

async function initHomeCategoryReviews() {
    // Fetch both simultaneously to save time
    const [mReviews, tvReviews] = await Promise.all([
        fetchArticlesByCategory('movie-reviews', 4),
        fetchArticlesByCategory('tv-reviews', 3)
    ]);

    // Movie Reviews - 4-post Slider
    const movieSlider = document.getElementById('dynamic-movie-reviews');
    if (movieSlider) {
        if (mReviews.length > 0) {
            let currentSlide = 0;

            const renderSlide = (idx) => {
                const rev = mReviews[idx];
                const img = optimizeImage(rev.cover_image || FALLBACK_IMAGE, 500);
                return `
                    <div class="movie-slider card" onclick="window.location.href='article.html?slug=${rev.slug}'" style="cursor:pointer;">
                        <img src="${img}" alt="${rev.title}" loading="lazy">
                        <div class="card-content">
                            <h3>${rev.title}</h3>
                        </div>
                        <div class="slider-nav">
                            <button class="nav-btn" id="slider-prev" onclick="event.stopPropagation();">&#10094;</button>
                            <button class="nav-btn" id="slider-next" onclick="event.stopPropagation();">&#10095;</button>
                        </div>
                        <div class="slider-dots" style="position:absolute;bottom:15px;left:50%;transform:translateX(-50%);display:flex;gap:6px;z-index:2;">
                            ${mReviews.map((_, i) => `<span style="width:8px;height:8px;border-radius:50%;background:${i===idx?'#bfa175':'rgba(255,255,255,0.4)'};display:inline-block;transition:background 0.3s;"></span>`).join('')}
                        </div>
                    </div>
                `;
            };

            movieSlider.innerHTML = renderSlide(currentSlide);

            const setupButtons = () => {
                const prevBtn = document.getElementById('slider-prev');
                const nextBtn = document.getElementById('slider-next');
                if (prevBtn) {
                    prevBtn.addEventListener('click', () => {
                        currentSlide = (currentSlide - 1 + mReviews.length) % mReviews.length;
                        movieSlider.innerHTML = renderSlide(currentSlide);
                        setupButtons();
                    });
                }
                if (nextBtn) {
                    nextBtn.addEventListener('click', () => {
                        currentSlide = (currentSlide + 1) % mReviews.length;
                        movieSlider.innerHTML = renderSlide(currentSlide);
                        setupButtons();
                    });
                }
            };
            setupButtons();

            // Auto-advance every 5 seconds
            setInterval(() => {
                currentSlide = (currentSlide + 1) % mReviews.length;
                movieSlider.innerHTML = renderSlide(currentSlide);
                setupButtons();
            }, 5000);
        } else {
            movieSlider.innerHTML = '<p style="color:#a0a5b1; padding:20px;">No movie reviews yet.</p>';
        }
    }

    // TV Reviews
    const tvList = document.getElementById('dynamic-tv-reviews');
    if (tvList) {
        tvList.innerHTML = tvReviews.length > 0 ? tvReviews.map(rev => {
            const img = optimizeImage(rev.cover_image || FALLBACK_IMAGE, 500);
            return `
                <article class="review-item" onclick="window.location.href='article.html?slug=${rev.slug}'" style="cursor:pointer;">
                    <img src="${img}" alt="${rev.title}" loading="lazy">
                    <div class="review-info">
                        <h3>${rev.title}</h3>
                    </div>
                </article>
            `;
        }).join('') : '<p style="color:#a0a5b1; padding:20px;">No TV reviews yet.</p>';
    }
}

async function initTopStoriesPage() {
    const heroContainer = document.getElementById('dynamic-top-story-hero');
    const gridContainer = document.getElementById('dynamic-top-stories-grid');
    if (!heroContainer || !gridContainer) return;

    const articles = await fetchArticlesByCategory('top-stories', 15);
    
    if (articles.length === 0) {
        heroContainer.innerHTML = '<p style="color:#a0a5b1; padding: 40px;">No top stories published yet.</p>';
        return;
    }

    // Hero Article (1st)
    const hero = articles[0];
    const heroDate = formatDate(hero.created_at);
    
    // Side stories (Next 4)
    const sideStories = articles.slice(1, 5);
    let sideStoriesHtml = sideStories.map(a => `
        <div class="side-article" onclick="window.location.href='article.html?slug=${a.slug}'">
            <img src="${optimizeImage(a.cover_image || FALLBACK_IMAGE, 500)}" alt="${a.title}" loading="lazy">
            <div class="info"><span class="tag">Top Story</span><h3>${a.title}</h3></div>
        </div>
    `).join('');

    heroContainer.innerHTML = `
        <div class="hero-article" onclick="window.location.href='article.html?slug=${hero.slug}'">
            <img src="${optimizeImage(hero.cover_image || FALLBACK_IMAGE, 500)}" alt="${hero.title}" fetchpriority="high">
            <div class="overlay">
                <span class="tag">Top Story</span>
                <h2>${hero.title}</h2>
                <div class="meta">By Admin &nbsp;|&nbsp; ${heroDate}</div>
            </div>
        </div>
        <div class="side-stories">
            ${sideStoriesHtml}
        </div>
    `;

    // Grid (Remaining)
    const gridStories = articles.slice(5);
    if (gridStories.length > 0) {
        gridContainer.innerHTML = gridStories.map(a => `
            <div class="article-card" onclick="window.location.href='article.html?slug=${a.slug}'">
                <img src="${optimizeImage(a.cover_image || FALLBACK_IMAGE, 500)}" alt="${a.title}" loading="lazy">
                <div class="article-info">
                    <span class="tag">Top Story</span>
                    <h3>${a.title}</h3>
                    <div class="meta">${formatDate(a.created_at)}</div>
                </div>
            </div>
        `).join('');
    } else {
        gridContainer.innerHTML = '';
    }
}

async function initCategoryPage(slug) {
    const grid = document.getElementById('category-grid');
    if (!grid) return;

    grid.innerHTML = '<p style="color:#fff;">Loading articles...</p>';
    const articles = await fetchArticlesByCategory(slug, 50);

    if (articles.length === 0) {
        grid.innerHTML = '<p style="color:#a0a5b1;">No articles found in this category yet.</p>';
        return;
    }

    grid.innerHTML = articles.map(renderGridCard).join('');
}

function getYouTubeId(url) {
    const match = url.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([a-zA-Z0-9_-]{11})/);
    return match ? match[1] : null;
}

async function initTrailersPage() {
    const grid = document.getElementById('trailers-grid');
    if (!grid) return;

    grid.innerHTML = '<p style="color:#fff;">Loading trailers...</p>';
    const trailers = await fetchTrailers();

    if (trailers.length === 0) {
        grid.innerHTML = '<p style="color:#a0a5b1;">No trailers found yet.</p>';
        return;
    }

    grid.innerHTML = trailers.map(t => {
        const ytId = getYouTubeId(t.yt_url);
        const thumbUrl = ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : FALLBACK_IMAGE;
        return `
            <div class="trailer-item" onclick="openVideoModal('${ytId}')">
                <div class="trailer-thumb">
                    <img src="${thumbUrl}" alt="${t.title}" loading="lazy">
                    <div class="play-overlay">&#9654;</div>
                    <span class="yt-badge">&#9654; YouTube</span>
                </div>
                <div class="trailer-info">
                    <span class="tag">${t.category_label || t.category}</span>
                    <h3>${t.title}</h3>
                </div>
            </div>
        `;
    }).join('');
}

async function initArticlePage() {
    const slug = getUrlParam('slug');
    if (!slug) {
        document.getElementById('article-title').textContent = "Article Not Found";
        document.getElementById('article-content').innerHTML = "<p>No article link was provided.</p>";
        return;
    }

    const article = await fetchArticleBySlug(slug);
    if (!article) {
        document.getElementById('article-title').textContent = "Article Not Found";
        document.getElementById('article-content').innerHTML = "<p>The requested article could not be found.</p>";
        return;
    }

    // --- Dynamic SEO Updates ---
    document.title = `${article.title} - NetCinema News`;
    
    // Extract a plain text snippet from HTML content for description
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = article.content;
    const plainTextContent = tempDiv.textContent || tempDiv.innerText || "";
    const metaDescription = plainTextContent.substring(0, 150).trim() + "...";

    const metaDescElem = document.querySelector('meta[name="description"]');
    if (metaDescElem) metaDescElem.setAttribute("content", metaDescription);

    const ogTitleElem = document.querySelector('meta[property="og:title"]');
    if (ogTitleElem) ogTitleElem.setAttribute("content", `${article.title} - NetCinema News`);

    const ogDescElem = document.querySelector('meta[property="og:description"]');
    if (ogDescElem) ogDescElem.setAttribute("content", metaDescription);

    const twTitleElem = document.querySelector('meta[name="twitter:title"]');
    if (twTitleElem) twTitleElem.setAttribute("content", `${article.title} - NetCinema News`);

    const twDescElem = document.querySelector('meta[name="twitter:description"]');
    if (twDescElem) twDescElem.setAttribute("content", metaDescription);
    
    if (article.cover_image) {
        const ogImageElem = document.querySelector('meta[property="og:image"]');
        if (ogImageElem) ogImageElem.setAttribute("content", article.cover_image);

        const twImageElem = document.querySelector('meta[name="twitter:image"]');
        if (twImageElem) twImageElem.setAttribute("content", article.cover_image);
    }
    // ---------------------------

    // Set Hero Background
    const hero = document.getElementById('article-hero');
    if (hero && article.cover_image) {
        hero.style.backgroundImage = `url('${article.cover_image}')`;
    }

    // Set Text Fields
    document.getElementById('article-title').textContent = article.title;
    document.getElementById('article-date').textContent = `ON ${formatDate(article.created_at).toUpperCase()}`;

    // ======= Dynamic SEO Tags Update =======
    const articleUrl = `https://netcinemanews.live/article?slug=${article.slug}`;
    const articleImage = article.cover_image || 'https://netcinemanews.live/favicon.png';
    const articleDesc = article.summary || 'Movie Reviews & News - NetCinema News';

    // Page title
    document.title = `${article.title} - NetCinema News`;

    // Canonical
    const canonicalEl = document.getElementById('canonical-url');
    if (canonicalEl) canonicalEl.setAttribute('href', articleUrl);

    // OG Tags
    const ogUrl = document.getElementById('og-url');
    const ogTitle = document.getElementById('og-title');
    const ogDesc = document.getElementById('og-description');
    const ogImage = document.getElementById('og-image');
    if (ogUrl) ogUrl.setAttribute('content', articleUrl);
    if (ogTitle) ogTitle.setAttribute('content', article.title);
    if (ogDesc) ogDesc.setAttribute('content', articleDesc);
    if (ogImage) ogImage.setAttribute('content', articleImage);

    // Twitter Tags
    const twUrl = document.getElementById('twitter-url');
    const twTitle = document.getElementById('twitter-title');
    const twDesc = document.getElementById('twitter-description');
    const twImage = document.getElementById('twitter-image');
    if (twUrl) twUrl.setAttribute('content', articleUrl);
    if (twTitle) twTitle.setAttribute('content', article.title);
    if (twDesc) twDesc.setAttribute('content', articleDesc);
    if (twImage) twImage.setAttribute('content', articleImage);
    // ======= End SEO Tags =======

    // Category mapping
    let catLabel = article.category.toUpperCase().replace('-', ' ');
    document.getElementById('article-category').textContent = `IN ${catLabel}`;

    // Breadcrumbs
    document.getElementById('breadcrumb-category').textContent = catLabel;
    document.getElementById('breadcrumb-category').href = `${article.category}.html`;
    document.getElementById('breadcrumb-title').textContent = article.title.toUpperCase();

    // Content
    // Assuming content is HTML (from Quill)
    const contentEl = document.getElementById('article-content');
    contentEl.innerHTML = article.content;
    
    // Auto-fix timeline tables with empty trailing headers
    contentEl.querySelectorAll('table thead tr').forEach(tr => {
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

    // Load dynamic Movie News widget
    const movieNewsContainer = document.getElementById('dynamic-article-movie-news');
    if (movieNewsContainer) {
        const latestMovieNews = await fetchArticlesByCategory('movie-news', 1);
        if (latestMovieNews.length > 0) {
            const news = latestMovieNews[0];
            const img = optimizeImage(news.cover_image || FALLBACK_IMAGE, 500);
            const dateStr = formatDate(news.created_at).toUpperCase();
            movieNewsContainer.innerHTML = `
                <div class="breaking-card" onclick="window.location.href='article.html?slug=${news.slug}'" style="cursor:pointer;">
                    <img src="${img}" alt="${news.title}" loading="lazy">
                    <div class="breaking-info">
                        <span class="category-tag">MOVIE NEWS</span>
                        <h3>${news.title}</h3>
                        <span class="date">${dateStr}</span>
                    </div>
                </div>
            `;
        } else {
            movieNewsContainer.style.display = 'none';
        }
    }

    // Load dynamic Latest Posts widget
    const latestPostsContainer = document.getElementById('dynamic-article-latest-posts');
    if (latestPostsContainer) {
        const latestPosts = await fetchLatestArticles(4);
        latestPostsContainer.innerHTML = latestPosts.map(post => {
            const img = optimizeImage(post.cover_image || FALLBACK_IMAGE, 500);
            const dateStr = formatDate(post.created_at).toUpperCase();
            return `
                <div class="popular-item" onclick="window.location.href='article.html?slug=${post.slug}'" style="cursor:pointer;">
                    <img src="${img}" alt="${post.title}" loading="lazy">
                    <div class="popular-info">
                        <h4>${post.title}</h4>
                        <span class="date">${dateStr}</span>
                    </div>
                </div>
            `;
        }).join('');
    }

    // Load Related Posts and Post Navigation
    const catArticles = await fetchArticlesByCategory(article.category, 20);
    const otherArticles = catArticles.filter(a => a.id !== article.id);
    
    // Related Posts (3 random or newest)
    const relatedContainer = document.getElementById('dynamic-related-posts');
    if (relatedContainer) {
        const related = otherArticles.slice(0, 3);
        if (related.length > 0) {
            relatedContainer.innerHTML = related.map(r => `
                <div class="related-card" onclick="window.location.href='article.html?slug=${r.slug}'" style="cursor:pointer;">
                    <img src="${optimizeImage(r.cover_image || FALLBACK_IMAGE, 500)}" alt="${r.title}" loading="lazy">
                    <div class="related-info">
                        <h4>${r.title}</h4>
                        <span class="date">${formatDate(r.created_at)}</span>
                    </div>
                </div>
            `).join('');
        } else {
            document.querySelector('.related-posts').style.display = 'none';
        }
    }

    // Post Navigation (Prev/Next)
    const currentIndex = catArticles.findIndex(a => a.id === article.id);
    
    const prevPostElem = document.getElementById('dynamic-prev-post');
    if (prevPostElem && currentIndex < catArticles.length - 1 && currentIndex !== -1) {
        const prevPost = catArticles[currentIndex + 1]; // older post
        prevPostElem.querySelector('img').src = optimizeImage(prevPost.cover_image || FALLBACK_IMAGE, 500);
        prevPostElem.querySelector('h4').textContent = prevPost.title;
        prevPostElem.href = `article.html?slug=${prevPost.slug}`;
        prevPostElem.style.visibility = 'visible';
    }

    const nextPostElem = document.getElementById('dynamic-next-post');
    if (nextPostElem && currentIndex > 0) {
        const nextPost = catArticles[currentIndex - 1]; // newer post
        nextPostElem.querySelector('img').src = optimizeImage(nextPost.cover_image || FALLBACK_IMAGE, 500);
        nextPostElem.querySelector('h4').textContent = nextPost.title;
        nextPostElem.href = `article.html?slug=${nextPost.slug}`;
        nextPostElem.style.visibility = 'visible';
    }
}

// =========================================
// Video Modal Logic
// =========================================
function openVideoModal(videoId) {
    const modal = document.getElementById('videoModal');
    const iframe = document.getElementById('videoIframe');
    if (modal && iframe) {
        iframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1`;
        modal.style.display = 'flex';
    }
}

function closeVideoModal() {
    const modal = document.getElementById('videoModal');
    const iframe = document.getElementById('videoIframe');
    if (modal && iframe) {
        iframe.src = '';
        modal.style.display = 'none';
    }
}

window.onclick = function (event) {
    const modal = document.getElementById('videoModal');
    if (event.target == modal) closeVideoModal();
}

// =========================================
// Router / Entry Point
// =========================================
document.addEventListener('DOMContentLoaded', () => {
    
    // Hamburger Menu Logic
    const headerNav = document.querySelector('.header-nav');
    if (headerNav) {
        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'menu-toggle';
        toggleBtn.setAttribute('aria-label', 'Toggle Navigation Menu');
        toggleBtn.innerHTML = '&#9776;';
        
        headerNav.parentNode.insertBefore(toggleBtn, headerNav);
        
        toggleBtn.addEventListener('click', () => {
            headerNav.classList.toggle('active');
        });
    }

    const path = window.location.pathname;

    // Simple router based on filename or clean URL
    if (path.includes('index') || path === '/' || path.endsWith('/')) {
        initHomePage();
    }
    else if (path.includes('movie-reviews')) {
        initCategoryPage('movie-reviews');
    }
    else if (path.includes('tv-reviews')) {
        initCategoryPage('tv-reviews');
    }
    else if (path.includes('celebs')) {
        initCategoryPage('celebs');
    }
    else if (path.includes('top-stories')) {
        initTopStoriesPage();
    }
    else if (path.includes('movie-news')) {
        initCategoryPage('movie-news');
    }
    else if (path.includes('trailers')) {
        initTrailersPage();
    }
    else if (path.includes('article')) {
        initArticlePage();
    }
});


