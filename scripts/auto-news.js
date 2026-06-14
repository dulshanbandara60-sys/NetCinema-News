const Parser = require('rss-parser');
const { createClient } = require('@supabase/supabase-js');

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
    'https://screenrant.com/feed/',
    'https://collider.com/feed/'
];

function generateSlug(title) {
    return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
}

async function checkArticleExists(slug) {
    const { data } = await supabase.from('articles').select('id').eq('slug', slug).single();
    return !!data;
}

async function humanizeArticle(title, description, creator) {
    const prompt = `
You are a top-tier movie news journalist for "NetCinema News". Rewrite the following news article into a highly engaging, humanized, and SEO-friendly article.
CRITICAL RULES:
1. You MUST include all the real facts, names, and details from the original article. Do not invent fake news.
2. The article MUST be extremely detailed and long. It MUST contain at least 1000 words. Expand on the context, background, and implications of the news to reach this length.
3. Make it sound exciting, professional, and unique. 
4. Do not mention the original source like ScreenRant or Collider.
5. Use HTML tags for formatting (e.g., <p>, <h2>, <strong>, <ul>, <li>).

IMPORTANT: You must return the response strictly as a JSON object with two fields:
1. "category": Choose the most appropriate category from this exact list: 'movie-news', 'movie-reviews', 'tv-reviews', 'celebs', 'trailers'.
2. "htmlContent": The raw HTML of the rewritten article.

Original Title: ${title}
Original Content: ${description}
`;

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${OPENAI_API_KEY}`, // Now using OpenRouter Key
            "HTTP-Referer": "https://netcinemanews.live", // Required for OpenRouter
            "X-Title": "NetCinema News Automation"
        },
        body: JSON.stringify({
            model: "openrouter/free", // Automatically uses an available free model
            response_format: { type: "json_object" },
            messages: [{ role: "user", content: prompt }],
            temperature: 0.7,
            max_tokens: 3500
        })
    });

    if (!response.ok) {
        throw new Error(`OpenAI API error: ${await response.text()}`);
    }

    const jsonResponse = await response.json();
    const resultText = jsonResponse.choices[0].message.content.trim();
    
    try {
        const parsed = JSON.parse(resultText);
        return {
            category: parsed.category || 'movie-news',
            content: parsed.htmlContent || ''
        };
    } catch (e) {
        console.error("Failed to parse JSON from OpenAI:", resultText);
        throw e;
    }
}

async function run() {
    try {
        if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !OPENAI_API_KEY) {
            throw new Error("Missing environment variables. Please configure SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and OPENAI_API_KEY.");
        }

        console.log("Starting Auto-News Fetcher...");
        let newArticleImported = false;

        for (const feedUrl of RSS_FEEDS) {
            if (newArticleImported) break;
            
            console.log(`Fetching RSS: ${feedUrl}`);
            const feed = await parser.parseURL(feedUrl);

            for (const item of feed.items) {
                if (!item.title) continue;

                const slug = generateSlug(item.title);
                const exists = await checkArticleExists(slug);

                if (!exists) {
                    console.log(`Found new article: ${item.title}`);
                    
                    let imageUrl = '';
                    if (item.mediaContent && item.mediaContent.length > 0) {
                        imageUrl = item.mediaContent[0].$.url;
                    } else if (item.enclosure && item.enclosure.url) {
                        imageUrl = item.enclosure.url;
                    } else {
                        imageUrl = 'https://via.placeholder.com/800x450?text=NetCinema+News';
                    }

                    console.log("Humanizing content with AI...");
                    const aiResult = await humanizeArticle(item.title, item.content || item.contentSnippet || '', item.creator || '');

                    console.log(`Determined Category: ${aiResult.category}`);

                    console.log("Inserting into Supabase...");
                    const { error } = await supabase.from('articles').insert([{
                        title: item.title,
                        slug: slug,
                        category: aiResult.category,
                        cover_image: imageUrl,
                        content: aiResult.content,
                        status: 'published'
                    }]);

                    if (error) throw error;

                    console.log(`Successfully published: ${item.title}`);
                    newArticleImported = true;
                    break; 
                }
            }
        }

        if (!newArticleImported) {
            console.log("No new articles found across all feeds.");
        } else {
            console.log("Auto-News Fetcher finished successfully.");
        }

    } catch (error) {
        console.error("Error running auto-news:", error.message);
        process.exit(1);
    }
}

run();
