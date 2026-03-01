#!/bin/bash
INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path')

# Only format JS/JSX/CSS/JSON/MD files
if [[ $FILE_PATH == *.js || $FILE_PATH == *.jsx || $FILE_PATH == *.css || $FILE_PATH == *.json || $FILE_PATH == *.md ]]; then
  npx prettier --write "$FILE_PATH" 2>/dev/null
fi

exit 0
