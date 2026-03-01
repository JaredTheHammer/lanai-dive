#!/bin/bash
INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path')

# Only run for src/ JS/JSX files
if [[ $FILE_PATH != *.js && $FILE_PATH != *.jsx ]]; then
  exit 0
fi

# If the file itself is a test, run it directly
if [[ $FILE_PATH == *.test.js || $FILE_PATH == *.test.jsx ]]; then
  npx vitest run "$FILE_PATH" 2>&1
  exit $?
fi

# Try to find a matching test file
TEST_FILE="${FILE_PATH%.jsx}.test.js"
TEST_FILE="${TEST_FILE%.js}.test.js"

if [[ -f "$TEST_FILE" ]]; then
  npx vitest run "$TEST_FILE" 2>&1
  exit $?
fi

exit 0
