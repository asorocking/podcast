import { useRef, useEffect, useState } from 'react'

const SPEEDS = [0.8, 0.9, 1, 1.25, 1.5]

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function PlaybackPanel({
  audioUrl,
  title,
  subtitle,
  isPlaying,
  currentTime,
  duration,
  playbackRate,
  volume,
  initialSeekTime,
  onPlayPause,
  onSeek,
  onInitialSeekDone,
  onRateChange,
  onVolumeChange,
}) {
  const audioRef = useRef(null)
  const progressRef = useRef(null)
  const [speedOpen, setSpeedOpen] = useState(false)
  const speedMenuRef = useRef(null)

  useEffect(() => {
    const el = audioRef.current
    if (!el) return
    el.volume = volume
    el.playbackRate = playbackRate
  }, [volume, playbackRate])

  useEffect(() => {
    const el = audioRef.current
    if (!el || !audioUrl) return
    el.src = audioUrl
  }, [audioUrl])

  useEffect(() => {
    const el = audioRef.current
    if (!el) return
    if (isPlaying) el.play().catch(() => {})
    else el.pause()
  }, [isPlaying])

  const handleTimeUpdate = () => {
    const el = audioRef.current
    if (el) onSeek?.(el.currentTime, el.duration)
  }
  const handleLoadedMetadata = () => {
    const el = audioRef.current
    if (!el) return
    if (typeof initialSeekTime === 'number' && initialSeekTime > 0) {
      el.currentTime = initialSeekTime
      onSeek?.(initialSeekTime, el.duration)
      onInitialSeekDone?.()
    } else {
      onSeek?.(el.currentTime, el.duration)
    }
  }
  const handleEnded = () => onPlayPause?.(false)

  const handleProgressClick = (e) => {
    const bar = progressRef.current
    if (!bar || !duration) return
    const rect = bar.getBoundingClientRect()
    const x = e.clientX - rect.left
    const p = Math.max(0, Math.min(1, x / rect.width))
    const time = p * duration
    if (audioRef.current) audioRef.current.currentTime = time
    onSeek?.(time, duration)
  }

  useEffect(() => {
    if (!speedOpen) return
    const close = (e) => {
      if (speedMenuRef.current && !speedMenuRef.current.contains(e.target)) setSpeedOpen(false)
    }
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [speedOpen])

  const handleRewind15 = () => {
    const el = audioRef.current
    if (!el) return
    const t = Math.max(0, el.currentTime - 15)
    el.currentTime = t
    onSeek?.(t, el.duration)
  }

  const handleForward30 = () => {
    const el = audioRef.current
    if (!el) return
    const t = Math.min(el.duration, el.currentTime + 30)
    el.currentTime = t
    onSeek?.(t, el.duration)
  }

  const currentSpeedLabel = playbackRate === 1 ? '1x' : `${playbackRate}x`

  if (!audioUrl) {
    return (
      <div className="playback-panel playback-panel--empty">
        <p>Загрузите MP3 и текст подкаста</p>
      </div>
    )
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0
  const remaining = duration > 0 ? Math.max(0, duration - currentTime) : 0

  return (
    <>
      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onDurationChange={handleLoadedMetadata}
        onEnded={handleEnded}
      />
      <div className="playback-panel">
        <div className="playback-progress-section">
          <div className="playback-times-row">
            <span className="playback-time-current">{formatTime(currentTime)}</span>
            <span className="playback-time-remaining">−{formatTime(remaining)}</span>
          </div>
          <div
            ref={progressRef}
            className="progress-bar"
            onClick={handleProgressClick}
            role="progressbar"
            aria-valuenow={currentTime}
            aria-valuemin={0}
            aria-valuemax={duration}
          >
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
        </div>
        <div className="playback-bottom">
          <div className="playback-info">
            <div className="playback-meta">
              <div className="playback-title">{title || 'Подкаст'}</div>
              <div className="playback-subtitle">{subtitle || ''}</div>
            </div>
          </div>
          <div className="playback-right">
          <div className="playback-controls" ref={speedMenuRef}>
            <div className="speed-dropdown">
              <button
                type="button"
                className="speed-btn"
                onClick={(e) => { e.stopPropagation(); setSpeedOpen((v) => !v) }}
                title="Скорость"
              >
                {currentSpeedLabel}
              </button>
              {speedOpen && (
                <ul className="speed-menu">
                  {SPEEDS.map((s) => (
                    <li key={s}>
                      <button
                        type="button"
                        className={playbackRate === s ? 'speed-menu-item speed-menu-item--active' : 'speed-menu-item'}
                        onClick={() => { onRateChange?.(s); setSpeedOpen(false) }}
                      >
                        {s === 1 ? '1x' : `${s}x`}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <button type="button" className="icon-btn" onClick={handleRewind15} title="Назад 15 с">
              <span className="icon-rewind">15</span>
            </button>
            <button
              type="button"
              className="icon-btn play-pause"
              onClick={() => onPlayPause?.(!isPlaying)}
              title={isPlaying ? 'Пауза' : 'Играть'}
            >
              {isPlaying ? (
                <span className="icon-pause">||</span>
              ) : (
                <span className="icon-play">▶</span>
              )}
            </button>
            <button type="button" className="icon-btn" onClick={handleForward30} title="Вперёд 30 с">
              <span className="icon-forward">30</span>
            </button>
          </div>
          <div className="volume-control">
            <span className="icon-volume" aria-hidden>🔊</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={volume}
              onChange={(e) => onVolumeChange?.(+e.target.value)}
              className="volume-slider"
            />
          </div>
          <button type="button" className="icon-btn" title="Информация">
            <span className="icon-info">i</span>
          </button>
          <button type="button" className="icon-btn" title="Плейлист">
            <span className="icon-list">≡</span>
          </button>
          </div>
        </div>
      </div>
    </>
  )
}
