#!/bin/bash
set -euo pipefail

here="$(dirname "$0")"
for d in "target-spa"; do
    for f in "$here/$d"/*; do
        echo "copying $f to dist/$d/."
        cp "$f" "$here/../dist/$d/"
    done
done
