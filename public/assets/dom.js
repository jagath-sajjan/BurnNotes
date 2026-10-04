export function byId(id) {
  const element = document.getElementById(id)
  if (element === null) {
    throw new Error(`missing element: ${id}`)
  }
  return element
}

export function show(element, visible) {
  element.hidden = !visible
}

export function setText(element, value) {
  element.textContent = value
}

export function setMessage(element, message, tone) {
  element.textContent = message
  element.dataset.tone = tone
}

export const prefersReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches
