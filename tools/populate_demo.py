"""Populate the database with lifelike demo activity, through the public API.

Everything it creates is ordinary data a real user could have produced:
reading diaries, reviews with votes and replies, shelves and favourites,
reservations at several stages, and a second challenge with quizzes.

It is idempotent enough to re-run: reviews are per-reader-per-work so they
update rather than duplicate, shelf items are unique per work, and reservations
are only created for books a student is not already holding.

    python populate_demo.py            # against http://localhost:8000
    BASE=http://localhost:8001 python populate_demo.py
"""
import json
import os
import random
import urllib.request
from datetime import date, timedelta

BASE = os.environ.get("BASE", "http://localhost:8000") + "/api"
random.seed(7)  # same demo every run


def call(method, path, token=None, body=None, quiet=True):
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(BASE + path, data=data, method=method)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", "Bearer " + token)
    try:
        with urllib.request.urlopen(req) as r:
            raw = r.read().decode("utf-8")
            return r.status, (json.loads(raw) if raw else None)
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", "replace")
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, raw


def login(email, pw="Test1234"):
    st, b = call("POST", "/login", body={"email": email, "password": pw})
    if st != 200:
        return None
    return b["token"]


STUDENTS = [
    "nicat@stu.com", "aslan@stu.com", "leyla@stu.com", "tural@stu.com",
    "nermin@stu.com", "elvin@stu.com", "aysu@stu.com", "reshad@stu.com",
    "gunel@stu.com", "kamran@stu.com",
]

REVIEWS = [
    (5.0, "Bradbury oddan yox, oxumamaqdan qorxur. Clarisse-in sualı bütün kitabı bir cümlədə deyir."),
    (4.5, "Winstonun gündəliyi hər şeyin açarıdır. Sonluq məni günlərlə düşündürdü."),
    (4.0, "Bakıda, hadisələrin baş verdiyi şəhərdə oxumaq tamam başqa hissdir. Bəzi fəsillər uzanır."),
    (5.0, "Kitabı bir gecədə bitirdim. Personajlar o qədər canlıdır ki, sanki qonşularımdır."),
    (3.5, "Gözəl dil, amma qəhrəman çox passivdir. Bəlkə də məqsəd elə budur?"),
    (4.5, "Məktəbdə oxuduğumuz ən yaxşı kitablardan biri. Müəllimimiz haqlı idi."),
    (4.0, "Əvvəli ağır gedir, amma yarıdan sonra əlindən qoya bilmirsən."),
    (5.0, "Hər səhifəsində yeni bir fikir var. Təkrar oxuyacağam."),
    (3.0, "Mövzu maraqlıdır, sonluq məni qane etmədi."),
    (4.5, "Tərcümə çox yaxşıdır. Oxuması rahat, dili axıcıdır."),
    (4.0, "Tarixi hissələr üçün əla. Bəzi yerlərdə çox detal var."),
    (5.0, "Bu kitab mənə oxumağı sevdirdi. Hamıya tövsiyə edirəm."),
]

REPLIES = [
    "Tamamilə razıyam!", "Mən də eyni hissi yaşadım.",
    "Maraqlı fikirdir, bu tərəfdən baxmamışdım.",
    "Yaxşı rəydir. Kitab klubunda müzakirə edək.",
]

NOTES = [
    "Sevdiyim sitat: “Kitablar yandırılmır, unudulur.”",
    "3-cü fəsildə keçən adları yadda saxla — sonra lazım olur.",
    "Müəllif haqqında araşdırma et, oxşar kitabları var.",
    "Bu hissəni inşa üçün istifadə edə bilərəm.",
]

print(f"populating {BASE}\n")

lib = login("fatma@lib.com")
assert lib, "librarian login failed"

st, books = call("GET", "/catalog/browse?scope=library", lib)
catalogue = books["items"]
print(f"catalogue: {len(catalogue)} titles")

tokens = {}
for email in STUDENTS:
    tk = login(email)
    if tk:
        tokens[email] = tk
print(f"students logged in: {len(tokens)}")

# ---------------------------------------------------------------- shelves
shelf_n = fav_n = note_n = 0
for i, (email, tk) in enumerate(tokens.items()):
    picks = random.sample(catalogue, min(9, len(catalogue)))
    for j, b in enumerate(picks):
        if j < 3:
            status = "OWNED"
        elif j < 6:
            status = "WANT"
        else:
            status = "READ"
        st, _ = call("POST", "/shelf", tk, {
            "work_id": b["work_id"], "edition_id": b["edition_id"], "status": status,
        })
        if st == 200:
            shelf_n += 1
    for b in random.sample(picks, 3):
        st, _ = call("POST", "/shelf", tk, {"work_id": b["work_id"], "favorite": True})
        if st == 200:
            fav_n += 1
    for b in random.sample(picks, 2):
        st, _ = call("POST", "/notes", tk, {
            "work_id": b["work_id"], "text": random.choice(NOTES),
        })
        if st == 200:
            note_n += 1
print(f"shelves: {shelf_n} items · {fav_n} favourites · {note_n} private notes")

# ---------------------------------------------------------------- reviews
review_ids = []
for i, (email, tk) in enumerate(tokens.items()):
    for b in random.sample(catalogue, 3):
        rating, text = REVIEWS[(i * 3 + len(review_ids)) % len(REVIEWS)]
        st, rev = call("POST", "/reviews", tk, {
            "work_id": b["work_id"], "edition_id": b["edition_id"],
            "rating": rating, "text": text,
            "spoiler": random.random() < 0.15,
        })
        if st == 200 and isinstance(rev, dict) and rev.get("id"):
            review_ids.append(rev["id"])
