import { useState, useEffect, useCallback, useRef } from 'react'
import FileUpload from './components/FileUpload'
import PlaybackPanel from './components/PlaybackPanel'
import TranscriptView from './components/TranscriptView'
import Settings from './components/Settings'
import { saveAudio, loadAudio } from './utils/audioStorage'
import './App.css'

const STORAGE_KEY = 'podcast-app-state'

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {}
}

// Initialize persisted state from localStorage so we don't overwrite on first render
function getInitialState() {
  const saved = loadState()
  if (!saved) return {}
  return {
    transcript: saved.transcript ?? '',
    title: saved.title ?? 'Подкаст',
    subtitle: saved.subtitle ?? '',
    currentTime: typeof saved.currentTime === 'number' ? saved.currentTime : 0,
    scrollPosition: typeof saved.scrollPosition === 'number' ? saved.scrollPosition : 0,
    playbackRate: typeof saved.playbackRate === 'number' ? saved.playbackRate : 1,
    volume: typeof saved.volume === 'number' ? saved.volume : 0.8,
    audioFileName: saved.audioFileName ?? '',
    textFileName: saved.textFileName ?? '',
    autoScroll: saved.autoScroll !== false,
  }
}

export default function App() {
  const initial = useRef(getInitialState()).current

  const [audioFile, setAudioFile] = useState(null)
  const [audioUrl, setAudioUrl] = useState('')
  const [audioFileName, setAudioFileName] = useState(initial.audioFileName ?? '')
  const [textFileName, setTextFileName] = useState(initial.textFileName ?? '')
  const [transcript, setTranscript] = useState(initial.transcript ?? '')
  const [title, setTitle] = useState(initial.title ?? 'Подкаст')
  const [subtitle, setSubtitle] = useState(initial.subtitle ?? '')
  const [dictionary, setDictionary] = useState(null)

  const [currentTime, setCurrentTime] = useState(initial.currentTime ?? 0)
  const [duration, setDuration] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [playbackRate, setPlaybackRate] = useState(initial.playbackRate ?? 1)
  const [volume, setVolume] = useState(initial.volume ?? 0.8)
  const [tooltip, setTooltip] = useState(null)
  const [scrollPosition, setScrollPosition] = useState(initial.scrollPosition ?? 0)
  const [initialSeekTime, setInitialSeekTime] = useState(null)
  const [autoScroll, setAutoScroll] = useState(initial.autoScroll !== false)
  const [restoredAudioUrl, setRestoredAudioUrl] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const restoredAudioUrlRef = useRef('')

  useEffect(() => {
    const base = import.meta.env.BASE_URL
    fetch(`${base}dictionary.json`)
      .then((r) => r.ok ? r.json() : {})
      .then(setDictionary)
      .catch(() => setDictionary({}))
  }, [])

  // Restore audio from IndexedDB on mount
  useEffect(() => {
    let cancelled = false
    loadAudio().then((data) => {
      if (cancelled || !data?.blob) return
      if (restoredAudioUrlRef.current) URL.revokeObjectURL(restoredAudioUrlRef.current)
      const url = URL.createObjectURL(data.blob)
      restoredAudioUrlRef.current = url
      setRestoredAudioUrl(url)
      if (data.filename) setAudioFileName((prev) => prev || data.filename)
      if (initial.currentTime > 0) setInitialSeekTime(initial.currentTime)
    }).catch(() => {})
    return () => {
      cancelled = true
      if (restoredAudioUrlRef.current) {
        URL.revokeObjectURL(restoredAudioUrlRef.current)
        restoredAudioUrlRef.current = ''
      }
    }
  }, [])

  // audioUrl: from selected file or from restored IndexedDB blob
  useEffect(() => {
    if (audioFile) {
      const url = URL.createObjectURL(audioFile)
      setAudioUrl(url)
      return () => URL.revokeObjectURL(url)
    }
    setAudioUrl(restoredAudioUrl)
  }, [audioFile, restoredAudioUrl])

  // Persist state
  useEffect(() => {
    saveState({
      transcript,
      title,
      subtitle,
      currentTime,
      scrollPosition,
      playbackRate,
      volume,
      autoScroll,
      audioFileName: audioFileName || undefined,
      textFileName: textFileName || undefined,
    })
  }, [transcript, title, subtitle, currentTime, scrollPosition, playbackRate, volume, autoScroll, audioFileName, textFileName])

  const handleAudioSelect = useCallback((file) => {
    saveAudio(file, file.name).catch(() => {})
    setAudioFile(file)
    setDuration(0)
    setIsPlaying(false)
    const saved = loadState()
    const savedTime = saved && typeof saved.currentTime === 'number' ? saved.currentTime : 0
    setCurrentTime(savedTime)
    setInitialSeekTime(savedTime > 0 ? savedTime : null)
  }, [])

  const handleTextSelect = useCallback((text, fileName = '') => {
    setTranscript(text)
    setTextFileName(fileName)
    const firstLine = text.split('\n')[0]?.trim()
    if (firstLine && firstLine.length < 120) setTitle(firstLine)
  }, [])

  const handleSeek = useCallback((time, dur) => {
    setCurrentTime(time)
    if (dur !== undefined && Number.isFinite(dur)) setDuration(dur)
  }, [])

  const handlePlayPause = useCallback((nextPlaying) => {
    setTooltip(null)
    setIsPlaying(nextPlaying)
  }, [])

  const handleWordClick = useCallback((word, translation) => {
    setIsPlaying(false)
    setTooltip({ word, translation })
  }, [])

  const handleCloseTooltip = useCallback(() => {
    setTooltip(null)
  }, [])

  const handleInitialSeekDone = useCallback(() => {
    setInitialSeekTime(null)
  }, [])

  return (
    <div className="app">
      <header className="app-header">
        <h1>Загрузить подкаст</h1>
        <button
          type="button"
          className="settings-btn"
          onClick={() => setSettingsOpen(true)}
          aria-label="Настройки"
        >
          ⚙
        </button>
      </header>

      <Settings
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        autoScroll={autoScroll}
        onAutoScrollChange={setAutoScroll}
      />

      <main className="app-main">
        <FileUpload
          onAudioSelect={handleAudioSelect}
          onTextSelect={handleTextSelect}
          audioName={audioFileName}
          textName={textFileName}
        />
        <TranscriptView
          transcript={transcript}
          dictionary={dictionary}
          currentTime={currentTime}
          duration={duration}
          tooltip={tooltip}
          initialScrollTop={scrollPosition}
          autoScrollEnabled={autoScroll && initialSeekTime == null}
          onWordClick={handleWordClick}
          onCloseTooltip={handleCloseTooltip}
          onCloseTooltipAndResume={handleCloseTooltip}
          onScrollPositionChange={setScrollPosition}
        />
      </main>

      <footer className="app-footer">
        <PlaybackPanel
          audioUrl={audioUrl}
          title={title}
          subtitle={subtitle}
          isPlaying={isPlaying}
          currentTime={currentTime}
          duration={duration}
          playbackRate={playbackRate}
          volume={volume}
          initialSeekTime={initialSeekTime}
          onPlayPause={handlePlayPause}
          onSeek={handleSeek}
          onInitialSeekDone={handleInitialSeekDone}
          onRateChange={setPlaybackRate}
          onVolumeChange={setVolume}
        />
      </footer>
    </div>
  )
}
