const { OpenAI } = require('openai');
const axios = require('axios');

// ==== Utilities ====
async function retry(fn, retries = 3) {
    try {
        return await fn();
    } catch (err) {
        if (retries === 0) throw err;
        console.log(`⚠️ Retrying... (${retries} retries left)`);
        await new Promise(r => setTimeout(r, 2000));
        return retry(fn, retries - 1);
    }
}

// ==== 1. Configuration & Validation ====
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const WP_URL = process.env.WP_URL; // e.g., https://kekondangan.id
const WP_USER = process.env.WP_USER;
const WP_APP_PASSWORD = process.env.WP_APP_PASSWORD;

if (!OPENAI_API_KEY || !WP_URL || !WP_USER || !WP_APP_PASSWORD) {
    console.error("❌ Missing required environment variables. Please check your GitHub Secrets.");
    process.exit(1);
}

const openai = new OpenAI({
    apiKey: OPENAI_API_KEY,
});

// ==== 2. Keyword Strategy ====
const KEYWORDS = [
    "tips memilih undangan pernikahan online",
    "contoh kata kata undangan pernikahan",
    "cara membuat undangan digital",
    "checklist persiapan pernikahan",
    "biaya undangan pernikahan online"
];

// Pick a random keyword
const targetedKeyword = KEYWORDS[Math.floor(Math.random() * KEYWORDS.length)];
console.log(`🎯 Target Keyword for today: "${targetedKeyword}"`);

// ==== 3. AI Content Generator ====
async function generateArticle(keyword) {
    console.log("✍️ Generating article with OpenAI...");

    const systemPrompt = `Kamu adalah seorang SEO copywriter profesional dan wedding expert di Indonesia.
Tugas kamu adalah menulis artikel SEO friendly untuk blog wedding (Kekondangan.id).
Target audiens: Calon pengantin di Indonesia.
Tone of voice: Natural, human-like, informatif, dan engaging.`;

    const userPrompt = `Buatkan artikel SEO dengan keyword utama: "${keyword}".
  
Syarat artikel:
1. Panjang: 900-1200 kata.
2. Struktur: 
   - Opening hook yang menarik.
   - Minimal 4 subheading (H2).
   - Gunakan bullet points/list jika relevan untuk mempermudah membaca.
   - Akhiri dengan FAQ section (minimal 3 pertanyaan).
   - Closing dengan Call To Action (CTA) yang natural ke layanan Kekondangan.id.
3. Wajib menyertakan minimal 1 internal link ke: https://kekondangan.id dengan anchor text yang natural.
4. Jangan melakukan keyword stuffing. Variasikan kata kunci secara natural.
5. Format konten di dalam key "content" harus berupa raw HTML5 (gunakan tag <h2>, <p>, <ul>, <li>, dst) tanpa tag <html>, <head>, atau <body>. Jangan gunakan tag H1 di dalam konten karena H1 akan diisi oleh judul post.

Berikan output secara spesifik dalam format JSON dengan struktur berikut:
{
  "title": "Judul artikel (H1) yang menarik (max 70 karakter)",
  "meta_description": "Meta description SEO friendly (maksimal 155 karakter)",
  "content": "Konten artikel full dalam format HTML bersih"
}`;

    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini", // Cost-effective model
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ],
            response_format: { type: "json_object" },
            temperature: 0.7,
        });

        const result = JSON.parse(response.choices[0].message.content);
        return result;
    } catch (error) {
        console.error("❌ Failed to generate article via OpenAI:", error.message);
        throw error;
    }
}

// ==== 4. WordPress Integration ====
async function postToWordPress(article) {
    console.log("🚀 Publishing draft to WordPress...");

    const { title, meta_description, content } = article;

    const slug = title
        .toLowerCase()
        .replace(/[^\w\s-]/g, "")
        .replace(/\s+/g, "-")
        .slice(0, 70);

    // Format the WordPress REST API endpoint
    const endpoint = `${WP_URL.replace(/\/$/, '')}/wp-json/wp/v2/posts`;

    // Create Basic Auth token
    const authToken = Buffer.from(`${WP_USER}:${WP_APP_PASSWORD}`).toString('base64');

    try {
        const response = await axios.post(
            endpoint,
            {
                title: title,
                content: content,
                excerpt: meta_description,
                slug: slug,
                status: "draft", // IMPORTANT: Must be draft
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Basic ${authToken}`
                }
            }
        );

        console.log("✅ Successfully created a draft post!");
        console.log(`🔗 Post URL (Draft): ${response.data.link}`);
        console.log(`📝 Title: ${response.data.title.rendered}`);
        return response.data;
    } catch (error) {
        console.error("❌ Failed to post to WordPress.");
        if (error.response) {
            console.error(`WP API Error (${error.response.status}):`, error.response.data);
        } else {
            console.error(error.message);
        }
        throw error;
    }
}

// ==== Main Workflow ====
async function main() {
    try {
        // Random delay (0-2 minutes) to act naturally
        const delay = Math.floor(Math.random() * 120000);
        console.log(`⏳ Waiting for ${Math.round(delay / 1000)} seconds before generating...`);
        await new Promise(r => setTimeout(r, delay));

        const article = await retry(() => generateArticle(targetedKeyword));

        // Validate output
        if (!article || !article.title || !article.content) {
            throw new Error("❌ AI output is invalid or missing required fields");
        }

        console.log("📝 Generation complete. Validation:");
        console.log(`- Title length: ${article.title.length} chars`);
        console.log(`- Meta desc length: ${article.meta_description?.length || 0} chars`);

        // Meta desc length validation (informational)
        if (article.meta_description && article.meta_description.length > 155) {
            console.warn("⚠️ Warning: Meta description is longer than 155 characters.");
        }

        await retry(() => postToWordPress(article));
        console.log("🎉 All tasks completed successfully.");

    } catch (error) {
        console.error("❌ Execution failed.");
        process.exit(1);
    }
}

main();
