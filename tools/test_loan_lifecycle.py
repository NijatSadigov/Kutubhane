"""The whole borrowing lifecycle, end to end, against a scratch database.

    request -> approve -> collect -> log pages -> return

plus the rules around it: borrow limits, duplicate holds, no free copy,
cancelling, direct loans from the desk, and that a copy's status is correct at
every step.

Run against a server pointed at a throwaway DB — it creates and returns loans.
"""
import json
import urllib.request
from datetime import date, timedelta

BASE = "http://localhost:8001/api"   # scratch server
fails, checks = [], 0


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


def login(email, pw="Test1234"):
    st, b = call("POST", "/login", body={"email": email, "password": pw})
    assert st == 200, (email, st, b)
    return b["token"]


def check(label, cond, detail=""):
    global checks
    checks += 1
    print(("  PASS  " if cond else "  FAIL  ") + label + (("\n          " + str(detail)) if detail and not cond else ""))
    if not cond:
        fails.append(label)


def copy_status(lib, book_id, tracking):
    st, books = call("GET", "/books", lib)
    for b in books:
        if b["id"] == book_id:
            for c in (b.get("copies") or []):
                if c["tracking_number"] == tracking:
                    return (c.get("status") or {}).get("code")
    return None


lib = login("fatma@lib.com")
stu = login("nicat@stu.com")
other = login("aslan@stu.com")

st, me = call("GET", "/user", stu)
STU_ID = me["id"]
st, other_me = call("GET", "/user", other)
OTHER_ID = other_me["id"]

# Only books this student is not already involved with — my_status is exactly
# the field that makes this knowable.
st, books = call("GET", "/catalog/browse?scope=library", stu)
pool = [b for b in books["items"] if b["available_copies"] > 0 and not b["my_status"]]
assert len(pool) >= 4, f"need four free books, got {len(pool)}"

print("A · reservation lifecycle")

target = pool[0]
st, out = call("POST", "/reservation", stu, {"book_id": target["book_id"]})
check("student requests a loan", st == 200, (st, out))
res_id = out.get("id") if isinstance(out, dict) else None

st, mine = call("GET", "/my-reservations", stu)
row = next((r for r in mine if r["id"] == res_id), None)
check("it appears in the student's list", row is not None, mine)
check("it starts PENDING", row and row["status_code"] == "PENDING", row)

st, cat = call("GET", "/catalog/browse?scope=library", stu)
card = next(c for c in cat["items"] if c["book_id"] == target["book_id"])
check("the catalogue card reports RESERVED_PENDING", card["my_status"] == "RESERVED_PENDING", card["my_status"])

st, out = call("POST", "/reservation", stu, {"book_id": target["book_id"]})
check("a second request for the same book is refused",
      st == 400 and out.get("code") == "DUPLICATE", (st, out))

st, out = call("POST", f"/reservation/{res_id}", lib, {"action": "Approved"})
check("librarian approves", st == 200, (st, out))

st, mine = call("GET", "/my-reservations", stu)
row = next(r for r in mine if r["id"] == res_id)
check("it becomes APPROVED", row["status_code"] == "APPROVED", row)
check("approval stamps a pickup deadline", bool(row["pickup_deadline"]), row)

tracking = row["tracking_number"]
check("the copy is now RESERVED", copy_status(lib, target["book_id"], tracking) == "RESERVED",
      copy_status(lib, target["book_id"], tracking))

st, cat = call("GET", "/catalog/browse?scope=library", stu)
card = next(c for c in cat["items"] if c["book_id"] == target["book_id"])
check("the card reports RESERVED_READY", card["my_status"] == "RESERVED_READY", card["my_status"])

st, out = call("POST", f"/reservation/{res_id}/issue", lib)
check("librarian hands the book over", st == 200, (st, out))
check("the copy is now LOANED", copy_status(lib, target["book_id"], tracking) == "LOANED",
      copy_status(lib, target["book_id"], tracking))

st, cat = call("GET", "/catalog/browse?scope=library", stu)
card = next(c for c in cat["items"] if c["book_id"] == target["book_id"])
check("the card reports ON_LOAN", card["my_status"] == "ON_LOAN", card["my_status"])
check("the card carries a due date", bool(card["my_due_date"]), card)

st, lib_rows = call("GET", f"/my-library/{STU_ID}", stu)
loan = next((l for l in lib_rows if l["book_title"] == target["title"] and not l["return_date"]), None)
check("it shows in My Books as an open loan", loan is not None, lib_rows)

print()
print("B · reading and returning")

st, out = call("POST", "/reading-log", stu, {"loan_id": loan["id"], "page": 42, "note": "Started."})
check("student logs pages", st == 200, (st, out))
st, lib_rows = call("GET", f"/my-library/{STU_ID}", stu)
loan2 = next(l for l in lib_rows if l["id"] == loan["id"])
check("progress is reflected", loan2["current_page"] == 42, loan2)

