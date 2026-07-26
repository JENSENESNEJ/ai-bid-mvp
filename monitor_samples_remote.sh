#!/bin/sh
set -eu
docker exec ai-bid-worker sh -lc '
  if test -s /app/data/natural_samples_v2.log; then
    tail -40 /app/data/natural_samples_v2.log
  else
    echo RUNNING_NO_OUTPUT
  fi
'
echo "---JOBS---"
docker exec ai-bid-db psql -U ai_bid -d ai_bid -Atc \
  "select id,status,coalesce(error_message,''),started_at,finished_at
   from jobs
   where type='chapter_editor_sample'
   order by created_at desc
   limit 3;"
