import json, glob, os, sys

folder = r"D:\Wesbites\studyhelp-astro\studyhelp\src\data\telangana-history-en"
split_dir = os.path.join(folder, "theory_content_sql")
os.makedirs(split_dir, exist_ok=True)

CHUNK_SIZE = 15000  # characters per SQL statement — comfortably under D1's per-statement limit

def sql_escape(s):
    return s.replace("'", "''")

rows = []
skipped = 0

for path in sorted(glob.glob(os.path.join(folder, "*.json"))):
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    items = data if isinstance(data, list) else [data]
    for ch in items:
        if ch.get("type") != "theory" or "concepts" not in ch:
            skipped += 1
            continue
        chapter_slug = ch["slug"]
        subject_id = "telangana-history-en"
        concepts_json = json.dumps(ch["concepts"], ensure_ascii=False)
        rows.append((chapter_slug, subject_id, concepts_json))

if not rows:
    print("No theory chapters found — check the folder path and chapter JSON shape.")
    sys.exit(1)

def safe_chunks(s, size):
    # Never split between the two characters of an escaped '' pair —
    # if the boundary would land right after the first of a pair,
    # shift it back by one character.
    chunks = []
    i = 0
    n = len(s)
    while i < n:
        end = min(i + size, n)
        if end < n and s[end - 1] == "'" and s[end] == "'":
            end -= 1
        chunks.append(s[i:end])
        i = end
    return chunks

for chapter_slug, subject_id, concepts_json in rows:
    escaped_full = sql_escape(concepts_json)
    esc_slug = sql_escape(chapter_slug)
    esc_subject = sql_escape(subject_id)

    out_path = os.path.join(split_dir, f"{chapter_slug}.sql")
    with open(out_path, "w", encoding="utf-8") as f:
        # 1. Reset/create the row with empty content
        f.write(
            "INSERT INTO theory_content (chapter_slug, subject_id, concepts_json) VALUES ('"
            + esc_slug + "', '" + esc_subject + "', '') "
            "ON CONFLICT(chapter_slug) DO UPDATE SET concepts_json = '';\n"
        )
        # 2. Append the JSON in bounded, quote-pair-safe chunks
        for chunk in safe_chunks(escaped_full, CHUNK_SIZE):
            f.write(
                "UPDATE theory_content SET concepts_json = concepts_json || '"
                + chunk + "' WHERE chapter_slug = '" + esc_slug + "';\n"
            )

print(f"Wrote {len(rows)} individual per-chapter .sql files (chunked) to:\n{split_dir}")
if skipped:
    print(f"Skipped {skipped} non-theory files.")
