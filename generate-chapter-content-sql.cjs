// generate-chapter-content-sql.js
//
// Run locally with Node from your project root:
//   node generate-chapter-content-sql.js > import-chapter-content.sql
//
// Reads every chapter JSON file under src/data/<subject>/*.json and produces
// SQL INSERT statements for the new chapter_content D1 table — one row per
// chapter, with all answers/explanations/tables packed into a JSON blob.
//
// This does NOT modify your existing src/data/ files. They stay exactly as
// they are for authoring. This script only extracts a copy of the answer
// data into a form the Worker can serve securely.

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'src', 'data');

function escapeSql(str) {
  return str.replace(/'/g, "''");
}

function main() {
  const subjectFolders = fs.readdirSync(DATA_DIR).filter((f) =>
    fs.statSync(path.join(DATA_DIR, f)).isDirectory()
  );

  const statements = [];

  for (const subjectFolder of subjectFolders) {
    const subjectPath = path.join(DATA_DIR, subjectFolder);
    const files = fs.readdirSync(subjectPath).filter((f) => f.endsWith('.json'));

    for (const file of files) {
      const raw = fs.readFileSync(path.join(subjectPath, file), 'utf-8');
      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch (err) {
        console.error(`// SKIPPED (invalid JSON): ${subjectFolder}/${file}`);
        continue;
      }

      const chapters = Array.isArray(parsed) ? parsed : [parsed];

      for (const ch of chapters) {
        if (!ch || !ch.slug || !Array.isArray(ch.faqs)) continue;

        const answersOnly = ch.faqs.map((f) => {
          const item = {
            a: f.a,
            e: f.e || '',
            table: f.table || null,
          };
          // MCQ-specific fields — only included when actually present, so
          // plain FAQ items (no type/options) stay exactly as before and
          // don't get extra "type":null clutter in the JSON blob.
          if (f.type === 'mcq' && f.options) {
            item.type = 'mcq';
            item.options = f.options;
            item.answer = f.answer;
          }
          return item;
        });

        const answersJson = escapeSql(JSON.stringify(answersOnly));
        const title = escapeSql(ch.title || '');
        const slug = escapeSql(ch.slug);
        const subjectId = escapeSql(subjectFolder);
        const chapterNumber = ch.chapterNumber || 0;

        statements.push(
          `INSERT INTO chapter_content (chapter_slug, subject_id, chapter_number, title, answers_json) ` +
          `VALUES ('${slug}', '${subjectId}', ${chapterNumber}, '${title}', '${answersJson}') ` +
          `ON CONFLICT(chapter_slug) DO UPDATE SET ` +
          `subject_id=excluded.subject_id, chapter_number=excluded.chapter_number, ` +
          `title=excluded.title, answers_json=excluded.answers_json;`
        );
      }
    }
  }

  console.log(`-- Generated ${statements.length} chapter_content rows`);
  console.log(statements.join('\n'));
}

main();
