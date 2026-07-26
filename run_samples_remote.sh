#!/bin/sh
set -eu
sample_index="${1:-}"
docker cp /opt/ai-bid-mvp/generate_wanbei_natural_samples.py \
  ai-bid-worker:/app/generate_wanbei_natural_samples.py
docker exec ai-bid-worker sh -lc '
  rm -f /app/data/natural_samples_v2.log /app/data/natural_samples_v2.done
'
if test -n "$sample_index"; then
  docker exec -d -e SAMPLE_INDEX="$sample_index" ai-bid-worker sh -lc \
    'python /app/generate_wanbei_natural_samples.py > /app/data/natural_samples_v2.log 2>&1'
else
  docker exec -d ai-bid-worker sh -lc \
    'python /app/generate_wanbei_natural_samples.py > /app/data/natural_samples_v2.log 2>&1'
fi
echo SAMPLE_STARTED
