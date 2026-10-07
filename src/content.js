// Runs on pages ending in .md / .markdown.
// Only acts when Firefox is showing the file as plain text,
// so normal web pages (like GitHub) are left alone.
if (document.contentType !== "text/html") {
  const fileName = decodeURIComponent(location.pathname.split("/").pop());
  mdvRender(document.body.innerText, fileName);
}
