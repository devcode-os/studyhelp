// src/lib/currentAffairs.js
//
// Dedicated data layer for Current Affairs. Deliberately NOT wired into
// getSubjectMeta / the generic [subject]/[slug] chapter template — CA's
// browsing model (pick a time window across MONTHS, then read by SECTION)
// doesn't fit the chapter-grid pattern every other subject uses, so it gets
// its own small set of pages that all import from this one file. Change
// the data shape or loading rule here once; every CA page picks it up.
//
// Expects month files at: src/data/current-affairs/<slug>.json
// Each file is the clean nested shape produced by build_ca_month.py:
//   { slug, title, month, year, sections: { "SectionName": [faqObj, ...] } }

const MONTH_ORDER = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
];

function loadAllMonths() {
  const files = import.meta.glob('../data/current-affairs/*.json', { eager: true });
  const months = Object.values(files)
    .map((mod) => mod.default)
    .filter((m) => m && m.sections && typeof m.sections === 'object');

  months.sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year;
    return MONTH_ORDER.indexOf(b.month.toLowerCase()) - MONTH_ORDER.indexOf(a.month.toLowerCase());
  });

  return months;
}

// All months available, most recent first. Used by the picker page to
// render the "pick any N months" checkbox list.
export function listAvailableMonths() {
  return loadAllMonths().map((m) => ({
    slug: m.slug,
    month: m.month,
    year: m.year,
    label: `${m.month} ${m.year}`,
    sectionCount: Object.keys(m.sections).length,
    questionCount: Object.values(m.sections).reduce((sum, arr) => sum + arr.length, 0),
  }));
}

// Given a list of month slugs the student picked, return the merged
// section -> question-count map (for the "sections" view after picking).
export function getSectionsForMonths(monthSlugs) {
  const all = loadAllMonths().filter((m) => monthSlugs.includes(m.slug));
  const sectionMap = new Map();

  for (const monthData of all) {
    for (const [sectionName, items] of Object.entries(monthData.sections)) {
      if (!sectionMap.has(sectionName)) sectionMap.set(sectionName, []);
      sectionMap.get(sectionName).push(
        ...items.map((it) => ({ ...it, _month: monthData.month, _year: monthData.year }))
      );
    }
  }

  return Array.from(sectionMap.entries()).map(([name, items]) => ({
    name,
    slug: name.toLowerCase().replace(/&/g, 'and').replace(/\s+/g, '-'),
    count: items.length,
  }));
}

// Given month slugs + one section name, return the actual question list
// (for the reading page). Items carry _month/_year so the reader can show
// "August 2026" next to each question when multiple months are combined.
export function getQuestionsForSection(monthSlugs, sectionName) {
  const all = loadAllMonths().filter((m) => monthSlugs.includes(m.slug));
  const questions = [];

  for (const monthData of all) {
    const items = monthData.sections[sectionName];
    if (!items) continue;
    questions.push(...items.map((it) => ({ ...it, _month: monthData.month, _year: monthData.year })));
  }

  return questions;
}

// All distinct section names across every month (used for static path
// generation so every /current-affairs/read/<section>/ URL exists even
// before we know which months a visitor will pick client-side).
export function listAllSectionSlugs() {
  const all = loadAllMonths();
  const names = new Set();
  for (const m of all) {
    for (const sectionName of Object.keys(m.sections)) {
      names.add(sectionName);
    }
  }
  return Array.from(names).map((name) => ({
    name,
    slug: name.toLowerCase().replace(/&/g, 'and').replace(/\s+/g, '-'),
  }));
}

// Full raw dataset (every month, every section, every question) for the
// single combined read page — it needs everything available client-side
// since month + section switching both happen without a page reload.
// Kept lightweight: this is free content, no answer/explanation gating.
export function getFullDataset() {
  return loadAllMonths().map((m) => ({
    slug: m.slug,
    month: m.month,
    year: m.year,
    label: `${m.month} ${m.year}`,
    sections: m.sections,
  }));
}
