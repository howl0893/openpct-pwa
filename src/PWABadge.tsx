import './PWABadge.css'

import { useRegisterSW } from 'virtual:pwa-register/react'
import { useEffect } from 'react'
import { trackClick, trackScreenView } from './analytics'

function PWABadge() {
  // periodic sync is disabled, change the value to enable it, the period is in milliseconds
// You can remove onRegisteredSW callback and registerPeriodicSync function
  const period = 0

  const {
    
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl, r) {
      if (period <= 0) return
      if (r?.active?.state === 'activated') {
        registerPeriodicSync(period, swUrl, r)
      }
      else if (r?.installing) {
        r.installing.addEventListener('statechange', (e) => {
          const sw = e.target as ServiceWorker
          if (sw.state === 'activated')
            registerPeriodicSync(period, swUrl, r)
        })
      }
    },
  })

  useEffect(() => {
    if (needRefresh) {
      trackScreenView({ screen_name: 'pwa_update_prompt' })
    }
  }, [needRefresh])

  function close() {
    trackClick('pwa_update_close_click', {
      element_name: 'Close',
      element_type: 'button',
      element_location: 'pwa_update_prompt',
    })
    setNeedRefresh(false)
  }

  function reload() {
    trackClick('pwa_update_reload_click', {
      element_name: 'Reload',
      element_type: 'button',
      element_location: 'pwa_update_prompt',
    })
    void updateServiceWorker(true)
  }

  return (
    <div className="PWABadge" role="alert" aria-labelledby="toast-message">
      { (needRefresh)
      && (
        <div className="PWABadge-toast">
          <div className="PWABadge-message">
            <span id="toast-message">New content available, click on reload button to update.</span>
              
              
          </div>
          <div className="PWABadge-buttons">
            <button className="PWABadge-toast-button" onClick={reload}>Reload</button>
            <button className="PWABadge-toast-button" onClick={() => close()}>Close</button>
          </div>
        </div>
      )}
    </div>
  )
}

export default PWABadge

/**
 * This function will register a periodic sync check every hour, you can modify the interval as needed.
 */
function registerPeriodicSync(period: number, swUrl: string, r: ServiceWorkerRegistration) {
  if (period <= 0) return

  setInterval(async () => {
    if ('onLine' in navigator && !navigator.onLine)
      return

    const resp = await fetch(swUrl, {
      cache: 'no-store',
      headers: {
        'cache': 'no-store',
        'cache-control': 'no-cache',
      },
    })

    if (resp?.status === 200)
      await r.update()
  }, period)
}
