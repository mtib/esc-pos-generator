#!/bin/bash

for d in "target-spa"; do
    for f in $(dirname "$0")/$d/*; do
        echo "copying $f to dist/$d/."
        cp $f "$(dirname "$0")/../dist/$d"
    done
done
