let runtimePromise;

function loadScript(source) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = source;
    script.async = false;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`Failed to load ${source}`));
    document.body.append(script);
  });
}

export function initializeWebflow(page) {
  runtimePromise ??= (async () => {
    // Wait for mirrored fonts/styles before measuring the original animations.
    const styles = [...document.querySelectorAll('link[rel="stylesheet"]')];
    await Promise.all(styles.map(link => link.sheet ? Promise.resolve() : new Promise((resolve, reject) => {
      link.addEventListener('load', resolve, { once: true });
      link.addEventListener('error', reject, { once: true });
    })));
    await document.fonts.ready;
    for (const script of page.scripts) await loadScript(script.src);
    // These local libraries preserve the original IX2 timeline, breakpoints,
    // easing, hover states, tabs, scroll triggers, navbar and touch behavior.
    window.Webflow?.ready();
    // IX2's PAGE_START and PAGE_FINISH normally receive readystatechange.
    // React mounts and loads the scripts after that event has already fired.
    document.dispatchEvent(new CustomEvent('IX2_PAGE_UPDATE'));
  })();
  return runtimePromise;
}

export function installLocalForms() {
  // The reference forms submit to a hosted Webflow service. A clone cannot
  // supply that backend. Keep native validation and provide honest local UI.
  const submit = event => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || !form.closest('.w-form')) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (!form.reportValidity()) return;
    const email = form.querySelector('input[type="email"]')?.value.trim();
    try {
      const entries = JSON.parse(localStorage.getItem('khonho-demo-signups') || '[]');
      entries.push({ form: form.getAttribute('data-name') || form.name, email, date: new Date().toISOString() });
      localStorage.setItem('khonho-demo-signups', JSON.stringify(entries.slice(-100)));
    } catch { /* A restricted storage setting must not break the form UI. */ }
    const success = form.parentElement.querySelector('.w-form-done');
    if (success) {
      form.style.display = 'none';
      success.textContent = 'Demo: your email was saved in this browser only. No email was sent.';
      success.style.display = 'block';
      success.tabIndex = -1;
      success.focus();
    }
  };
  document.addEventListener('submit', submit, true);
  return () => document.removeEventListener('submit', submit, true);
}
