#!/bin/sh
# Download the newest official copies of the libraries into src/lib/.
#   npm run update-libs
# Afterwards: test the add-on (npm start), update the versions in
# THIRD_PARTY.md, and mention the update in CHANGELOG.md.
set -e

LIB="$(pwd)/src/lib"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
cd "$TMP"

get() {  # get <npm package> → unpacks into ./<dir>
  name="$1"; dir="$2"
  file="$(npm pack "$name@latest" --silent | tail -1)"
  mkdir -p "$dir" && tar xzf "$file" -C "$dir"
  echo "  $name $(node -p "require('./$dir/package/package.json').version")"
}

echo "Downloading:"
get marked marked
get marked-footnote footnote
get dompurify purify
get @highlightjs/cdn-assets hljs
get katex katex

cp marked/package/lib/marked.umd.js        "$LIB/marked.min.js"
cp footnote/package/dist/index.umd.js      "$LIB/marked-footnote.js"
cp purify/package/dist/purify.min.js       "$LIB/purify.min.js"
cp hljs/package/highlight.min.js           "$LIB/highlight.min.js"
cp katex/package/dist/katex.min.js         "$LIB/katex.min.js"
cp katex/package/dist/katex.min.css        "$LIB/katex.min.css"
rm -f "$LIB"/fonts/*.woff2
cp katex/package/dist/fonts/*.woff2        "$LIB/fonts/"

echo "Done. Now: npm start (test), then update THIRD_PARTY.md and CHANGELOG.md."
