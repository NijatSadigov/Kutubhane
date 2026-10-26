#!/usr/bin/env bash
# Every role against one route per gate, plus a forged token and no token.
#
#   BASE=http://localhost:8000/api tools/check_role_gates.sh
#
# Reads as a matrix. A gate that admits the wrong role, or refuses the right
# one, is a cell that does not match the table below. Expected, for the demo
# data:
#
#   gate         route                      admin mgr lib tchr stu forged none
#   IsAdmin      /admin/school               200  403 403  403  403   401  401
#   IsManager    /manager/librarian-stats    403  200 403  403  403   401  401
#   IsLibrarian  /desk/summary               401  403 200  403  403   401  401
#   IsTeacher    /moderation/reports         200  200 200  200  403   401  401
#   (auth only)  /user                       200  200 200  200  200   401  401
#
# Two cells are not typos. An admin gets 403 from /manager/* and 401 from the
# desk because a platform admin has no profile row, which three different
# helpers each discover separately — see TODO.md. The gates admit them; the
# handlers cannot place them.
#
# The forged column is the one that matters most: a token whose signature is
# garbage must be 401 everywhere. Until 2026-10-26 the four gates parsed the
# token themselves and ignored whether it verified; they read the role from
# Locals now, which only IsAuthenticated sets.

BASE="${BASE:-http://localhost:8000/api}"
PW="${PW:-Test1234}"

declare -A TOK
login() {
  TOK[$1]=$(curl -s -X POST "$BASE/login" -H 'Content-Type: application/json' \
            -d "{\"email\":\"$2\",\"password\":\"$PW\"}" |
            sed 's/.*"token":"//; s/".*//')
  case "${TOK[$1]}" in eyJ*) ;; *) echo "! could not log in as $1 ($2)" >&2;; esac
}
login admin     "${ADMIN_EMAIL:-admin@school.com}"
login manager   "${MANAGER_EMAIL:-mgr@hadaf.com}"
login librarian "${LIBRARIAN_EMAIL:-fatma@lib.com}"
login teacher   "${TEACHER_EMAIL:-sevda@teach.com}"
login student   "${STUDENT_EMAIL:-nicat@stu.com}"

# A well-formed token claiming admin, signed with nothing in particular.
b64() { printf '%s' "$1" | base64 | tr '+/' '-_' | tr -d '=\n'; }
TOK[forged]="$(b64 '{"alg":"HS256","typ":"JWT"}').$(b64 "{\"iss\":1,\"role\":\"admin\",\"user_id\":1,\"exp\":$(( $(date +%s) + 99999 ))}").ZmFrZXNpZ25hdHVyZQ"
TOK[none]=""

ROUTES=(
  "IsAdmin|/admin/school"
  "IsManager|/manager/librarian-stats"
  "IsLibrarian|/desk/summary"
  "IsTeacher|/moderation/reports"
  "(auth only)|/user"
)
WHO=(admin manager librarian teacher student forged none)

printf '%-14s %-26s' "gate" "route"
for r in "${WHO[@]}"; do printf '%-10s' "$r"; done
echo
for row in "${ROUTES[@]}"; do
  IFS='|' read -r gate path <<<"$row"
  printf '%-14s %-26s' "$gate" "$path"
  for r in "${WHO[@]}"; do
    t="${TOK[$r]:-}"
    if [ -z "$t" ]; then
      code=$(curl -s -o /dev/null -w '%{http_code}' "$BASE$path")
    else
      code=$(curl -s -o /dev/null -w '%{http_code}' "$BASE$path" -H "Authorization: Bearer $t")
    fi
    printf '%-10s' "$code"
  done
  echo
done
