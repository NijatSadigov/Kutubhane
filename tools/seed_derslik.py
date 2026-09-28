"""Demo data for the dərslik system.

Creates, in the manager's school:

  · an academic year (current)
  · the subjects a 4th and 5th class take
  · three teachers — one takes both classes, the other two take one each
  · two classrooms, 4-A and 5-A, of ten students apiece
  · a dərslik catalogue for both grades, with stock

Re-runnable: everything is matched by name or email first, so running it twice
does not double the school. Takes BASE to choose which server.
"""
import json
import os
import urllib.error
import urllib.request

BASE = os.environ.get("BASE", "http://localhost:8000/api")
PW = "Test1234"


def call(method, path, token=None, body=None):
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(BASE + path, data=data, method=method)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", "Bearer " + token)
    try:
        with urllib.request.urlopen(req) as r:
            raw = r.read().decode("utf-8")
            return r.status, (json.loads(raw) if raw.strip().startswith(("{", "[")) else raw)
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", "replace")
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, raw


def login(email, pw=PW):
    st, b = call("POST", "/login", body={"email": email, "password": pw})
    assert st == 200, (email, st, b)
    return b["token"]


mgr = login("mgr@hadaf.com")
lib = login("fatma@lib.com")

# The branch the librarian works in — that is where the textbooks live.
st, me = call("GET", "/user", lib)
branch_id = me["librarian"]["branch_id"]
print("branch:", branch_id, me["librarian"]["branch"]["name"])

# ------------------------------------------------------------ academic year
st, years = call("GET", "/academic-years", mgr)
year = next((y for y in years if y["label"] == "2026/2027"), None)
if not year:
    st, year = call("POST", "/academic-years", mgr, {
        "label": "2026/2027", "starts_on": "2026-09-15", "ends_on": "2027-06-15",
        "is_current": True,
    })
    assert st == 200, year
print("year:", year["label"])
call("PUT", "/academic-years/%d/current" % year["id"], mgr)

# ----------------------------------------------------------------- subjects
SUBJECTS = ["Azərbaycan dili", "Riyaziyyat", "İngilis dili", "Həyat bilgisi",
            "İnformatika", "Təsviri incəsənət"]
subject_id = {}
st, existing = call("GET", "/subjects", mgr)
for name in SUBJECTS:
    found = next((s for s in existing if s["name"] == name), None)
    if not found:
        st, found = call("POST", "/subjects", mgr, {"name": name})
        assert st == 200, found
    subject_id[name] = found["id"]
print("subjects:", ", ".join(subject_id))

# ----------------------------------------------------------------- teachers
TEACHERS = [
    ("Sevda Əliyeva", "sevda@teach.com", "Azərbaycan dili"),   # takes both
    ("Rauf Hüseynov", "rauf@teach.com", "Riyaziyyat"),          # takes 4-A
    ("Günel Məmmədli", "gunel@teach.com", "İngilis dili"),      # takes 5-A
]
st, have = call("GET", "/teachers", mgr)
teacher_id = {}
for name, email, subj in TEACHERS:
    found = next((t for t in have if t["user"]["email"] == email
                  if t.get("user")), None)
    if not found:
        found = next((t for t in have if t["name"] == name), None)
    if not found:
        st, found = call("POST", "/teachers", mgr, {
            "name": name, "email": email, "password": PW,
            "branch_id": branch_id, "subject": subj,
        })
        assert st == 200, (email, found)
    teacher_id[email] = found["user_id"]
print("teachers:", ", ".join("%s=%s" % (e, i) for e, i in teacher_id.items()))

# --------------------------------------------------------------- classrooms
st, rooms = call("GET", "/classrooms", mgr)


def ensure_room(grade, letter, teacher_emails):
    room = next((r for r in rooms if r["grade"] == grade and r["letter"] == letter), None)
    if not room:
        st, room = call("POST", "/classrooms", mgr, {
            "branch_id": branch_id, "grade": grade, "letter": letter,
            "academic_year_id": year["id"],
        })
        assert st == 200, room
    ids = [teacher_id[e] for e in teacher_emails]
    st, room = call("PUT", "/classrooms/%d/teachers" % room["id"], mgr, {"teacher_ids": ids})
    assert st == 200, room
    return room


