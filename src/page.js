// The viewer page: pick a file or drag one onto the page.

// Use your saved theme on the drop page too.
mdvLoadSettings().then(mdvApplySettings);
async function openFile(file) {
  if (!file) return;
  mdvRender(await file.text(), file.name);
}

document.getElementById("picker").addEventListener("change", (e) => {
  openFile(e.target.files[0]);
});

// Dropping works any time, even after a file is open,
// so you can drop the next file on top to switch.
document.addEventListener("dragover", (e) => {
  e.preventDefault();
  document.body.classList.add("mdv-dragging");
});
document.addEventListener("dragleave", (e) => {
  if (!e.relatedTarget) document.body.classList.remove("mdv-dragging");
});
document.addEventListener("drop", (e) => {
  e.preventDefault();
  document.body.classList.remove("mdv-dragging");
  openFile(e.dataTransfer.files[0]);
});
