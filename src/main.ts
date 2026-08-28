import { mount } from 'svelte'
import './app.css'
import App from './App.svelte'

const el = document.getElementById("calculator")!;

const app = mount(App, {
  target: el,
  props: {
    department: el.dataset.department ?? "art",
  },
})

export default app
