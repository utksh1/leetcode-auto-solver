// Shared utilities, constants and a lightweight syntax highlighter

export const LANGUAGES = [
  { value: 'python3', label: 'Python 3' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'rust', label: 'Rust' },
  { value: 'golang', label: 'Go' },
  { value: 'java', label: 'Java' },
  { value: 'cpp', label: 'C++' },
];

export function cn(...classes) {
  return classes.filter(Boolean).join(' ');
}

export function getDifficultyClass(diff) {
  const d = (diff || '').toLowerCase();
  if (d === 'easy') return 'badge-easy';
  if (d === 'medium') return 'badge-medium';
  if (d === 'hard') return 'badge-hard';
  return 'badge-plain';
}

export function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* --------------------------------------------------------------------------
   Minimal, dependency-free syntax highlighter.
   Highlights one line at a time (line comments + strings only), which is
   well suited to LeetCode solution snippets. Input is escaped first, so
   output is safe to inject via dangerouslySetInnerHTML.
   -------------------------------------------------------------------------- */

const KEYWORDS = {
  python3: new Set(
    ('def return if elif else for while in not and or import from class None True False self lambda with as try ' +
      'except finally raise yield pass break continue global nonlocal assert async await del is print range len')
      .split(' ')
  ),
  typescript: new Set(
    ('const let var function return if else for while do switch case break continue new class extends interface ' +
      'type enum implements import export from as default async await try catch finally throw typeof instanceof ' +
      'in of this super static public private protected readonly void null undefined true false number string ' +
      'boolean any unknown never console')
      .split(' ')
  ),
  rust: new Set(
    ('fn let mut const static if else match for while loop return struct enum trait impl pub use mod crate self ' +
      'Self super where async await move ref dyn unsafe as in break continue true false Some None Ok Err')
      .split(' ')
  ),
  golang: new Set(
    ('func var const type struct interface map chan go defer if else for range switch case default return package ' +
      'import select break continue goto fallthrough nil true false make new len cap append panic recover fmt')
      .split(' ')
  ),
  java: new Set(
    ('public private protected class interface enum static final void int long double float boolean char String ' +
      'var new return if else for while do switch case break continue try catch finally throw throws extends ' +
      'implements import package this super null true false instanceof abstract synchronized record List Map')
      .split(' ')
  ),
  cpp: new Set(
    ('int long short char bool float double void auto const static struct class enum union template typename ' +
      'namespace using public private protected virtual override new delete return if else for while do switch ' +
      'case break continue try catch throw include std vector string map set unordered_map unordered_set nullptr ' +
      'true false this sizeof inline constexpr friend operator cout cin endl')
      .split(' ')
  ),
};

const LANG_ALIASES = {
  python: 'python3',
  python3: 'python3',
  py: 'python3',
  typescript: 'typescript',
  ts: 'typescript',
  javascript: 'typescript',
  js: 'typescript',
  rust: 'rust',
  rs: 'rust',
  golang: 'golang',
  go: 'golang',
  java: 'java',
  cpp: 'cpp',
  'c++': 'cpp',
  c: 'cpp',
};

export function normalizeLang(lang) {
  const key = String(lang || '').toLowerCase().trim();
  return LANG_ALIASES[key] || 'typescript';
}

const MASTER_RE =
  /(#.*$|\/\/.*$|\/\*.*?\*\/)|("""|''')|("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_]\w*)/g;

export function highlightLine(line, lang) {
  const escaped = escapeHtml(line);
  const kw = KEYWORDS[normalizeLang(lang)] || KEYWORDS.typescript;

  let out = '';
  let last = 0;
  MASTER_RE.lastIndex = 0;
  let m;

  while ((m = MASTER_RE.exec(line)) !== null) {
    const text = m[0];
    // Emit the plain (escaped) text before this token
    out += escapeHtml(line.slice(last, m.index));
    last = m.index + text.length;

    if (m[1]) {
      // Comment
      out += `<span class="tok-com">${escapeHtml(text)}</span>`;
    } else if (m[2]) {
      // Triple quote delimiters (doc-strings) — tint them as strings
      out += `<span class="tok-str">${escapeHtml(text)}</span>`;
    } else if (m[3]) {
      // String literal
      out += `<span class="tok-str">${escapeHtml(text)}</span>`;
    } else if (m[4]) {
      // Number
      out += `<span class="tok-num">${escapeHtml(text)}</span>`;
    } else if (m[5]) {
      // Identifier / keyword
      if (kw.has(text)) {
        out += `<span class="tok-kw">${escapeHtml(text)}</span>`;
      } else if (line[m.index + text.length] === '(') {
        out += `<span class="tok-fn">${escapeHtml(text)}</span>`;
      } else if (/^[A-Z]/.test(text)) {
        out += `<span class="tok-type">${escapeHtml(text)}</span>`;
      } else {
        out += escapeHtml(text);
      }
    }
    // Zero-length match safety
    if (m.index === MASTER_RE.lastIndex) MASTER_RE.lastIndex += 1;
  }

  out += escapeHtml(line.slice(last));
  return out || escaped || '&nbsp;';
}

export function copyToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text);
  }
  // Fallback for non-secure contexts
  return new Promise((resolve, reject) => {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      resolve();
    } catch (e) {
      reject(e);
    }
  });
}