print(f"reviews: {len(review_ids)}")

# helpful votes and replies from other readers
votes = replies = 0
all_tokens = list(tokens.values())
for rid in review_ids:
    for tk in random.sample(all_tokens, random.randint(1, 4)):
        st, _ = call("POST", f"/reviews/{rid}/vote", tk)
        if st == 200:
            votes += 1
    if random.random() < 0.35:
        tk = random.choice(all_tokens)
        st, _ = call("POST", f"/reviews/{rid}/replies", tk, {"text": random.choice(REPLIES)})
        if st == 200:
            replies += 1
# a couple of teacher replies so the Moderator badge shows
for rid in review_ids[:3]:
    call("POST", f"/reviews/{rid}/replies", lib,
         {"text": "Yaxşı müşahidədir. Sinifdə də danışaq."})
print(f"engagement: {votes} helpful votes · {replies}+3 replies")

# ----------------------------------------------------------- reading diary
logs = 0
for email, tk in tokens.items():
    st, me = call("GET", "/user", tk)
    if st != 200:
        continue
    st, mylib = call("GET", f"/my-library/{me['id']}", tk)
    for loan in (mylib or []):
        if loan.get("return_date"):
            continue
        total = loan.get("page_count") or 200
        page = 0
        for step in range(random.randint(2, 5)):
            page = min(total, page + random.randint(20, 70))
            st, _ = call("POST", "/reading-log", tk, {
                "loan_id": loan["id"], "page": page,
                "note": random.choice(["Yaxşı gedir.", "Bu fəsil çətin idi.", "", "Maraqlı hissə."]),
            })
            if st == 200:
                logs += 1
print(f"reading diary: {logs} entries")

# ------------------------------------------------------------ reservations
made = 0
for email, tk in list(tokens.items())[:6]:
    st, cards = call("GET", "/catalog/browse?scope=library", tk)
    free = [b for b in cards["items"] if b["available_copies"] > 0 and not b["my_status"]]
    for b in free[:2]:
        st, r = call("POST", "/reservation", tk, {"book_id": b["book_id"]})
        if st == 200:
            made += 1
            # approve about half of them so the holds queue shows both states
            if made % 2 == 0:
                call("POST", f"/reservation/{r['id']}", lib, {"action": "Approved"})
print(f"reservations: {made} created, about half approved")

# --------------------------------------------------------------- requests
WANTED = [
    ("Yaşamaq gözəldir", "Nazim Hikmət"),
    ("Sənin adın", "Makoto Shinkai"),
    ("Qanun naminə", "Elçin"),
    ("The Hobbit", "J.R.R. Tolkien"),
]
reqs = 0
for (title, author), (email, tk) in zip(WANTED, list(tokens.items())):
    st, _ = call("POST", "/book-requests", tk, {
        "title": title, "author": author, "note": "Zəhmət olmasa kitabxanaya əlavə edin.",
    })
    if st == 200:
        reqs += 1
print(f"book requests: {reqs}")

# -------------------------------------------------------------- challenge
st, existing = call("GET", "/challenges", lib)
if len(existing or []) < 2:
    picks = random.sample(catalogue, 4)
    today = date.today()
    st, ch = call("POST", "/challenges", lib, {
        "title": "Qış Oxu Maratonu",
        "description": "Dörd kitab, hər biri üçün qısa test. Qışı kitabla keçir.",
        "prizes": "İlk üçlüyə kitab mağazasından hədiyyə kartı.",
        "starts_at": (today - timedelta(days=10)).isoformat() + "T00:00:00Z",
        "ends_at": (today + timedelta(days=60)).isoformat() + "T00:00:00Z",
        "edition_ids": [b["edition_id"] for b in picks],
    })
    if st == 200:
        cid = ch["id"]
        for b in picks[:2]:
            for n in range(3):
                call("POST", f"/challenges/{cid}/questions", lib, {
                    "edition_id": b["edition_id"],
                    "prompt": f"“{b['title']}” — sual {n + 1}: kitabın müəllifi kimdir?",
                    "option_a": b["author"] or "Naməlum",
                    "option_b": "Lev Tolstoy",
                    "option_c": "Jane Austen",
                    "option_d": "Nizami Gəncəvi",
                    "answer": 0,
                })
        print(f"challenge: created #{cid} with quizzes on 2 books")
    else:
        print("challenge: not created", ch)
else:
    cid = existing[0]["id"]
    print(f"challenge: reusing #{cid}")

# join people and give them progress
st, chs = call("GET", "/challenges", lib)
joined = 0
for ch in (chs or []):
    st, detail = call("GET", f"/challenges/{ch['id']}", lib)
    ch_books = (detail or {}).get("books") or []
    for email, tk in list(tokens.items())[:7]:
        st, _ = call("POST", f"/challenges/{ch['id']}/join", tk)
        if st != 200:
            continue
        joined += 1
        for b in ch_books[:random.randint(1, len(ch_books))]:
            call("POST", f"/challenges/{ch['id']}/read", tk,
                 {"edition_id": b["edition_id"], "read": True})
            if b.get("quiz_total"):
                st, q = call("GET", f"/challenges/{ch['id']}/quiz?edition_id={b['edition_id']}", tk)
                if st == 200:
                    answers = {}
                    for i, qq in enumerate(q["questions"]):
                        # mostly right, so scores vary
                        answers[str(qq["id"])] = 0 if random.random() < 0.8 else 2
                    call("POST", f"/challenges/{ch['id']}/quiz", tk,
                         {"edition_id": b["edition_id"], "answers": answers})
print(f"challenges: {joined} participations with progress")

print("\ndone.")
