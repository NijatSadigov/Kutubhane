"""Finish the demo data: join students to the challenges and give them
progress. Split out from populate_demo.py because that run was interrupted
partway through this step, and re-running the whole thing would duplicate the
book requests."""
import json
import os
import random
import urllib.request

BASE = os.environ.get("BASE", "http://localhost:8000") + "/api"
random.seed(11)

STUDENTS = [
    "nicat@stu.com", "aslan@stu.com", "leyla@stu.com", "tural@stu.com",
    "nermin@stu.com", "elvin@stu.com", "aysu@stu.com", "reshad@stu.com",
]


def call(method, path, token=None, body=None):
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(BASE + path, data=data, method=method)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", "Bearer " + token)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            raw = r.read().decode("utf-8")
            return r.status, (json.loads(raw) if raw else None)
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace")
    except Exception as e:
        return 0, str(e)


def login(email):
    st, b = call("POST", "/login", body={"email": email, "password": "Test1234"})
    return b["token"] if st == 200 else None


lib = login("fatma@lib.com")
st, chs = call("GET", "/challenges", lib)
print(f"challenges: {len(chs or [])}")

joined = quizzes = 0
for email in STUDENTS:
    tk = login(email)
    if not tk:
        continue
    for ch in (chs or []):
        st, _ = call("POST", f"/challenges/{ch['id']}/join", tk)
        if st != 200:
            continue
        joined += 1
        st, detail = call("GET", f"/challenges/{ch['id']}", tk)
        books = (detail or {}).get("books") or []
        if not books:
            continue
        for b in books[:random.randint(1, len(books))]:
            call("POST", f"/challenges/{ch['id']}/read", tk,
                 {"edition_id": b["edition_id"], "read": True})
            if b.get("quiz_total"):
                st, q = call("GET", f"/challenges/{ch['id']}/quiz?edition_id={b['edition_id']}", tk)
                if st == 200 and q.get("questions"):
                    # mostly correct, so scores and the leaderboard vary
                    answers = {str(x["id"]): (0 if random.random() < 0.8 else 2)
                               for x in q["questions"]}
                    st, res = call("POST", f"/challenges/{ch['id']}/quiz", tk,
                                   {"edition_id": b["edition_id"], "answers": answers})
                    if st == 200:
                        quizzes += 1

print(f"joined: {joined} · quiz attempts: {quizzes}")
print("done.")
