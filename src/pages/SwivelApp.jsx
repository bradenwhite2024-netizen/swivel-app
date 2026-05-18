import { useEffect } from 'react'

export default function SwivelApp() {
  useEffect(() => {
    const script = document.createElement('script')
    script.src = '/swivel.js'
    script.async = true
    document.body.appendChild(script)
    return () => document.body.removeChild(script)
  }, [])

  return <div id="swivel-root" dangerouslySetInnerHTML={{__html: ''}} />
}