// Where the JSON data files live.
//
// The widget is uploaded into a host's file manager (WildApricot), which
// decides the folder path -- so the path cannot be hardcoded here. Instead the
// script locates the folder it was itself served from and looks for the data
// beside it: keep cpi.json and the rates-*.json files in the same folder as
// cpi-calculator.js and this resolves correctly wherever that folder ends up.
//
// A data-api-base attribute on the mount element overrides it if the data ever
// has to live somewhere else.

// Only meaningful while the script is executing, which is why the build emits a
// classic IIFE: document.currentScript is null inside an ES module. Read at
// module scope, so it is captured during that synchronous execution.
const scriptSrc = (document.currentScript as HTMLScriptElement | null)?.src;

// Trailing slash trimmed: callers join with an explicit "/"
export const DEFAULT_API_BASE = scriptSrc
  ? new URL('.', scriptSrc).href.replace(/\/$/, '')
  : // Dev, and any host that leaves currentScript unset
    '/resources/api';
