#!/bin/sh
set -eu
javac /workspace/Main.java
java -cp /workspace Main < /workspace/stdin.txt
