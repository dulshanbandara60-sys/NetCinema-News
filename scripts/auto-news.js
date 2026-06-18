const Parser = require('rss-parser');
const { createClient } = require('@supabase/supabase-js');
const { google } = require('googleapis');
const fs = require('fs');

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const parser = new Parser({
    customFields: {
        item: [
            ['media:content', 'mediaContent', { keepArray: true }],
            ['enclosure', 'enclosure']
        ]
    }
});

const RSS_FEEDS = [
    { category: 'movie-news', url: 'https://news.google.com/rss/search?q=movie+news+when:24h&hl=en-US&gl=US&ceid=US:en' },
    { category: 'movie-reviews', url: 'https://news.google.com/rss/search?q=movie+review+when:24h&hl=en-US&gl=US&ceid=US:en' },
    { category: 'tv-reviews', url: 'https://news.google.com/rss/search?q=tv+show+review+when:24h&hl=en-US&gl=US&ceid=US:en' },
    { category: 'celebs', url: 'https://news.google.com/rss/search?q=hollywood+celebrity+news+when:24h&hl=en-US&gl=US&ceid=US:en' }
];

function generateSlug(title) {
    return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
}

async function checkArticleExists(slug) {
    const { data } = await supabase.from('articles').select('id').eq('slug', slug).single();
    return !!data;
}

async function notifyGoogleIndex(url) {
    if (!process.env.GOOGLE_CREDENTIALS) {
        console.log("No GOOGLE_CREDENTIALS found, skipping Indexing API.");
        return;
    }

    try {
        const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
        const jwtClient = new google.auth.JWT(
            credentials.client_email,
            null,
            credentials.private_key,
            ["https://www.googleapis.com/auth/indexing"],
            null
        );

        await jwtClient.authorize();

        const indexing = google.indexing({ version: 'v3', auth: jwtClient });
        
        console.log(`Pinging Google Indexing API for: ${url}`);
        const response = await indexing.urlNotifications.publish({
            requestBody: {
                url: url,
                type: 'URL_UPDATED'
            }
        });
        
        console.log(`Google Indexing API response status: ${response.status}`);
    } catch (e) {
        console.error("Failed to notify Google Indexing API:", e.message);
    }
}

