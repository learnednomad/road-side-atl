#!/bin/bash
# Part A — per-IP rate-limit correctness against LOCAL build (http://localhost:3001)
# Strict endpoint: GET /api/pricing-estimate (cap 20 / 60s)
set -u
BASE="http://localhost:3001"
SVC="6ea7efd0-d640-4eef-bdf4-88c4eb16a83c"   # AC Repair (real seeded service)
URL="$BASE/api/pricing-estimate?serviceId=$SVC"

# hit <header> <value> <n>  -> prints one status code per line
hit_header() {
  local hdr="$1" val="$2" n="$3"
  for i in $(seq 1 "$n"); do
    curl -s -o /dev/null -w '%{http_code}\n' -H "$hdr: $val" "$URL"
  done
}
tally() { sort | uniq -c | awk '{print $2": "$1}' | paste -sd' ' -; }

echo "############ TEST 1: 30 DISTINCT X-Forwarded-For IPs (expect ZERO 429) ############"
{
  for i in $(seq 1 30); do
    curl -s -o /dev/null -w '%{http_code}\n' -H "X-Forwarded-For: 10.0.0.$i" "$URL"
  done
} | tally

echo
echo "############ TEST 2: 25 reqs SAME X-Forwarded-For 10.0.0.99 (expect 20x200 then 5x429) ############"
hit_header "X-Forwarded-For" "10.0.0.99" 25 | tally
echo "--- headers on a follow-up (26th) request from same capped IP ---"
curl -s -D - -o /dev/null -H "X-Forwarded-For: 10.0.0.99" "$URL" | grep -iE "HTTP/|x-ratelimit-remaining|retry-after"

echo
echo "############ TEST 3a: 25 reqs SAME X-Real-IP 10.1.0.50, NO XFF (expect cap -> 429) ############"
hit_header "X-Real-IP" "10.1.0.50" 25 | tally
echo
echo "############ TEST 3b: 30 DISTINCT X-Real-IP, NO XFF (expect ZERO 429) ############"
{
  for i in $(seq 1 30); do
    curl -s -o /dev/null -w '%{http_code}\n' -H "X-Real-IP: 10.1.0.$i" "$URL"
  done
} | tally
