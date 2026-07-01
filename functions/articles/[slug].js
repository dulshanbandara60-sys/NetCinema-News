export async function onRequestGet(context) {
    const { request, env, params } = context;
    const slug = params.slug;

    if (!slug) {
        return context.next();
    }

    const SUPABASE_URL = 'https://vonltpyxqdfzuobphfxv.supabase.co';
    const SUPABASE_KEY = 'sb_publishable_6rBCcEVqoBVraBcc5duxrA_dkbOaB-H';

    try {
        // Fetch article data from Supabase REST API
        const dbUrl = `${SUPABASE_URL}/rest/v1/articles?slug=eq.${encodeURIComponent(slug)}&select=*`;
        const dbResponse = await fetch(dbUrl, {
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`
            }
        });

        const data = await dbResponse.json();

        if (!data || data.length === 0) {
            return new Response('Article not found', { status: 404 });
        }

        const article = data[0];
        
        // Use the original article.html as the template
        // We fetch it locally via the env.ASSETS binding
        const templateUrl = new URL(request.url);
        templateUrl.pathname = '/article.html';
        const templateResponse = await env.ASSETS.fetch(templateUrl);
        let html = await templateResponse.text();

        const fullUrl = `https://netcinemanews.live/articles/${slug}`;
        const imgUrl = article.cover_image || 'https://netcinemanews.live/favicon.png';
        const desc = (article.summary || '').replace(/"/g, '&quot;');
        const title = (article.title || '').replace(/"/g, '&quot;');
        
        // Generate the SSR SEO tags
        const seoTags = `
            <link rel="canonical" href="${fullUrl}" id="canonical-url">
            <meta property="og:url" content="${fullUrl}" id="og-url">
            <meta property="og:title" content="${title} - NetCinema News" id="og-title">
            <meta property="og:description" content="${desc}" id="og-description">
            <meta property="og:image" content="${imgUrl}" id="og-image">
            <meta name="twitter:url" content="${fullUrl}" id="twitter-url">
            <meta name="twitter:title" content="${title} - NetCinema News" id="twitter-title">
            <meta name="twitter:description" content="${desc}" id="twitter-description">
            <meta name="twitter:image" content="${imgUrl}" id="twitter-image">
        `;

        // Inject SEO tags into the <head>
        html = html.replace('<!-- INJECT_SEO_HERE -->', seoTags);
        html = html.replace('<title id="page-title">Article - NetCinema News</title>', `<title id="page-title">${title} - NetCinema News</title>`);
        
        // Inject the content into the article body for Googlebot to see immediately
        // The script.js will still run and hydrate it, but Googlebot doesn't need to wait
        const contentHTML = `
            <h1 class="article-title">${article.title}</h1>
            <div class="article-meta">
                <span class="article-category" id="article-category">IN ${article.category.toUpperCase().replace('-', ' ')}</span>
                <span class="article-date">${new Date(article.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                <span class="article-author-name">By ${article.author}</span>
            </div>
            ${article.cover_image ? `<img src="${article.cover_image}" alt="${article.title}" class="article-main-image">` : ''}
            <div class="article-body">
                ${article.content}
            </div>
        `;
        
        html = html.replace('<!-- INJECT_CONTENT_HERE -->', contentHTML);

        return new Response(html, {
            headers: {
                'Content-Type': 'text/html;charset=UTF-8'
            }
        });

    } catch (err) {
        console.error(err);
        return context.next();
    }
}
