import { useCallback, useEffect, useRef, useState } from 'react'

type SpeechRecognitionCtor = new () => SpeechRecognition

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null
  return (
    (window as Window & { webkitSpeechRecognition?: SpeechRecognitionCtor })
      .webkitSpeechRecognition ??
    (window as Window & { SpeechRecognition?: SpeechRecognitionCtor })
      .SpeechRecognition ??
    null
  )
}

export function isVoiceSupported(): boolean {
  return getRecognitionCtor() !== null
}

type Options = {
  lang: string
  enabled: boolean
  vocabulary?: string[]
  onResult: (text: string) => void
  onError?: (message: string) => void
}

export function useVoiceRecognition({ lang, enabled, vocabulary = [], onResult, onError }: Options) {
  const [listening, setListening] = useState(false)
  const [interim, setInterim] = useState('')
  const recRef = useRef<SpeechRecognition | null>(null)
  const enabledRef = useRef(enabled)
  const onResultRef = useRef(onResult)
  onResultRef.current = onResult
  enabledRef.current = enabled

  useEffect(() => {
    const Ctor = getRecognitionCtor()
    if (!Ctor) return

    const rec = new Ctor()
    rec.lang = lang
    rec.continuous = true
    rec.interimResults = true
    rec.maxAlternatives = 3

    if (vocabulary.length > 0) {
      const SpeechGrammarListCtor =
        window.webkitSpeechGrammarList ?? window.SpeechGrammarList
      if (SpeechGrammarListCtor) {
        try {
          const list = new SpeechGrammarListCtor()
          const terms = vocabulary.slice(0, 120).map((w) => w.replace(/[^\p{L}\p{N}]/gu, ''))
          const unique = [...new Set(terms.filter((w) => w.length > 2))]
          if (unique.length) {
            const body = unique.join(' | ')
            list.addFromString(`#JSGF V1.0; grammar tabel; public <term> = ${body} ;`, 1)
            rec.grammars = list
          }
        } catch {
          /* grammar optional */
        }
      }
    }

    rec.onresult = (e: SpeechRecognitionEvent) => {
      let interimText = ''
      let finalText = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const chunk = e.results[i][0]?.transcript ?? ''
        if (e.results[i].isFinal) finalText += chunk
        else interimText += chunk
      }
      setInterim(interimText.trim())
      if (finalText.trim()) {
        onResultRef.current(finalText.trim())
        setInterim('')
      }
    }

    rec.onerror = (e: SpeechRecognitionErrorEvent) => {
      if (e.error === 'aborted' || e.error === 'no-speech') return
      onError?.(e.error)
      setListening(false)
    }

    rec.onend = () => {
      setListening(false)
      if (enabledRef.current) {
        try {
          rec.start()
          setListening(true)
        } catch {
          /* ignore */
        }
      }
    }

    recRef.current = rec
    return () => {
      rec.abort()
      recRef.current = null
    }
  }, [lang, vocabulary, onError])

  useEffect(() => {
    if (!enabled && listening) {
      recRef.current?.stop()
      setListening(false)
    }
  }, [enabled, listening])

  const toggle = useCallback(() => {
    const rec = recRef.current
    if (!rec) return false
    if (listening) {
      rec.stop()
      setListening(false)
      setInterim('')
      return false
    }
    try {
      rec.start()
      setListening(true)
      return true
    } catch {
      return false
    }
  }, [listening])

  const stop = useCallback(() => {
    recRef.current?.stop()
    setListening(false)
    setInterim('')
  }, [])

  return { listening, interim, toggle, stop, supported: isVoiceSupported() }
}
