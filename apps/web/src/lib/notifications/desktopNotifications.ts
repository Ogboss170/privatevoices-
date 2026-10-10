// Browser Desktop Push & Web Notifications Client Helper
// Handles notification permissions, background state detection, and displaying native browser notifications

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied'
  }

  if (Notification.permission === 'granted') {
    return 'granted'
  }

  if (Notification.permission !== 'denied') {
    return await Notification.requestPermission()
  }

  return Notification.permission
}

export function isDocumentHidden(): boolean {
  if (typeof document === 'undefined') return false
  return document.hidden || document.visibilityState === 'hidden'
}

export interface ShowDesktopNotificationOptions {
  title: string
  body: string
  icon?: string
  tag?: string
  onClick?: () => void
}

export function showDesktopNotification({
  title,
  body,
  icon = '/icon-192x192.png',
  tag,
  onClick,
}: ShowDesktopNotificationOptions) {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return null
  }

  if (Notification.permission !== 'granted') {
    return null
  }

  try {
    const notification = new Notification(title, {
      body,
      icon,
      tag: tag || 'private-voices-dm',
      badge: icon,
      silent: false,
    })

    notification.onclick = (event) => {
      event.preventDefault()
      window.focus()
      onClick?.()
      notification.close()
    }

    return notification
  } catch (err) {
    console.warn('Error displaying desktop notification:', err)
    return null
  }
}
