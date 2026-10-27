#!/usr/bin/env bash
# Can the librarian of one branch reach another branch's things by id?
#
#   BASE=http://localhost:8000/api tools/check_branch_scope.sh
#
# The demo has two branches. Mert works at Gəncə, which holds no books, no
# readers and no loans. Everything probed here belongs to Nəsimi. Every line
# should be a refusal — 403 or 404 — or, for the branch-wide lists, a 200 that
# is empty, because those are scoped to the caller's own branch and the
# caller's own branch has nothing in it.
#
# A `!` in the first column is a 200 with Nəsimi's data in it. On 2026-10-26
# three lines carried one: GET /books/:id handed out another branch's copy ids
# and tracking numbers, and PUT/DELETE /copy/:id took those ids and acted on
# them. The writes below were run for real against the demo, and the renamed
# copy put back by hand, which is why they are commented out here rather than
# left armed.
#
# The catalogue is per-branch — two branches of one school keep separate book
# records, separate authors, separate genres — so "another branch" is a real
# boundary and not a formality. See PROJECT_BRIEF.md §1.4.

BASE="${BASE:-http://localhost:8000/api}"
PW="${PW:-Test1234}"

tok() { curl -s -X POST "$BASE/login" -H 'Content-Type: application/json' \
        -d "{\"email\":\"$1\",\"password\":\"$PW\"}" | sed 's/.*"token":"//; s/".*//'; }

OTHER=$(tok "${OTHER_LIBRARIAN:-Mert@lib.com}")     # Gəncə
OWNER=$(tok "${OWNER_LIBRARIAN:-fatma@lib.com}")    # Nəsimi
case "$OTHER" in eyJ*) ;; *) echo "could not log in as the other branch's librarian"; exit 1;; esac

# probe <path> <expected>
#   refused  — the other branch must not get this at all (403 or 404)
#   empty    — 200 is right, but it must hold none of the other branch's rows
#   title    — 200 is right; it says only what the public catalogue already does
probe() {
  path=$1; want=$2
  o=$(curl -s -o /dev/null -w '%{http_code}' "$BASE$path" -H "Authorization: Bearer $OTHER")
  w=$(curl -s -o /dev/null -w '%{http_code}' "$BASE$path" -H "Authorization: Bearer $OWNER")
  body=''
  [ "$o" = "200" ] && body=$(curl -s "$BASE$path" -H "Authorization: Bearer $OTHER" | head -c 54 | tr -d '\n')

  flag=' '
  case "$want" in
    refused) [ "$o" = "200" ] && flag='!' ;;
    empty)   # anything but an empty list or all-zero summary is a finding
             case "$body" in
               '[]'|'') ;;
               *[1-9]*) flag='!' ;;
             esac ;;
    title)   ;;   # known, and no more than the logged-out catalogue gives
  esac
  printf '%s %-32s other=%-5s owner=%-5s %s\n' "$flag" "$path" "$o" "$w" "$body"
}

echo "One reader, one loan, one book — all the other branch's:"
for p in /student/5/reading /student/5/stats /student/5/holds /my-library/5 \
         /reading-log/1 /books/1; do probe "$p" refused; done
# Says whether a title has an e-book, and its title. The title is on the
# logged-out catalogue already, and `allowed:false` is the gate that matters —
# GetEbook itself decides, by shelf rather than by branch, so a branch check
# here would only break a platform admin, who has no branch at all.
probe /ebook/1/info title

echo
echo "Branch-wide lists (200 holding nothing is the right answer):"
for p in /loans /reservations /book-requests /class-list /desk/summary \
         /registration-tokens /tickets; do probe "$p" empty; done

echo
echo "Writes are not run here. To check them by hand, on a database you can"
echo "restore, the two that were broken were:"
echo "    PUT    $BASE/copy/3   {\"tracking_number\":\"...\"}"
echo "    DELETE $BASE/copy/3"
echo "Both must answer 404 for the other branch's librarian."
