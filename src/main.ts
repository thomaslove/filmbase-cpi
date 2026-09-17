import { mount } from 'svelte'
import './app.css'
import App from './App.svelte'
import { DEFAULT_API_BASE } from './lib/apiBase'

const el = document.getElementById("calculator")!;

const app = mount(App, {
  target: el,
  props: {
    department: el.dataset.department ?? "art",
    mini: el.dataset.mini === "true",
    apiBase: el.dataset.apiBase ?? DEFAULT_API_BASE,
  },
})

export default app
