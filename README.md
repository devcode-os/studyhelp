# తెలంగాణ చరిత్ర FAQs

Static Astro site for Telangana history exam FAQs. No server, no database — everything builds to static HTML at deploy time.

## Local setup

```
npm install
npm run dev
```
Open http://localhost:4321

## Add a new chapter

Edit `src/data/chapters.json` and add a new object to the array:

```json
{
  "slug": "chapter-2-kakatiyas",
  "chapterNumber": 2,
  "title": "కాకతీయులు",
  "faqs": [
    { "q": "question here", "a": "one word answer", "e": "optional explanation" }
  ]
}
```

Pages generate automatically at `/chapter-2-kakatiyas/` — no other code changes needed.

## Deploy: GitHub + Cloudflare Pages

1. Push this folder to a new GitHub repo:
```
git init
git add .
git commit -m "initial site"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/ts-history-faq.git
git push -u origin main
```

2. Go to Cloudflare dashboard -> Workers & Pages -> Create -> Pages -> Connect to Git
3. Select this repo
4. Build settings:
   - Framework preset: Astro
   - Build command: `npm run build`
   - Output directory: `dist`
5. Deploy. Every future `git push` auto-rebuilds and redeploys, no manual steps.

## Structure

```
src/
  data/chapters.json       <- all FAQ content lives here
  layouts/Layout.astro     <- shared page shell, Telugu font
  pages/index.astro        <- chapter list (home)
  pages/[slug]/index.astro <- one page per chapter, paginated accordion
  pages/search/index.astro <- search across all chapters
```
