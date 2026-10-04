function closeAll(root, except) {
  for (const item of root.querySelectorAll('[data-menu]')) {
    if (item === except) continue
    item.classList.remove('open')
    const trigger = item.querySelector('[data-menu-trigger]')
    if (trigger !== null) trigger.setAttribute('aria-expanded', 'false')
  }
}

function emit(root, command) {
  root.dispatchEvent(new CustomEvent('command', { bubbles: true, detail: { command } }))
}

export function initMenus(root) {
  if (root === null) return

  for (const item of root.querySelectorAll('[data-menu]')) {
    const trigger = item.querySelector('[data-menu-trigger]')
    if (trigger === null) continue

    trigger.addEventListener('click', (event) => {
      event.stopPropagation()
      const wasOpen = item.classList.contains('open')
      closeAll(root, item)
      item.classList.toggle('open', !wasOpen)
      trigger.setAttribute('aria-expanded', String(!wasOpen))
    })

    trigger.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        item.classList.add('open')
        trigger.setAttribute('aria-expanded', 'true')
        item.querySelector('[data-command]')?.focus()
      }
    })

    for (const entry of item.querySelectorAll('[data-command]')) {
      entry.addEventListener('click', () => {
        emit(root, entry.dataset.command)
        closeAll(root)
      })
    }
  }

  document.addEventListener('click', () => closeAll(root))
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeAll(root)
  })
}
