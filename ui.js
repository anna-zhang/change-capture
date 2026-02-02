// UI interactions and modal accessibility
document.addEventListener('DOMContentLoaded', () => {
  const modal = document.getElementById('aboutModal')
  const aboutLink = document.getElementById('aboutLink')
  const closeModalBtn = document.getElementById('closeModalBtn')
  const onboarding = document.getElementById('onboarding')

  // --- Onboarding (show once) ---
  if (!localStorage.getItem('motionMirrorOnboarded')) {
    onboarding.style.display = 'flex'
    const dismissOnboarding = () => {
      onboarding.style.display = 'none'
      localStorage.setItem('motionMirrorOnboarded', '1')
      onboarding.removeEventListener('click', dismissOnboarding)
      document.removeEventListener('keydown', dismissOnboardingKey)
    }
    const dismissOnboardingKey = e => {
      if (e.key === 'Escape' || e.key === ' ' || e.key === 'Enter') dismissOnboarding()
    }
    onboarding.addEventListener('click', dismissOnboarding)
    document.addEventListener('keydown', dismissOnboardingKey)
  }

  // --- ARIA announce helper (global) ---
  window.announce = function (message) {
    const el = document.getElementById('ariaAnnounce')
    if (el) {
      el.textContent = ''
      // Force re-announce by clearing then setting after a tick
      requestAnimationFrame(() => { el.textContent = message })
    }
  }

  // --- Button event bindings ---
  document.getElementById('toggleBtn')?.addEventListener('click', handleToggleRecording)
  document.getElementById('saveBtn')?.addEventListener('click', saveVideo)
  document.getElementById('restartBtn')?.addEventListener('click', restartSketch)

  // --- Modal ---
  function openModal () {
    modal.style.display = 'block'
    modal.setAttribute('aria-hidden', 'false')
    document.body.style.overflow = 'hidden'
    trapFocus(modal)
    // Pause canvas while modal is open
    if (typeof noLoop === 'function' && typeof ready !== 'undefined' && ready && !recordingStopped) {
      noLoop()
    }
  }

  function closeModal () {
    modal.style.display = 'none'
    modal.setAttribute('aria-hidden', 'true')
    document.body.style.overflow = ''
    releaseFocusTrap()
    aboutLink.focus()
    // Resume canvas if not in playback state
    if (typeof loop === 'function' && typeof recordingStopped !== 'undefined' && !recordingStopped) {
      loop()
    }
  }

  aboutLink.addEventListener('click', e => {
    e.preventDefault()
    openModal()
  })

  closeModalBtn.addEventListener('click', () => closeModal())
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && modal.style.display === 'block') closeModal()
  })

  // --- Accessibility: focus trap (fixed scoping) ---
  let firstFocusable, lastFocusable, handleFocusTrap

  function trapFocus (container) {
    const focusable = container.querySelectorAll(
      'a, button, [tabindex]:not([tabindex="-1"])'
    )
    if (focusable.length === 0) return
    firstFocusable = focusable[0]
    lastFocusable = focusable[focusable.length - 1]
    firstFocusable.focus()

    handleFocusTrap = function (e) {
      if (e.key !== 'Tab') return
      if (e.shiftKey && document.activeElement === firstFocusable) {
        e.preventDefault()
        lastFocusable.focus()
      } else if (!e.shiftKey && document.activeElement === lastFocusable) {
        e.preventDefault()
        firstFocusable.focus()
      }
    }
    document.addEventListener('keydown', handleFocusTrap)
  }

  function releaseFocusTrap () {
    if (handleFocusTrap) {
      document.removeEventListener('keydown', handleFocusTrap)
      handleFocusTrap = null
    }
  }
})
