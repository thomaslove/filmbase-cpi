import { mount } from 'svelte'
import './app.css'
import App from './App.svelte'
import { DEFAULT_API_BASE } from './lib/apiBase'

// The widget is embedded by a host-page HTML snippet, so nothing here can
// assume the page is ours: the script may load on a page with no mount point at
// all (a site-wide footer), with more than one, or before the markup it mounts
// into has been parsed. None of those may throw -- an uncaught error here takes
// the rest of the host page's scripts down with it.

// #calculator is the original mount point, kept working for pages already
// carrying that markup; data-cpi-calculator is what new snippets should use,
// since an id has to be unique and two widgets may share a page.
const SELECTOR = '[data-cpi-calculator], #calculator'

// Marks an element as mounted, so a second call cannot double-mount it
const MOUNTED = 'cpiCalculatorMounted'

function mountInto(el: HTMLElement) {
  if (el.dataset[MOUNTED]) return
  el.dataset[MOUNTED] = 'true'

  // Everything in app.css hangs off this class, so that one stylesheet serves
  // both mount forms without the host page inheriting any of it
  el.classList.add('cpi-calc')

  mount(App, {
    target: el,
    props: {
      department: el.dataset.department ?? 'art',
      mini: el.dataset.mini === 'true',
      // DEFAULT_API_BASE is resolved at script-execution time, above, so it is
      // already captured by the time this runs on DOMContentLoaded
      apiBase: el.dataset.apiBase ?? DEFAULT_API_BASE,
    },
  })
}

function mountAll() {
  document.querySelectorAll<HTMLElement>(SELECTOR).forEach(mountInto)
}

// A classic script in the snippet runs the moment it is parsed, which is before
// the div when the host puts the script first (or in a header or footer gadget)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountAll)
} else {
  mountAll()
}
