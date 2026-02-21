import { useRef } from 'react'

export default function FileUpload({ onAudioSelect, onTextSelect, audioName, textName }) {
  const audioInputRef = useRef(null)
  const textInputRef = useRef(null)

  const handleAudioChange = (e) => {
    const file = e.target.files?.[0]
    if (file?.type === 'audio/mpeg' || file?.name.toLowerCase().endsWith('.mp3')) {
      onAudioSelect(file)
    }
    e.target.value = ''
  }

  const handleTextChange = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (ev) => onTextSelect(ev.target?.result ?? '', file.name)
      reader.readAsText(file)
    }
    e.target.value = ''
  }

  return (
    <section className="file-upload">
      <div className="upload-row">
        <input
          ref={audioInputRef}
          type="file"
          accept=".mp3,audio/mpeg"
          onChange={handleAudioChange}
          id="audio-input"
          className="hidden-input"
        />
        <label htmlFor="audio-input" className="upload-btn">
          {audioName ? `MP3: ${audioName}` : 'Выбрать MP3'}
        </label>
        <input
          ref={textInputRef}
          type="file"
          accept=".txt,text/plain"
          onChange={handleTextChange}
          id="text-input"
          className="hidden-input"
        />
        <label htmlFor="text-input" className="upload-btn">
          {textName ? `Текст: ${textName}` : 'Выбрать текст (TXT)'}
        </label>
      </div>
    </section>
  )
}
