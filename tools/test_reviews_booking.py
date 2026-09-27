"""End-to-end checks for reviews/ratings and the booking flow.

Creates and then removes its own data, so it is safe to re-run.
"""
import json
import urllib.request

BASE = "http://localhost:8000/api"


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
        raw = e.read().decode("utf-8", "replace")
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, raw


def login(email):
    st, b = call("POST", "/login", body={"email": email, "password": "Test1234"})
    assert st == 200, b
    return b["token"]


fails = []


def check(label, cond, detail=""):
    print(("  PASS  " if cond else "  FAIL  ") + label + (("   " + str(detail)) if detail and not cond else ""))
    if not cond:
        fails.append(label)


stu = login("nicat@stu.com")
other = login("aslan@stu.com")
lib = login("fatma@lib.com")

# A work to review.
st, books = call("GET", "/catalog/browse?scope=library", stu)
book = books["items"][0]
work_id, edition_id = book["work_id"], book["edition_id"]

print("reviews & ratings:")

st, out = call("POST", "/reviews", stu, {"work_id": work_id, "rating": 4.5, "text": ""})
check("empty text is rejected", st == 400 and out.get("code") == "EMPTY_TEXT", (st, out))

st, out = call("POST", "/reviews", stu, {"work_id": work_id, "rating": 4.3, "text": "x"})
check("a non-half-star rating is rejected", st == 400 and out.get("code") == "BAD_RATING", (st, out))

st, rev = call("POST", "/reviews", stu, {
    "work_id": work_id, "edition_id": edition_id, "rating": 4.5,
    "text": "Bradbury is not warning us about fire.", "spoiler": False,
})
check("post a review", st == 200 and rev["rating"] == 4.5, (st, rev))
rid = rev["id"]

st, page = call("GET", f"/works/{work_id}/reviews", stu)
check("review appears in the feed", st == 200 and len(page["reviews"]) == 1, (st, page))
check("aggregate rating is computed", page["rating"] == 4.5 and page["count"] == 1, page)
check("histogram buckets the half star up", page["histogram"][4] == 1, page["histogram"])
check("the feed knows which review is mine", page["reviews"][0]["is_mine"] is True, page["reviews"][0])
check("mine is reported for the composer", page["mine"] == rid, page["mine"])

st, again = call("POST", "/reviews", stu, {"work_id": work_id, "rating": 3.0, "text": "Changed my mind."})
st, page = call("GET", f"/works/{work_id}/reviews", stu)
check("posting again edits rather than duplicating", len(page["reviews"]) == 1 and page["rating"] == 3.0, page)

st, out = call("POST", f"/reviews/{rid}/vote", stu)
check("cannot mark your own review helpful", st == 400 and out.get("code") == "OWN_REVIEW", (st, out))

st, out = call("POST", f"/reviews/{rid}/vote", other)
check("another reader can vote helpful", st == 200 and out["helpful"] == 1, (st, out))
st, out = call("POST", f"/reviews/{rid}/vote", other)
check("voting again removes the vote", st == 200 and out["helpful"] == 0, (st, out))
call("POST", f"/reviews/{rid}/vote", other)

st, _ = call("POST", f"/reviews/{rid}/replies", lib, {"text": "Good point about Clarisse."})
check("staff can reply", st == 200, st)

st, page = call("GET", f"/works/{work_id}/reviews", stu)
r0 = page["reviews"][0]
check("reply is attached", r0["reply_count"] == 1, r0)
check("staff reply is flagged as moderator", r0["replies"][0]["is_moderator"] is True, r0["replies"][0])
check("helpful count is shown", r0["helpful"] == 1, r0)

st, _ = call("POST", f"/reviews/{rid}/report", other, {"reason": "SPOILER"})
check("report accepted", st == 200, st)

st, cards = call("GET", "/catalog/browse?scope=library", stu)
card = next(c for c in cards["items"] if c["work_id"] == work_id)
check("catalogue card shows the rating", card["rating"] == 3.0 and card["ratings_count"] == 1, card)

st, top = call("GET", "/community/top-reviewer?days=3650", stu)
check("top reviewer is found", st == 200 and top.get("found") is True, top)

print()
print("booking:")

st, res = call("GET", "/my-reservations", stu)
check("list my reservations", st == 200 and isinstance(res, list), (st, res))
before = len(res)

# Pick a book with a free copy that this student is not already holding, so the
# duplicate guard (correctly) does not fire.
held = {r["book_id"] for r in res}
free = [b for b in books["items"]
        if b.get("available_copies", 0) > 0 and b["book_id"] not in held]
check("a free book is available to test with", len(free) > 0, len(free))
made = False
if free:
    target = free[0]
    st, out = call("POST", "/reservation", stu, {"book_id": target["book_id"]})
    made = st == 200
    check("create a reservation", made, (st, out))

    # Reserving the same title again must be refused.
    st, dup = call("POST", "/reservation", stu, {"book_id": target["book_id"]})
    check("the same title twice is refused", st == 400 and dup.get("code") == "DUPLICATE", (st, dup))

    # student_id in the body must be ignored for a student caller.
    st, spoof = call("POST", "/reservation", other, {"book_id": target["book_id"], "student_id": 5})
    check("student_id in the body cannot reserve for someone else",
          st != 200 or spoof.get("student_id") != 5, (st, spoof))
    if st == 200:
        call("DELETE", f"/reservation/{spoof['id']}", other)

if made:
    st, res = call("GET", "/my-reservations", stu)
    check("new reservation is listed", len(res) == before + 1, len(res))
    mine = res[0]
    check("it carries a status code", bool(mine["status_code"]), mine)
    check("a pending reservation can be cancelled", mine["can_cancel"] is True, mine)

    st, out = call("DELETE", f"/reservation/{mine['id']}", other)
    check("another student cannot cancel it", st == 404, (st, out))

    st, out = call("DELETE", f"/reservation/{mine['id']}", stu)
    check("the owner can cancel it", st == 200, (st, out))

    st, res = call("GET", "/my-reservations", stu)
    check("it is gone after cancelling", len(res) == before, len(res))

st, out = call("GET", "/book-requests/mine", stu)
check("list my book requests", st == 200, st)

# Clean up the review so re-runs start fresh.
call("DELETE", f"/reviews/{rid}", stu)

print()
print("FAILURES: " + (", ".join(fails) if fails else "none"))
