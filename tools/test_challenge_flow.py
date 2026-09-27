"""Exercise the whole challenge flow as a student: list, join, mark read,
fetch the quiz, fail it, pass it, and check the standings and points."""
import json
import urllib.request

BASE = "http://localhost:8000/api"
CID, EDITION = 1, 6


def call(method, path, token=None, body=None):
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
        return e.code, e.read().decode("utf-8", "replace")


def login(email):
    st, b = call("POST", "/login", body={"email": email, "password": "Test1234"})
    assert st == 200, b
    return b["token"]


stu = login("nicat@stu.com")
fails = []


def check(label, cond, detail=""):
    print(("  PASS  " if cond else "  FAIL  ") + label + (("  " + str(detail)) if detail and not cond else ""))
    if not cond:
        fails.append(label)


print("challenge flow:")

st, lst = call("GET", "/challenges", stu)
check("list challenges", st == 200 and len(lst) >= 1, (st, lst))

# Acting before joining must be refused.
st, _ = call("POST", f"/challenges/{CID}/read", stu, {"edition_id": EDITION, "read": True})
check("mark read before joining is refused", st == 403, st)

st, _ = call("POST", f"/challenges/{CID}/join", stu)
check("join", st == 200, st)

st, _ = call("POST", f"/challenges/{CID}/join", stu)
check("join is idempotent", st == 200, st)

st, q = call("GET", f"/challenges/{CID}/quiz?edition_id={EDITION}", stu)
check("fetch quiz", st == 200 and len(q["questions"]) == 3, (st, q))
check("quiz never leaks the answer", st == 200 and all("answer" not in x for x in q["questions"]), q)

qids = [x["id"] for x in q["questions"]]

# All wrong on purpose: every question's correct option differs from index 3.
st, bad = call("POST", f"/challenges/{CID}/quiz", stu, {
    "edition_id": EDITION, "answers": {str(i): 3 for i in qids},
})
check("failing attempt is recorded and not passed", st == 200 and bad["passed"] is False and bad["score"] == 0, bad)

# Correct answers are 0, 1, 1 in the order they were seeded.
st, good = call("POST", f"/challenges/{CID}/quiz", stu, {
    "edition_id": EDITION, "answers": {str(qids[0]): 0, str(qids[1]): 1, str(qids[2]): 1},
})
check("passing attempt scores 3/3", st == 200 and good["score"] == 3 and good["passed"], good)
check("passing awards quiz points", good.get("points_awarded") == 15, good)
check("best score is kept", good.get("best") == 3, good)

st, det = call("GET", f"/challenges/{CID}", stu)
book = next(b for b in det["books"] if b["edition_id"] == EDITION)
check("passing the quiz also marks the book read", book["read"] is True, book)
check("next step moves on to review", book["next"] == "review", book["next"])
check("points = read 10 + quiz 15", det["points"] == 25, det["points"])
check("standings include me", any(s["is_me"] for s in det["standings"]), det["standings"])
check("review step is reported unavailable", det["review_step_available"] is False, det)

# A third attempt that scores worse must not lower the best.
st, worse = call("POST", f"/challenges/{CID}/quiz", stu, {
    "edition_id": EDITION, "answers": {str(qids[0]): 0, str(qids[1]): 3, str(qids[2]): 3},
})
check("a worse later attempt does not lower the best", worse.get("best") == 3, worse)

# Another school's challenge must 403 — there is only one school here, so check
# that an unknown id 404s rather than leaking.
st, _ = call("GET", "/challenges/99999", stu)
check("unknown challenge 404s", st == 404, st)

print()
print("FAILURES: " + (", ".join(fails) if fails else "none"))
