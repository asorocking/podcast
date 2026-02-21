import { useState, useMemo, useRef, useEffect } from 'react'

function splitSentences(text) {
  if (!text?.trim()) return []
  const bySentence = text.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean)
  if (bySentence.length > 0) return bySentence
  return text.split(/\n+/).map((s) => s.trim()).filter(Boolean)
}

function tokenize(sentence) {
  if (!sentence?.trim()) return []
  const tokens = []
  const re = /[\w'-]+|[^\w\s]/g
  let m
  while ((m = re.exec(sentence)) !== null) {
    tokens.push({ word: m[0], start: m.index, end: m.index + m[0].length })
  }
  return tokens
}

export default function TranscriptView({
  transcript,
  dictionary,
  currentTime,
  duration,
  tooltip,
  initialScrollTop = 0,
  autoScrollEnabled = true,
  onWordClick,
  onCloseTooltip,
  onCloseTooltipAndResume,
  onScrollPositionChange,
}) {
  const [hoverWord, setHoverWord] = useState(null)
  const sentenceRefs = useRef([])
  const containerRef = useRef(null)
  const tooltipRef = useRef(null)
  const scrollSaveTimeoutRef = useRef(null)

  const sentences = useMemo(() => splitSentences(transcript), [transcript])

  const activeIndex = useMemo(() => {
    if (!sentences.length || !duration || duration <= 0 || !Number.isFinite(currentTime))
      return -1
    const ratio = Math.min(1, Math.max(0, currentTime / duration))
    return Math.min(sentences.length - 1, Math.floor(ratio * sentences.length))
  }, [sentences.length, currentTime, duration])

  useEffect(() => {
    if (!autoScrollEnabled) return
    const el = sentenceRefs.current[activeIndex]
    if (!el || !containerRef.current) return
    el.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [activeIndex, autoScrollEnabled])

  // Restore scroll position when transcript is first rendered or initialScrollTop is restored
  useEffect(() => {
    const el = containerRef.current
    if (!el || !transcript?.trim()) return
    if (initialScrollTop > 0) {
      requestAnimationFrame(() => {
        if (containerRef.current) containerRef.current.scrollTop = initialScrollTop
      })
    }
  }, [transcript?.trim(), initialScrollTop])

  // Save scroll position (debounced)
  useEffect(() => {
    const el = containerRef.current
    if (!el || !onScrollPositionChange) return
    const handleScroll = () => {
      if (scrollSaveTimeoutRef.current) clearTimeout(scrollSaveTimeoutRef.current)
      scrollSaveTimeoutRef.current = setTimeout(() => {
        onScrollPositionChange(el.scrollTop)
      }, 150)
    }
    el.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      el.removeEventListener('scroll', handleScroll)
      if (scrollSaveTimeoutRef.current) clearTimeout(scrollSaveTimeoutRef.current)
    }
  }, [transcript?.trim(), onScrollPositionChange])

  // Click outside tooltip: close and resume playback
  useEffect(() => {
    if (!tooltip) return
    const handleClick = (e) => {
      if (tooltipRef.current && tooltipRef.current.contains(e.target)) return
      onCloseTooltipAndResume?.()
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [tooltip, onCloseTooltipAndResume])

  const getTranslation = (word) => {
    if (!dictionary || !word) return null
    const key = word.replace(/^['"]|['"]$/g, '').toLowerCase()
    return dictionary[key] ?? null
  }

  const handleWordClick = (word) => {
    const key = word.replace(/^['"]|['"]$/g, '').toLowerCase()
    const translation = dictionary?.[key] ?? null
    onWordClick?.(key, translation)
  }

  if (!transcript?.trim()) {
    return (
      <section className="transcript-view">
        <h2>Текст подкаста</h2>
        <p className="transcript-placeholder">Загрузите TXT с текстом подкаста</p>
      </section>
    )
  }

  return (
    <section className="transcript-view">
      <h2>Текст подкаста</h2>
      <div ref={containerRef} className="transcript-text">
        {sentences.map((sentence, idx) => {
          const tokens = tokenize(sentence)
          const isActive = idx === activeIndex
          return (
            <p
              key={`${idx}-${sentence.slice(0, 20)}`}
              ref={(el) => { sentenceRefs.current[idx] = el }}
              className={`transcript-sentence ${isActive ? 'transcript-sentence--active' : ''}`}
            >
              {tokens.map((t, i) => {
                const translation = getTranslation(t.word)
                const isWord = /^[\w'-]+$/i.test(t.word)
                const nextIsWord = i + 1 < tokens.length && /^[\w'-]+$/i.test(tokens[i + 1].word)
                const key = `${idx}-${i}-${t.start}`
                if (isWord) {
                  return (
                    <span key={key}>
                      <span
                        className={`word ${translation ? 'word--translatable' : ''} ${hoverWord === key ? 'word--hover' : ''}`}
                        onClick={() => handleWordClick(t.word)}
                        onMouseEnter={() => setHoverWord(key)}
                        onMouseLeave={() => setHoverWord(null)}
                        title={translation ? translation : undefined}
                      >
                        {t.word}
                      </span>
                      {nextIsWord ? ' ' : null}
                    </span>
                  )
                }
                return <span key={key}>{t.word}</span>
              })}
            </p>
          )
        })}
      </div>
      {tooltip && (
        <div
          ref={tooltipRef}
          className="translation-tooltip"
          role="dialog"
          aria-label="Перевод"
          onClick={(e) => e.stopPropagation()}
        >
          <strong>{tooltip.word}</strong>
          <span className="translation-value">
            {tooltip.translation && tooltip.translation !== '—' ? tooltip.translation : '— нет в словаре'}
          </span>
          <button type="button" className="tooltip-close" onClick={onCloseTooltip}>
            ×
          </button>
        </div>
      )}
    </section>
  )
}
