---
'@req-inspect/core': patch
'@req-inspect/pg': patch
'@req-inspect/mongodb': patch
---

Warn when two incompatible @req-inspect/core copies are installed, and when pg or MongoDB queries never land inside an inspected request (for example an outdated @req-inspect/express or inspector() mounted after routes).
