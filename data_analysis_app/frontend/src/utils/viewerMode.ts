import toast from 'react-hot-toast'

/**
 * Show a viewer mode restriction toast and return false.
 * Use this to guard admin-only actions in event handlers.
 *
 * @param action - Optional description of the blocked action (e.g., "delete activity", "save changes")
 * @returns false (to be used in early returns)
 *
 * @example
 * if (!isAdmin) {
 *   showViewerModeToast('save changes')
 *   return
 * }
 */
export function showViewerModeToast(action?: string): false {
  const message = action
    ? `Cannot ${action} in Viewer Mode`
    : 'This feature is disabled in Viewer Mode'

  toast.error(message, {
    id: 'viewer-mode', // Prevent duplicate toasts
  })

  return false
}

/**
 * Guard function for admin-only actions.
 * Returns true if admin, shows toast and returns false otherwise.
 *
 * @param isAdmin - Whether the current user is an admin
 * @param action - Optional description of the blocked action
 * @returns true if admin, false otherwise
 *
 * @example
 * if (!requireAdmin(isAdmin, 'save changes')) return
 */
export function requireAdmin(isAdmin: boolean, action?: string): boolean {
  if (!isAdmin) {
    showViewerModeToast(action)
    return false
  }
  return true
}
