// Add one entry here per subject. The key MUST exactly match the folder
// name under src/data/<key>/ and will become the URL: /<key>/
//
// No other file needs to change when you add a new subject.

export const subjectsMeta = {
  'telangana-history-te': {
    lang: 'te',
    heading: 'తెలంగాణ చరిత్ర',
    breadcrumb: 'తెలంగాణ చరిత్ర',
    seoTitle: 'తెలంగాణ చరిత్ర FAQs',
    seoDescription: 'TSPSC మరియు TS పోలీస్ SI, కానిస్టేబుల్ పరీక్షల కోసం తెలంగాణ చరిత్ర ప్రశ్నలు, అధ్యాయాల వారీగా',
  },
  'telangana-economy-en': {
    lang: 'en',
    heading: 'Telangana economy',
    breadcrumb: 'Telangana economy',
    seoTitle: 'Telangana Economy FAQs',
    seoDescription: 'TSPSC and TS Police SI, Constable exam preparation - Telangana economy questions, chapter by chapter',
  },

  // Example for adding a new subject later:
  // 'telangana-geography-en': {
  //   lang: 'en',
  //   heading: 'Telangana geography',
  //   breadcrumb: 'Telangana geography',
  //   seoTitle: 'Telangana Geography FAQs',
  //   seoDescription: 'Telangana geography questions for TSPSC and TS exams, chapter by chapter',
  // },
};

// Fallback used if a subject folder exists but has no entry above yet,
// so the site never breaks - it just shows a generic English title until
// you add the proper metadata. lang defaults to 'en' here on purpose.
export function getSubjectMeta(subjectKey) {
  return (
    subjectsMeta[subjectKey] || {
      lang: 'en',
      heading: subjectKey,
      breadcrumb: subjectKey,
      seoTitle: `${subjectKey} FAQs`,
      seoDescription: `${subjectKey} questions for TSPSC and TS exams, chapter by chapter`,
    }
  );
}
