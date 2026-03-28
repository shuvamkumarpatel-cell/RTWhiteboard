#!/bin/sh
set -eu
g++ /workspace/main.cpp -std=c++17 -O2 -o /workspace/main.out
/workspace/main.out < /workspace/stdin.txt
