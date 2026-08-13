// Add one entry here per subject. The key MUST exactly match the folder
// name under src/data/<key>/ and will become the URL: /<key>/
//
// No other file needs to change when you add a new subject.

export const subjectsMeta = {
  'telangana-history-te': {
    lang: 'te',
    heading: 'తెలంగాణ చరిత్ర',
    breadcrumb: 'తెలంగాణ చరిత్ర',
    seoTitle: 'తెలంగాణ చరిత్ర MCQs',
    seoDescription: 'TSPSC మరియు TS పోలీస్ SI, కానిస్టేబుల్ పరీక్షల కోసం తెలంగాణ చరిత్ర ప్రశ్నలు, అధ్యాయాల వారీగా',
  },
  'telangana-economy-en': {
    lang: 'en',
    heading: 'Telangana Economy',
    breadcrumb: 'Telangana Economy',
    seoTitle: 'Telangana Economy MCQs',
    seoDescription: 'TSPSC and TS Police SI, Constable exam preparation - Telangana economy questions, chapter by chapter',
  },
  'telangana-history-en': {
    lang: 'en',
    heading: 'Telangana History',
    breadcrumb: 'Telangana History',
    seoTitle: 'Telangana History MCQs',
    seoDescription: 'TSPSC and TS Police SI, Constable exam preparation - Telangana history questions, chapter by chapter',
  },
  'telangana-economy-te': {
    lang: 'te',
    heading: 'తెలంగాణ ఆర్థిక వ్యవస్థ',
    breadcrumb: 'తెలంగాణ ఆర్థిక వ్యవస్థ',
    seoTitle: 'తెలంగాణ ఆర్థిక వ్యవస్థ MCQs',
    seoDescription: 'TSPSC మరియు TS పోలీస్ SI, కానిస్టేబుల్ పరీక్షల కోసం తెలంగాణ ఆర్థిక వ్యవస్థ ప్రశ్నలు, అధ్యాయాల వారీగా',
  },
  'indian-polity-en': {
    lang: 'en',
    heading: 'Indian Polity',
    breadcrumb: 'Indian Polity',
    seoTitle: 'Indian Polity MCQs',
    seoDescription: 'TSPSC and TS Police SI, Constable exam preparation - Indian polity questions, chapter by chapter',
  },
  'indian-polity-te': {
    lang: 'te',
    heading: 'భారత రాజ్యాంగం',
    breadcrumb: 'భారత రాజ్యాంగం',
    seoTitle: 'భారత రాజ్యాంగం MCQs',
    seoDescription: 'TSPSC మరియు TS పోలీస్ SI, కానిస్టేబుల్ పరీక్షల కోసం భారత రాజ్యాంగం ప్రశ్నలు, అధ్యాయాల వారీగా',
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