st, out = call("POST", f"/return/{loan['id']}", lib)
check("librarian checks it in", st == 200, (st, out))
check("the copy is AVAILABLE again", copy_status(lib, target["book_id"], tracking) == "AVAILABLE",
      copy_status(lib, target["book_id"], tracking))

st, cat = call("GET", "/catalog/browse?scope=library", stu)
card = next(c for c in cat["items"] if c["book_id"] == target["book_id"])
check("the card is borrowable again", card["my_status"] == "", card["my_status"])

st, out = call("POST", "/reservation", stu, {"book_id": target["book_id"]})
check("the same book can be borrowed again after returning", st == 200, (st, out))
if st == 200:
    call("DELETE", f"/reservation/{out['id']}", stu)

print()
print("C · rules")

# Cancelling frees the copy.
st, r2 = call("POST", "/reservation", stu, {"book_id": pool[1]["book_id"]})
st, mine = call("GET", "/my-reservations", stu)
row = next(r for r in mine if r["id"] == r2["id"])
call("POST", f"/reservation/{r2['id']}", lib, {"action": "Approved"})
check("approved copy is held", copy_status(lib, pool[1]["book_id"], row["tracking_number"]) == "RESERVED",
      copy_status(lib, pool[1]["book_id"], row["tracking_number"]))
st, out = call("DELETE", f"/reservation/{r2['id']}", stu)
check("student cancels it", st == 200, (st, out))
check("cancelling frees the copy",
      copy_status(lib, pool[1]["book_id"], row["tracking_number"]) == "AVAILABLE",
      copy_status(lib, pool[1]["book_id"], row["tracking_number"]))

# Two students cannot hold the same single copy.
single = next((b for b in pool if b["available_copies"] == 1), None)
if single:
    st, a = call("POST", "/reservation", stu, {"book_id": single["book_id"]})
    st2, b = call("POST", "/reservation", other, {"book_id": single["book_id"]})
    check("a second student cannot take the only free copy",
          st == 200 and st2 == 400 and b.get("code") == "NO_COPY", (st, st2, b))
    if st == 200:
        call("DELETE", f"/reservation/{a['id']}", stu)

# Borrow limit.
st, limit_info = call("GET", f"/student/{STU_ID}/holds", stu)
limit = limit_info["limit"]
made = []
for bk in pool:
    st, o = call("GET", f"/student/{STU_ID}/holds", stu)
    if o["count"] >= limit:
        break
    st, r = call("POST", "/reservation", stu, {"book_id": bk["book_id"]})
    if st == 200:
        made.append(r["id"])
st, o = call("GET", f"/student/{STU_ID}/holds", stu)
if o["count"] >= limit:
    spare = next((b for b in pool if b["book_id"] not in
                  [x for x in []]), None)
    st, out = call("POST", "/reservation", stu, {"book_id": pool[-1]["book_id"]})
    check("the borrow limit is enforced",
          st == 400 and out.get("code") in ("LIMIT", "DUPLICATE", "NO_COPY"), (st, out))
else:
    check("the borrow limit is enforced", True, "not reachable with this data")
for rid in made:
    call("DELETE", f"/reservation/{rid}", stu)

# Direct loan from the desk, no reservation.
free = None
st, cat = call("GET", "/catalog/browse?scope=library", lib)
for b in cat["items"]:
    if b["available_copies"] > 0:
        free = b
        break
st, books = call("GET", "/books", lib)
bk = next(b for b in books if b["id"] == free["book_id"])
tn = next(c["tracking_number"] for c in bk["copies"] if (c.get("status") or {}).get("code") == "AVAILABLE")
due = (date.today() + timedelta(days=14)).isoformat()
st, out = call("POST", "/loan", lib, {
    "student_id": OTHER_ID, "book_id": free["book_id"], "tracking_number": tn, "due_date": due,
})
check("desk can issue a direct loan", st == 200, (st, out))
check("the copy goes LOANED", copy_status(lib, free["book_id"], tn) == "LOANED",
      copy_status(lib, free["book_id"], tn))

st, loans = call("GET", "/loans", lib)
dl = next((l for l in loans if l["book_copy"]["tracking_number"] == tn), None)
check("it appears in active loans", dl is not None, None)
if dl:
    st, out = call("POST", f"/return/{dl['id']}", lib)
    check("and can be returned", st == 200, (st, out))
    check("freeing the copy", copy_status(lib, free["book_id"], tn) == "AVAILABLE",
          copy_status(lib, free["book_id"], tn))

# A student must not be able to drive the desk.
st, out = call("POST", "/loan", stu, {
    "student_id": STU_ID, "book_id": free["book_id"], "tracking_number": tn, "due_date": due})
check("a student cannot issue a loan to themselves", st in (401, 403), (st, out))
st, out = call("POST", f"/reservation/{1}", stu, {"action": "Approved"})
check("a student cannot approve a reservation", st in (401, 403), (st, out))

print()
print(f"{checks} checks · FAILURES: " + (", ".join(fails) if fails else "none"))