# Sevda takes both; Rauf takes 4-A; Günel takes 5-A.
room4 = ensure_room(4, "A", ["sevda@teach.com", "rauf@teach.com"])
room5 = ensure_room(5, "A", ["sevda@teach.com", "gunel@teach.com"])
print("classrooms:", room4["label"], room4["teacher_names"],
      "|", room5["label"], room5["teacher_names"])

# ----------------------------------------------------------------- students
FIRST4 = ["Ayan", "Tunar", "Lamiyə", "Kamran", "Nərgiz",
          "Orxan", "Səbinə", "Fuad", "Aysel", "Ramin"]
FIRST5 = ["Zəhra", "Murad", "Günay", "Elnur", "Türkan",
          "Cavid", "Mələk", "Samir", "Arzu", "Vüqar"]
LAST = ["Quliyev", "Məmmədov", "Həsənli", "Rzayev", "Abbasov",
        "Nəbiyev", "Cəfərov", "Salmanlı", "Vəliyev", "Zeynallı"]


def ensure_students(room, firsts, grade, tag):
    ids = []
    for i, first in enumerate(firsts):
        last = LAST[i]
        # Azerbaijani surnames take -a for a woman; the demo keeps it simple
        # and uses the masculine form throughout rather than guessing gender.
        email = "%s%d@stu.com" % (tag, i + 1)
        st, out = call("POST", "/register", body={
            "name": "%s %s" % (first, last), "email": email, "password": PW,
            "branch_id": branch_id, "grade": grade, "classGroup": room["letter"],
        })
        if st in (200, 201):
            uid = out.get("id") if isinstance(out, dict) else None
        else:
            # already there — log in to find the id
            try:
                tok = login(email)
                _, who = call("GET", "/user", tok)
                uid = who["id"]
            except AssertionError:
                print("  ! could not create or reach", email, out)
                continue
        if uid:
            ids.append(uid)
    st, res = call("PUT", "/classrooms/%d/students" % room["id"], mgr,
                   {"student_ids": ids, "replace": True})
    print("  %s: %d students assigned" % (room["label"], (res or {}).get("assigned", 0)))
    return ids


print("students:")
ensure_students(room4, FIRST4, 4, "s4")
ensure_students(room5, FIRST5, 5, "s5")

# ---------------------------------------------------------------- textbooks
TEXTBOOKS = [
    (4, "Azərbaycan dili", "Azərbaycan dili 4", "Ə. Abbasov", 2024, 30),
    (4, "Riyaziyyat", "Riyaziyyat 4", "M. Namazov", 2024, 30),
    (4, "İngilis dili", "English 4", "S. Hüseynova", 2023, 28),
    (4, "Həyat bilgisi", "Həyat bilgisi 4", "N. Qasımova", 2023, 26),
    (5, "Azərbaycan dili", "Azərbaycan dili 5", "Ə. Abbasov", 2024, 30),
    (5, "Riyaziyyat", "Riyaziyyat 5", "M. Namazov", 2024, 30),
    (5, "İngilis dili", "English 5", "S. Hüseynova", 2023, 25),
    (5, "İnformatika", "İnformatika 5", "R. Əliyev", 2024, 24),
]
st, have = call("GET", "/textbooks", lib)
made = 0
for grade, subj, title, author, yr, copies in TEXTBOOKS:
    if any(t["title"] == title for t in have):
        continue
    st, out = call("POST", "/textbooks", lib, {
        "subject_id": subject_id[subj], "grade": grade, "title": title,
        "author": author, "publisher": "Təhsil Nəşriyyatı", "year": yr,
        "language": "Azərbaycan", "total_copies": copies,
    })
    assert st == 200, (title, out)
    made += 1
print("textbooks: %d created, %d already there" % (made, len(TEXTBOOKS) - made))

st, books = call("GET", "/textbooks", lib)
print("\ncatalogue now:")
for b in books:
    print("  grade %d  %-24s %-18s stock %d" % (
        b["grade"], b["title"][:24], (b.get("subject") or {}).get("name", "")[:18],
        b["total_copies"]))
print("\ndone.")
