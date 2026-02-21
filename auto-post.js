const { OpenAI } = require("openai");
const axios = require("axios");

// ==== Utilities ====
async function retry(fn, retries = 3) {
  try {
    return await fn();
  } catch (err) {
    if (retries === 0) throw err;
    console.log(`⚠️ Retrying... (${retries} retries left)`);
    await new Promise((r) => setTimeout(r, 2000));
    return retry(fn, retries - 1);
  }
}

// ==== 1. Configuration & Validation ====
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const WP_URL = process.env.WP_URL; // e.g., https://idgo.my.id
const WP_USER = process.env.WP_USER;
const WP_APP_PASSWORD = process.env.WP_APP_PASSWORD;

if (!OPENAI_API_KEY || !WP_URL || !WP_USER || !WP_APP_PASSWORD) {
  console.error(
    "❌ Missing required environment variables. Please check your GitHub Secrets."
  );
  process.exit(1);
}

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

// ==== 2. Keyword Strategy (IDGO TECH NICHE) ====
const KEYWORDS = [
  "cara membuat aplikasi flutter untuk pemula",
  "tips optimasi performa website wordpress",
  "cara deploy aplikasi ke hosting",
  "perbedaan frontend dan backend untuk pemula",
  "cara membuat website cepat dan SEO friendly",
];

const targetedKeyword =
  KEYWORDS[Math.floor(Math.random() * KEYWORDS.length)];

console.log(`🎯 Target Keyword for today: "${targetedKeyword}"`);

// ==== 3. AI Content Generator ====
async function generateArticle(keyword) {
  console.log("✍️ Generating article with OpenAI...");

  const systemPrompt = `Kamu adalah SEO tech writer profesional untuk blog developer Indonesia (IDGO).
Fokus pada topik: web development, WordPress, Flutter, hosting, dan teknologi web modern.
Target audiens: developer pemula hingga menengah di Indonesia.
Tone: natural, helpful, tidak kaku, tidak seperti AI.`;


  const userPrompt = `Buatkan artikel SEO dengan keyword utama: "${keyword}".

Syarat artikel:
1. Panjang: 900-1200 kata.
2. Struktur:
   - Opening hook kuat.
   - Minimal 4 subheading (H2).
   - Gunakan bullet/list jika relevan.
   - Tambahkan FAQ section (minimal 3 pertanyaan).
   - Closing dengan CTA natural ke IDGO.
3. Wajib menyertakan minimal 1 internal link ke: https://idgo.my.id dengan anchor natural.
4. Hindari keyword stuffing.
5. Konten HARUS berupa HTML bersih (tanpa <html>, <head>, <body>).
6. Jangan gunakan H1 di dalam content.

Output WAJIB JSON:

{
  "title": "Judul artikel (max 70 karakter)",
  "meta_description": "Meta description (max 155 karakter)",
  "content": "HTML artikel lengkap"
}`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });

    const result = JSON.parse(response.choices[0].message.content);
    return result;
  } catch (error) {
    console.error(
      "❌ Failed to generate article via OpenAI:",
      error.message
    );
    throw error;
  }
}

// ==== 4. WordPress Integration ====
async function postToWordPress(article) {
  console.log("🚀 Publishing draft to WordPress...");

  // 🔥 CLEANING (important)
  const cleanTitle = article.title?.trim();
  const cleanMeta = article.meta_description?.trim();
  const cleanContent = article.content?.trim();

  if (!cleanTitle || !cleanContent) {
    throw new Error("❌ Cleaned content invalid");
  }

  const slug = cleanTitle
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 70);

  const endpoint = `${WP_URL.trim().replace(/\/$/, "")}/wp-json/wp/v2/posts`;

  const authToken = Buffer.from(
    `${WP_USER}:${WP_APP_PASSWORD}`
  ).toString("base64");

  try {
    const response = await axios.post(
      endpoint,
      {
        title: cleanTitle,
        content: cleanContent,
        excerpt: cleanMeta,
        slug: slug,
        status: "draft",
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${authToken}`,
          "User-Agent": "IDGO-AutoBot/1.0",
        },
        timeout: 30000,
      }
    );

    console.log("✅ Successfully created a draft post!");
    console.log(`🔗 Draft URL: ${response.data.link}`);
    return response.data;
  } catch (error) {
    console.error("❌ Failed to post to WordPress.");
    if (error.response) {
      console.error(
        `WP API Error (${error.response.status}):`,
        error.response.data
      );
    } else {
      console.error(error.message);
    }
    throw error;
  }
}

// ==== Main Workflow ====
async function main() {
  try {
    const delay = Math.floor(Math.random() * 120000);
    console.log(
      `⏳ Waiting for ${Math.round(delay / 1000)} seconds before generating...`
    );
    await new Promise((r) => setTimeout(r, delay));

    const article = await retry(() =>
      generateArticle(targetedKeyword)
    );

    if (!article || !article.title || !article.content) {
      throw new Error("❌ AI output is invalid");
    }

    console.log("📝 Generation complete.");
    console.log(`- Title length: ${article.title.length}`);
    console.log(
      `- Meta length: ${article.meta_description?.length || 0}`
    );

    await retry(() => postToWordPress(article));

    console.log("🎉 All tasks completed successfully.");
  } catch (error) {
    console.error("❌ Execution failed.");
    process.exit(1);
  }
}

main();
