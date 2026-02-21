import { useState, useEffect } from 'react'

export default function Settings({ open, onClose, autoScroll, onAutoScrollChange }) {
  const [localAutoScroll, setLocalAutoScroll] = useState(autoScroll)

  useEffect(() => {
    if (open) setLocalAutoScroll(autoScroll)
  }, [open, autoScroll])

  const handleAutoScrollChange = (e) => {
    const v = e.target.checked
    setLocalAutoScroll(v)
    onAutoScrollChange(v)
  }

  if (!open) return null

  return (
    <>
      <div className="settings-backdrop" onClick={onClose} aria-hidden="true" />
      <div className="settings-panel" role="dialog" aria-label="Настройки">
        <div className="settings-header">
          <h3>Настройки</h3>
          <button type="button" className="settings-close" onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </div>
        <div className="settings-body">
          <label className="settings-option">
            <input
              type="checkbox"
              checked={localAutoScroll}
              onChange={handleAutoScrollChange}
            />
            <span>Автоскролл текста при воспроизведении</span>
          </label>
        </div>
      </div>
    </>
  )
}
