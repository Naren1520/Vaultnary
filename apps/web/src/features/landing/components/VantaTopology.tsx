import { useEffect, useRef } from 'react'
import './vanta-topology.css'

interface VantaEffect {
  destroy: () => void
}

interface VantaTopologyOptions {
  el: HTMLElement
  mouseControls: boolean
  touchControls: boolean
  gyroControls: boolean
  minHeight: number
  minWidth: number
  scale: number
  scaleMobile: number
  color: number
  backgroundColor: number
}

declare global {
  interface Window {
    p5?: unknown
    VANTA?: {
      TOPOLOGY?: (options: VantaTopologyOptions) => VantaEffect
    }
  }
}

const scriptLoads = new Map<string, Promise<void>>()

function loadScript(id: string, src: string): Promise<void> {
  const pendingLoad = scriptLoads.get(id)
  if (pendingLoad) return pendingLoad

  const existingScript = document.getElementById(id) as HTMLScriptElement | null
  if (existingScript?.dataset.loaded === 'true') return Promise.resolve()

  const script = existingScript ?? document.createElement('script')
  const load = new Promise<void>((resolve, reject) => {
    script.addEventListener('load', () => {
      script.dataset.loaded = 'true'
      resolve()
    }, { once: true })
    script.addEventListener('error', () => {
      script.remove()
      reject(new Error(`Unable to load topology background script: ${src}`))
    }, { once: true })
  })

  if (!existingScript) {
    script.id = id
    script.src = src
    script.async = true
    document.head.appendChild(script)
  }

  const trackedLoad = load.catch((error: unknown) => {
    scriptLoads.delete(id)
    throw error
  })
  scriptLoads.set(id, trackedLoad)
  return trackedLoad
}

async function loadTopology(): Promise<void> {
  await loadScript(
    'vaultnary-p5',
    'https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.1.9/p5.min.js',
  )
  await loadScript(
    'vaultnary-vanta-topology',
    'https://cdn.jsdelivr.net/npm/vanta@0.5.24/dist/vanta.topology.min.js',
  )
}

export default function VantaTopology() {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let disposed = false
    let effect: VantaEffect | undefined

    loadTopology()
      .then(() => {
        if (disposed || !container.isConnected) return
        const createTopology = window.VANTA?.TOPOLOGY
        if (!createTopology) {
          throw new Error('Vanta topology did not initialize after its script loaded.')
        }

        effect = createTopology({
          el: container,
          mouseControls: true,
          touchControls: true,
          gyroControls: false,
          minHeight: 200,
          minWidth: 200,
          scale: 1,
          scaleMobile: 1,
          color: 0xfafcf3,
          backgroundColor: 0x03020b,
        })
      })
      .catch((error: unknown) => {
        if (!disposed) console.error('Landing page topology background failed to load.', error)
      })

    return () => {
      disposed = true
      effect?.destroy()
      container.replaceChildren()
    }
  }, [])

  return <div ref={containerRef} className="lp-vanta-topology" aria-hidden="true" />
}
