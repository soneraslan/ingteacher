const fs = require("fs");
const html = fs.readFileSync("H:/ingteacher/index.html", "utf8");
const js = fs.readFileSync("H:/ingteacher/app.js", "utf8");

const ids = [...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1]);
const duplicates = [...new Set(ids.filter((v, i) => ids.indexOf(v) !== i))];

const used = [...js.matchAll(/querySelector\("#([A-Za-z0-9_-]+)"\)/g)].map((m) => m[1]);
const missing = [...new Set(used.filter((id) => !ids.includes(id)))];

console.log("HTML_ID_COUNT:", ids.length);
console.log("DUPLICATE_IDS:", JSON.stringify(duplicates));
console.log("JS_SELECTOR_COUNT:", used.length);
console.log("MISSING_IN_HTML:", JSON.stringify(missing));

const css = fs.readFileSync("H:/ingteacher/styles.css", "utf8");
const classes = [...html.matchAll(/class="([^"]+)"/g)]
  .flatMap((m) => m[1].split(/\s+/))
  .filter(Boolean);
const undefinedClasses = [...new Set(classes.filter((c) => !css.includes(`.${c}`)))];
console.log("HTML_WITHOUT_CSS_RULE:", JSON.stringify(undefinedClasses));
