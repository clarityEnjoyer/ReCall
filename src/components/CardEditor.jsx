import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getDeck, getCardsByDeck, createCard, updateCard, deleteCard } from '../lib/storage'

export default function CardEditor() {
  const { deckId } = useParams()
  const navigate = useNavigate()
  const [deck, setDeck] = useState(null)
  const [cards, setCards] = useState([])
  const [front, setFront] = useState('')
  const [back, setBack] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [loading, setLoading] = useState(true)

  // Web Speech API Support
  const SpeechRecognitionClass = window.webkitSpeechRecognition || window.SpeechRecognition
  const isSpeechSupported = !!SpeechRecognitionClass
  const [isContinuousMode, setIsContinuousMode] = useState(false)
  const [isTurboMode, setIsTurboMode] = useState(false)
  const [soundEnabled, setSoundEnabled] = useState(() => {
    return localStorage.getItem('recall-voice-sound') === 'true'
  })
  const [voiceLang, setVoiceLang] = useState(() => {
    return localStorage.getItem('recall-voice-lang') || 'en-US'
  })
  const [activeMicField, setActiveMicField] = useState(null)
  const [voiceFocusedField, setVoiceFocusedField] = useState('front')
  const [voiceToast, setVoiceToast] = useState(null)
  
  // Modal & Onboarding States
  const [hasSeenVoicePrompt, setHasSeenVoicePrompt] = useState(() => {
    return localStorage.getItem('recall-voice-prompt-seen') === 'true'
  })
  const [showVoiceManual, setShowVoiceManual] = useState(false)

  const singleRecRef = useRef(null)
  const toastTimeoutRef = useRef(null)

  const frontRef = useRef(front)
  const backRef = useRef(back)
  const editingIdRef = useRef(editingId)
  const voiceFocusedFieldRef = useRef(voiceFocusedField)
  const isTurboModeRef = useRef(isTurboMode)

  const frontInputRef = useRef(null)
  const backInputRef = useRef(null)
  const handleSaveCardRef = useRef(null)

  useEffect(() => { frontRef.current = front }, [front])
  useEffect(() => { backRef.current = back }, [back])
  useEffect(() => { editingIdRef.current = editingId }, [editingId])
  useEffect(() => { voiceFocusedFieldRef.current = voiceFocusedField }, [voiceFocusedField])
  useEffect(() => { isTurboModeRef.current = isTurboMode }, [isTurboMode])

  useEffect(() => {
    localStorage.setItem('recall-voice-sound', soundEnabled)
  }, [soundEnabled])

  useEffect(() => {
    localStorage.setItem('recall-voice-lang', voiceLang)
  }, [voiceLang])

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current)
      if (singleRecRef.current) {
        singleRecRef.current.stop()
      }
    }
  }, [])

  const showVoiceToast = (text, type = 'success') => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current)
    setVoiceToast({ text, type })
    toastTimeoutRef.current = setTimeout(() => {
      setVoiceToast(null)
    }, 1500)
  }

  const playSuccessSound = () => {
    if (!soundEnabled) return
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      
      osc.connect(gain)
      gain.connect(ctx.destination)
      
      osc.type = 'sine'
      osc.frequency.setValueAtTime(523.25, ctx.currentTime)
      osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.08)
      
      gain.gain.setValueAtTime(0.08, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2)
      
      osc.start()
      osc.stop(ctx.currentTime + 0.2)
    } catch (err) {
      console.error('Audio synthesis failed:', err)
    }
  }

  const loadData = useCallback(async () => {
    try {
      const d = await getDeck(Number(deckId))
      if (!d) { navigate('/'); return }
      setDeck(d)
      const c = await getCardsByDeck(Number(deckId))
      setCards(c)
    } catch (err) {
      console.error('Failed to load deck:', err)
    } finally {
      setLoading(false)
    }
  }, [deckId, navigate])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleSaveCard = async () => {
    const fVal = frontRef.current.trim()
    const bVal = backRef.current.trim()
    if (!fVal || !bVal) {
      showVoiceToast('Front and Back are required!', 'danger')
      return
    }

    if (editingIdRef.current) {
      await updateCard(editingIdRef.current, {
        front: fVal,
        back: bVal,
        updatedAt: new Date(),
      })
      setEditingId(null)
    } else {
      await createCard({
        deckId: Number(deckId),
        front: fVal,
        back: bVal,
        createdAt: new Date(),
        updatedAt: new Date(),
        state: 0,
        difficulty: 0,
        stability: 0,
        retrievability: 0,
        lastReview: null,
        nextReview: null,
        reps: 0,
        lapses: 0,
      })
    }
    setFront('')
    setBack('')
    frontRef.current = ''
    backRef.current = ''
    
    setVoiceFocusedField('front')
    setTimeout(() => {
      frontInputRef.current?.focus()
    }, 50)
    
    playSuccessSound()
    showVoiceToast('✨ Card saved successfully!')
    loadData()
  }

  useEffect(() => {
    handleSaveCardRef.current = handleSaveCard
  }, [handleSaveCard])

  const handleSubmit = async (e) => {
    if (e) e.preventDefault()
    await handleSaveCard()
  }

  const insertTextIntoField = (field, textToInsert) => {
    const textarea = field === 'front' ? frontInputRef.current : backInputRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const currentValue = field === 'front' ? front : back
    const setter = field === 'front' ? setFront : setBack

    let newValue = ''
    let newCursorPos = start

    newValue = currentValue.substring(0, start) + textToInsert + currentValue.substring(end)
    newCursorPos = start + textToInsert.length

    setter(newValue)
    
    // Restore focus and cursor position in next tick
    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(newCursorPos, newCursorPos)
    }, 0)
  }

  const handleEdit = (card) => {
    setEditingId(card.id)
    setFront(card.front)
    setBack(card.back)
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setFront('')
    setBack('')
  }

  const handleDelete = async (id) => {
    if (window.confirm('Delete this card?')) {
      await deleteCard(id)
      loadData()
    }
  }

  const toggleSingleMic = (field) => {
    if (activeMicField === field) {
      if (singleRecRef.current) {
        singleRecRef.current.stop()
      }
      setActiveMicField(null)
    } else {
      if (singleRecRef.current) {
        singleRecRef.current.stop()
      }
      
      if (!SpeechRecognitionClass) return
      
      const recognition = new SpeechRecognitionClass()
      recognition.continuous = false
      recognition.interimResults = false
      recognition.lang = voiceLang
      
      recognition.onstart = () => {
        setActiveMicField(field)
      }
      
      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript.trim()
        if (field === 'front') {
          setFront(prev => prev ? `${prev} ${transcript}` : transcript)
          showVoiceToast('🎤 Front updated')
        } else {
          setBack(prev => prev ? `${prev} ${transcript}` : transcript)
          showVoiceToast('🎤 Back updated')
        }
      }
      
      recognition.onerror = (event) => {
        if (event.error !== 'aborted') {
          showVoiceToast('⚠️ Speech recognition error', 'danger')
        }
        setActiveMicField(null)
      }
      
      recognition.onend = () => {
        setActiveMicField(null)
        singleRecRef.current = null
      }
      
      singleRecRef.current = recognition
      recognition.start()
    }
  }

  const processVoiceCommand = useCallback((text) => {
    // Strip punctuation at the very end to match exact commands reliably
    const cleanText = text.trim().toLowerCase().replace(/[.,!?]\s*$/g, '')
    
    if (cleanText.includes('save card') || cleanText.includes('add card') || cleanText === 'submit' || cleanText === 'save') {
      handleSaveCardRef.current?.()
      return
    }
    
    if (cleanText.startsWith('clear')) {
      const target = cleanText.includes('front') || cleanText.includes('question') ? 'front' 
                   : cleanText.includes('back') || cleanText.includes('answer') ? 'back' 
                   : voiceFocusedFieldRef.current;
      
      if (target === 'front') {
        setFront('')
        frontRef.current = ''
        showVoiceToast('🧹 Question cleared')
      } else {
        setBack('')
        backRef.current = ''
        showVoiceToast('🧹 Answer cleared')
      }
      return
    }
    
    // Exact Focus Switch / Toggle Voice Commands
    const switchCommands = [
      'switch', 'switch field', 'switch fields', 'switch focus', 'switch target',
      'toggle', 'toggle field', 'toggle fields', 'toggle focus',
      'next', 'next field', 'next focus',
      'other field', 'change field', 'flip', 'flip field'
    ]
    const frontFocusCommands = [
      'front', 'question', 'first',
      'focus front', 'focus question', 'focus first',
      'go to front', 'go to question', 'go to first',
      'select front', 'select question', 'select first',
      'switch to front', 'switch to question', 'switch to first',
      'target front', 'target question'
    ]
    const backFocusCommands = [
      'back', 'answer', 'second',
      'focus back', 'focus answer', 'focus second',
      'go to back', 'go to answer', 'go to second',
      'select back', 'select answer', 'select second',
      'switch to back', 'switch to answer', 'switch to second',
      'target back', 'target answer'
    ]
    
    if (switchCommands.includes(cleanText)) {
      setVoiceFocusedField(prev => {
        const next = prev === 'front' ? 'back' : 'front'
        showVoiceToast(`👉 Focus: ${next === 'front' ? 'Question' : 'Answer'}`)
        if (next === 'front') {
          frontInputRef.current?.focus()
        } else {
          backInputRef.current?.focus()
        }
        return next
      })
      return
    }
    
    if (frontFocusCommands.includes(cleanText)) {
      setVoiceFocusedField('front')
      frontInputRef.current?.focus()
      showVoiceToast('👉 Focus: Question')
      return
    }
    
    if (backFocusCommands.includes(cleanText)) {
      setVoiceFocusedField('back')
      backInputRef.current?.focus()
      showVoiceToast('👉 Focus: Answer')
      return
    }
    
    // Support punctuation right after the prefix word (e.g. "Front. What is...")
    const frontPrefixMatch = text.match(/^(?:front|question|first)\s*[.,:\-]?\s+(.+)$/i)
    const backPrefixMatch = text.match(/^(?:back|answer|second)\s*[.,:\-]?\s+(.+)$/i)
    
    if (frontPrefixMatch) {
      const content = frontPrefixMatch[1].trim()
      setFront(prev => prev ? `${prev} ${content}` : content)
      setVoiceFocusedField('front')
      frontInputRef.current?.focus()
      showVoiceToast('✍️ Front updated')
    } else if (backPrefixMatch) {
      const content = backPrefixMatch[1].trim()
      setBack(prev => prev ? `${prev} ${content}` : content)
      setVoiceFocusedField('back')
      backInputRef.current?.focus()
      showVoiceToast('✍️ Back updated')
    } else {
      const currentField = voiceFocusedFieldRef.current
      if (currentField === 'front') {
        if (isTurboModeRef.current) {
          setFront(text)
          frontRef.current = text
          setVoiceFocusedField('back')
          backInputRef.current?.focus()
          showVoiceToast('👉 Focus: Answer')
        } else {
          setFront(prev => prev ? `${prev} ${text}` : text)
          frontInputRef.current?.focus()
        }
      } else {
        if (isTurboModeRef.current) {
          setBack(text)
          backRef.current = text
          handleSaveCardRef.current?.()
        } else {
          setBack(prev => prev ? `${prev} ${text}` : text)
          backInputRef.current?.focus()
        }
      }
    }
  }, [])

  // Continuous speech recognition effect
  useEffect(() => {
    if (!SpeechRecognitionClass || !isContinuousMode) return
    
    const recognition = new SpeechRecognitionClass()
    recognition.continuous = true
    recognition.interimResults = false
    recognition.lang = voiceLang
    
    let isStoppedExplicitly = false
    
    recognition.onresult = (event) => {
      const lastResultIndex = event.results.length - 1
      const transcript = event.results[lastResultIndex][0].transcript
      processVoiceCommand(transcript)
    }
    
    recognition.onerror = (event) => {
      if (event.error !== 'aborted') {
        console.error('Continuous speech recognition error:', event.error)
      }
    }
    
    recognition.onend = () => {
      if (!isStoppedExplicitly) {
        try {
          recognition.start()
        } catch (err) {
          console.error('Failed to restart speech recognition:', err)
        }
      }
    }
    
    recognition.start()
    
    return () => {
      isStoppedExplicitly = true
      recognition.stop()
    }
  }, [isContinuousMode, processVoiceCommand, SpeechRecognitionClass, voiceLang])

  if (loading) {
    return (
      <div>
        <div className="skeleton" style={{ width: 200, height: 36, marginBottom: 24 }} />
        <div className="skeleton" style={{ height: 150, borderRadius: 'var(--radius-lg)', marginBottom: 16 }} />
        <div className="skeleton" style={{ height: 60, borderRadius: 'var(--radius-lg)', marginBottom: 8 }} />
        <div className="skeleton" style={{ height: 60, borderRadius: 'var(--radius-lg)' }} />
      </div>
    )
  }

  return (
    <div className="animate-fade-in">
      {voiceToast && (
        <div className={`voice-feedback-toast ${voiceToast.type === 'danger' ? 'danger' : ''}`}>
          {voiceToast.type === 'danger' ? '⚠️' : '✨'} {voiceToast.text}
        </div>
      )}

      {/* Voice Prompt Overlay */}
      {!hasSeenVoicePrompt && isSpeechSupported && !showVoiceManual && (
        <div className="voice-prompt-overlay surface-elevated animate-fade-in-up" style={{
          position: 'fixed', bottom: 'var(--space-xl)', right: 'var(--space-xl)', 
          padding: 'var(--space-lg)', zIndex: 1000, maxWidth: '320px',
          borderLeft: '4px solid var(--color-peach)'
        }}>
          <h4 style={{marginBottom: 'var(--space-sm)', fontSize: 'var(--font-size-md)'}}>🎙️ Try Voice Creation?</h4>
          <p style={{fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-md)', color: 'var(--text-secondary)'}}>
            Would you like to test adding flashcards hands-free using your voice?
          </p>
          <div style={{display: 'flex', gap: 'var(--space-sm)'}}>
            <button className="btn btn-primary btn-sm" onClick={() => {
              setHasSeenVoicePrompt(true)
              localStorage.setItem('recall-voice-prompt-seen', 'true')
              setShowVoiceManual(true)
            }}>Yes, show me how</button>
            <button className="btn btn-ghost btn-sm" onClick={() => {
              setHasSeenVoicePrompt(true)
              localStorage.setItem('recall-voice-prompt-seen', 'true')
            }}>No thanks</button>
          </div>
        </div>
      )}

      {/* Voice Manual Modal */}
      {showVoiceManual && (
        <div className="modal-overlay animate-fade-in" style={{
          position: 'fixed', inset: 0, background: 'var(--bg-overlay)', zIndex: 2000,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div className="surface-elevated animate-scale-in" style={{
            padding: 'var(--space-xl)', maxWidth: '500px', width: '90%', borderRadius: 'var(--radius-lg)',
            maxHeight: '90vh', overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)' }}>
              <h2 style={{fontSize: 'var(--font-size-xl)', margin: 0}}>🎙️ Voice Creation Manual</h2>
              <button className="btn btn-ghost" style={{padding: 'var(--space-xs)'}} onClick={() => setShowVoiceManual(false)}>✕</button>
            </div>
            
            <div style={{color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)', display: 'flex', flexDirection: 'column', gap: 'var(--space-md)'}}>
              <p>Welcome to Hands-Free flashcard creation! There are two ways to use your voice:</p>
              
              <div style={{background: 'var(--bg-secondary)', padding: 'var(--space-md)', borderRadius: 'var(--radius-md)'}}>
                <h4 style={{color: 'var(--text-primary)', marginBottom: 'var(--space-xs)', fontSize: 'var(--font-size-sm)'}}>1. Single Field Dictation</h4>
                <p>Click the 🎙️ microphone icon inside any text box to dictate only for that field. Recording stops automatically when you pause.</p>
              </div>

              <div style={{background: 'var(--bg-secondary)', padding: 'var(--space-md)', borderRadius: 'var(--radius-md)'}}>
                <h4 style={{color: 'var(--text-primary)', marginBottom: 'var(--space-xs)', fontSize: 'var(--font-size-sm)'}}>2. Hands-Free Continuous Mode</h4>
                <p>Toggle "🤖 Hands-Free Mode" at the top to keep the microphone open. You can use these commands:</p>
                <ul style={{marginTop: 'var(--space-sm)', paddingLeft: 'var(--space-lg)', display: 'flex', flexDirection: 'column', gap: '4px'}}>
                  <li><strong>"Front [your text]"</strong> - Sets the question</li>
                  <li><strong>"Back [your text]"</strong> - Sets the answer</li>
                  <li><strong>"Switch"</strong> - Swaps focus between Front and Back</li>
                  <li><strong>"Save card"</strong> - Saves the flashcard</li>
                  <li><strong>"Clear"</strong> - Empties both fields</li>
                </ul>
              </div>
              
              <p><em>Pro-tip: If you don't use a command word, it will type wherever your cursor is focused! You can simply click a field to focus it while listening.</em></p>
            </div>

            <div style={{marginTop: 'var(--space-xl)', display: 'flex', justifyContent: 'flex-end'}}>
              <button className="btn btn-primary" onClick={() => setShowVoiceManual(false)}>Got it!</button>
            </div>
          </div>
        </div>
      )}

      <div className="editor-header">
        <div className="editor-header-left">
          <button className="back-btn" onClick={() => navigate('/')} id="back-to-dashboard" title="Back to Dashboard">
            ←
          </button>
          <div>
            <h1 className="page-title" style={{ fontSize: 'var(--font-size-2xl)' }}>{deck?.name}</h1>
            <p className="page-subtitle">{cards.length} card{cards.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => navigate(`/study/${deckId}`)}
          disabled={cards.length === 0}
          id="start-study"
        >
          Study Now →
        </button>
      </div>

      {/* Voice controls panel */}
      {isSpeechSupported && (
        <div className="voice-panel surface animate-fade-in" id="voice-controls-panel">
          <div className="voice-panel-header">
            <div className="voice-panel-title">
              🎙️ Voice Card Creator
              <button 
                className="btn btn-ghost btn-sm" 
                style={{padding: '2px 6px', fontSize: 'var(--font-size-xs)'}}
                onClick={() => setShowVoiceManual(true)}
                title="Show Voice Manual"
              >
                ❓ Help
              </button>
            </div>
            <div className="voice-panel-actions">
              <select 
                value={voiceLang} 
                onChange={(e) => setVoiceLang(e.target.value)}
                className="voice-lang-select input"
                style={{ padding: '2px 8px', height: 'auto', minHeight: '24px', fontSize: 'var(--font-size-xs)', borderRadius: 'var(--radius-sm)', marginRight: 'var(--space-sm)' }}
                title="Speech Language"
              >
                <option value="en-US">🇬🇧 English</option>
                <option value="pl-PL">🇵🇱 Polski</option>
                <option value="ru-RU">🇷🇺 Русский</option>
                <option value="es-ES">🇪🇸 Español</option>
                <option value="fr-FR">🇫🇷 Français</option>
                <option value="de-DE">🇩🇪 Deutsch</option>
              </select>
              <label className="voice-toggle-label">
                <input
                  type="checkbox"
                  checked={soundEnabled}
                  onChange={(e) => setSoundEnabled(e.target.checked)}
                  className="voice-toggle-checkbox"
                />
                🔊 Sound cues
              </label>
              <label className="voice-toggle-label">
                <input
                  type="checkbox"
                  checked={isContinuousMode}
                  onChange={(e) => {
                    setIsContinuousMode(e.target.checked)
                    if (e.target.checked) {
                      setVoiceFocusedField('front')
                      showVoiceToast('🎙️ Hands-Free Mode Active')
                    } else {
                      showVoiceToast('🎙️ Hands-Free Mode Disabled')
                    }
                  }}
                  className="voice-toggle-checkbox"
                  id="voice-continuous-toggle"
                />
                🤖 Hands-Free Mode
              </label>
              <label className="voice-toggle-label">
                <input
                  type="checkbox"
                  checked={isTurboMode}
                  onChange={(e) => {
                    setIsTurboMode(e.target.checked)
                    if (e.target.checked) {
                      if (!isContinuousMode) setIsContinuousMode(true)
                      setVoiceFocusedField('front')
                      showVoiceToast('🚀 Turbo Mode Active')
                    }
                  }}
                  className="voice-toggle-checkbox"
                />
                🚀 Turbo Mode
              </label>
            </div>
          </div>
          
          {isContinuousMode && (
            <div className="voice-indicator-banner animate-fade-in">
              <div className="voice-indicator-left">
                <span className="voice-indicator-dot"></span>
                <span>Persistent listening active...</span>
              </div>
              <span className="voice-active-field-badge">
                Focus: {voiceFocusedField === 'front' ? 'Question' : 'Answer'}
              </span>
            </div>
          )}

          <div className="voice-commands-list">
            <div className="voice-command-item">
              <code>front [text]</code> <span>Set Front value</span>
            </div>
            <div className="voice-command-item">
              <code>back [text]</code> <span>Set Back value</span>
            </div>
            <div className="voice-command-item">
              <code>switch</code> <span>Toggle target field</span>
            </div>
            <div className="voice-command-item">
              <code>save card</code> <span>Save & clear</span>
            </div>
          </div>
        </div>
      )}

      {/* Card Form */}
      <form onSubmit={handleSubmit} className="card-form surface animate-fade-in-up" id="card-form">
        <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, marginBottom: 'var(--space-md)' }}>
          {editingId ? '✏️ Edit Card' : '✨ Add New Card'}
        </h3>
        <div className="card-form-grid">
          <div className="form-group">
            <label className="label" htmlFor="card-front">Front (Question)</label>
            <div className="card-editor-toolbar">
              <div className="toolbar-section emojis">
                {['💡', '❓', '✨', '✅', '🔥', '📝', '🧠', '⭐', '👍', '👎', '❌', '🔍', '🚀', '💬', '🎵', '❤️'].map(emoji => (
                  <button
                    key={emoji}
                    type="button"
                    className="toolbar-btn emoji-btn"
                    onClick={() => insertTextIntoField('front', emoji)}
                    title={`Insert ${emoji}`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
            <div className="textarea-container">
              <textarea
                id="card-front"
                ref={frontInputRef}
                className={`input textarea ${isContinuousMode && voiceFocusedField === 'front' ? 'voice-focused' : ''}`}
                placeholder="What is the capital of France?"
                value={front}
                onChange={e => setFront(e.target.value)}
                onFocus={() => setVoiceFocusedField('front')}
                style={{ minHeight: 80 }}
              />
              {isSpeechSupported && !isContinuousMode && (
                <button
                  type="button"
                  className={`mic-btn ${activeMicField === 'front' ? 'active' : ''}`}
                  onClick={() => toggleSingleMic('front')}
                  title="Dictate Front (Question)"
                  id="mic-front"
                >
                  🎙️
                </button>
              )}
            </div>
          </div>
          <div className="form-group">
            <label className="label" htmlFor="card-back">Back (Answer)</label>
            <div className="card-editor-toolbar">
              <div className="toolbar-section emojis">
                {['💡', '❓', '✨', '✅', '🔥', '📝', '🧠', '⭐', '👍', '👎', '❌', '🔍', '🚀', '💬', '🎵', '❤️'].map(emoji => (
                  <button
                    key={emoji}
                    type="button"
                    className="toolbar-btn emoji-btn"
                    onClick={() => insertTextIntoField('back', emoji)}
                    title={`Insert ${emoji}`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
            <div className="textarea-container">
              <textarea
                id="card-back"
                ref={backInputRef}
                className={`input textarea ${isContinuousMode && voiceFocusedField === 'back' ? 'voice-focused' : ''}`}
                placeholder="Paris"
                value={back}
                onChange={e => setBack(e.target.value)}
                onFocus={() => setVoiceFocusedField('back')}
                style={{ minHeight: 80 }}
              />
              {isSpeechSupported && !isContinuousMode && (
                <button
                  type="button"
                  className={`mic-btn ${activeMicField === 'back' ? 'active' : ''}`}
                  onClick={() => toggleSingleMic('back')}
                  title="Dictate Back (Answer)"
                  id="mic-back"
                >
                  🎙️
                </button>
              )}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
          <button type="submit" className="btn btn-primary" id="save-card">
            {editingId ? 'Update Card' : 'Add Card'}
          </button>
          {editingId && (
            <button type="button" className="btn btn-ghost" onClick={handleCancelEdit} id="cancel-edit">
              Cancel
            </button>
          )}
        </div>
      </form>

      {/* Card List */}
      {cards.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🃏</div>
          <h3>No cards yet</h3>
          <p>Add your first flashcard using the form above to start building your knowledge!</p>
        </div>
      ) : (
        <div className="card-list stagger-children">
          {cards.map(card => (
            <div key={card.id} className="card-item surface" id={`card-${card.id}`}>
              <div className="card-item-content">
                <span className="card-item-front" dangerouslySetInnerHTML={{ __html: card.front }} />
                <span className="card-item-separator">→</span>
                <span className="card-item-back" dangerouslySetInnerHTML={{ __html: card.back }} />
              </div>
              <div className="card-item-actions">
                <button className="btn btn-sm btn-ghost" onClick={() => handleEdit(card)} title="Edit" id={`edit-card-${card.id}`}>
                  ✏️
                </button>
                <button className="btn btn-sm btn-ghost" onClick={() => handleDelete(card.id)} title="Delete" id={`edit-card-${card.id}`}>
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