async function humanizeArticle(title, description, creator, targetCategory, retries = 3) {
    const prompt = `
You are a top-tier entertainment journalist for "NetCinema News". Rewrite the following news snippet into a highly engaging, humanized, and SEO-friendly article for the category: "${targetCategory}".
CRITICAL RULES:
1. You MUST include all the real facts, names, and details from the provided snippet. DO NOT invent fake news.
2. The provided snippet is very short. You MUST use your expansive knowledge about movies, TV shows, and celebrities to expand this into a comprehensive, detailed article aiming for around 600 words. Provide background context, previous movies of the actors/directors, or fan expectations.
3. Make it sound exciting, professional, and unique. 
4. Identify and naturally integrate high-volume SEO ranking keywords related to the movie, actors, or topic throughout the article to maximize Google Search visibility.
5. Do not mention the original source like Google News.
6. Use HTML tags for formatting (e.g., <p>, <h2>, <strong>, <ul>, <li>).
7. DO NOT include <!DOCTYPE html>, <html>, <head>, or <body> tags. Only output the inner HTML content.
8. [ANTI-AI DETECTION]: You must write with high burstiness and high perplexity. Vary your sentence lengths dramatically. Use a highly conversational and engaging tone. Include occasional colloquialisms or natural human nuances. Avoid repetitive AI transition words like 'Furthermore', 'In conclusion', or 'Ultimately'. Write as if you are a passionate human movie fan talking to a friend.
9. IF the snippet is primarily about Video Games or Gaming Consoles, return an empty string for htmlContent.

IMPORTANT: You must return the response strictly as a JSON object with TWO fields:\n1. "title": A new, catchy, SEO-friendly title for the article. DO NOT include the original source name (e.g., remove "The Hollywood Reporter" or "Variety").\n2. "htmlContent": The raw HTML of the rewritten article.

Original Title: ${title}
Original Snippet: ${description}
`;

    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${OPENAI_API_KEY}`,
                    "HTTP-Referer": "https://netcinemanews.live",
                    "X-Title": "NetCinema News Automation"
                },
                body: JSON.stringify({
                    model: "openrouter/free", 
                    response_format: { type: "json_object" },
                    messages: [{ role: "user", content: prompt }],
                    temperature: 0.7,
                    max_tokens: 3000
                })
            });

            if (!response.ok) {
                throw new Error(`OpenAI API error: ${await response.text()}`);
            }

            const jsonResponse = await response.json();
            let resultText = jsonResponse.choices[0].message.content.trim();
            
            // Clean up common markdown formatting if the model wrapped it in ```json
            if (resultText.startsWith('\`\`\`json')) {
                resultText = resultText.replace(/^\`\`\`json/, '').replace(/\`\`\`$/, '').trim();
            } else if (resultText.startsWith('\`\`\`')) {
                resultText = resultText.replace(/^\`\`\`/, '').replace(/\`\`\`$/, '').trim();
            }

            const parsed = JSON.parse(resultText);
            return {
                category: targetCategory,
                title: parsed.title || title.split(" - ")[0],
                content: parsed.htmlContent || ""'
            };
        } catch (e) {
            console.error(`Attempt ${attempt} failed to generate valid JSON:`, e.message);
            if (attempt === retries) {
                throw new Error("Failed to generate valid article after multiple attempts.");
            }
            console.log("Retrying...");
            // Wait 2 seconds before retrying
            await new Promise(r => setTimeout(r, 2000));
        }
    }
}

async function generateRSSFeed() {
    console.log("Generating RSS Feed...");
    const { data: articles, error } = await supabase
        .from('articles')
        .select('title, slug, created_at, cover_image, category')
        .eq('status', 'published')
        .order('created_at', { ascending: false })
        .limit(20);

    if (error) {
        console.error("Failed to fetch articles for RSS:", error.message);
        return;
    }

    let rssContent = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/">
<channel>
    <title>NetCinema News</title>
    <link>https://netcinemanews.live</link>
    <description>The ultimate source for the latest movie reviews, breaking entertainment news, and box office updates.</description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
`;

    for (const article of articles) {
        const url = `https://netcinemanews.live/article?slug=${article.slug}`;
        const pubDate = new Date(article.created_at).toUTCString();
        const imageUrl = article.cover_image || 'https://netcinemanews.live/favicon.png';
        const safeTitle = article.title.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const safeCategory = article.category.replace(/-/g, ' ');

        rssContent += `
    <item>
        <title>${safeTitle}</title>
        <link>${url}</link>
        <guid>${url}</guid>
        <pubDate>${pubDate}</pubDate>
        <category>${safeCategory}</category>
        <media:content url="${imageUrl}" medium="image" />
    </item>`;
    }

    rssContent += `
</channel>
</rss>`;

    fs.writeFileSync('rss.xml', rssContent, 'utf8');
    console.log("rss.xml generated successfully.");
}

async function run() {
    try {
        if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !OPENAI_API_KEY) {
            throw new Error("Missing environment variables. Please configure SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and OPENAI_API_KEY.");
        }

        console.log("Starting Auto-News Fetcher...");
        let newArticleImported = false;

        for (const feedConfig of RSS_FEEDS) {
            if (newArticleImported) break;
            
            console.log(`Fetching RSS for ${feedConfig.category}: ${feedConfig.url}`);
            const feed = await parser.parseURL(feedConfig.url);

            for (const item of feed.items) {
                if (!item.title) continue;

                const slug = generateSlug(item.title);
                const exists = await checkArticleExists(slug);

                if (!exists) {
                    console.log(`Found new article: ${item.title}`);
                    
                    console.log("Humanizing content with AI...");
                    const aiResult = await humanizeArticle(item.title, item.content || item.contentSnippet || item.description || '', item.creator || '', feedConfig.category);

                    let imageUrl = '';
                    if (item.mediaContent && item.mediaContent.length > 0) {
                        imageUrl = item.mediaContent[0].$.url;
                    } else if (item.enclosure && item.enclosure.url) {
                        imageUrl = item.enclosure.url;
                    } else {
                        const cleanTitle = (aiResult && aiResult.title) ? aiResult.title : item.title.split(" - ")[0];
                        const encodedTitle = encodeURIComponent(cleanTitle + " realistic cinematic movie photo");
                        imageUrl = `https://image.pollinations.ai/prompt/${encodedTitle}?width=800&height=450&nologo=true`;
                    }

                    if (!aiResult.content || aiResult.content.trim() === '') {
                        console.log("Article skipped (likely video game or AI declined to generate). Saved as ignored.");
                        const { error } = await supabase.from('articles').insert([{
                            title: aiResult.title || item.title.split(" - ")[0],
                            slug: slug,
                            category: aiResult.category,
                            cover_image: imageUrl,
                            content: 'Skipped content',
                            status: 'ignored'
                        }]);
                        continue;
                    }

                    console.log(`Target Category: ${aiResult.category}`);

                    console.log("Inserting into Supabase...");
                    const { error } = await supabase.from('articles').insert([{
                        title: aiResult.title || item.title.split(" - ")[0],
                        slug: slug,
                        category: aiResult.category,
                        cover_image: imageUrl,
                        content: aiResult.content,
                        status: 'published'
                    }]);

                    if (error) {
                        console.error("Supabase insert error:", error);
                        continue;
                    }
                    
                    console.log(`Successfully published: ${item.title}`);
                    
                    // Ping Google Indexing API
                    const publicUrl = `https://netcinemanews.live/article?slug=${slug}`;
                    await notifyGoogleIndex(publicUrl);

                    newArticleImported = true;
                    break; 
                }
            }
        }

        if (newArticleImported) {
            await generateRSSFeed();
            console.log("Auto-News Fetcher finished successfully.");
        } else {
            console.log("No new articles found across all feeds.");
        }

    } catch (error) {
        console.error("Error running auto-news:", error.message);
        process.exit(1);
    }
}

run();




