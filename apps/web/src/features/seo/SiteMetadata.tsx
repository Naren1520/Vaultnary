import { useEffect } from 'react'

const SITE_URL = 'https://vaultnary.vercel.app'

interface SiteMetadataProps {
  title: string
  description: string
  noIndex?: boolean
}

function setMeta(attribute: 'name' | 'property', key: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`)
  if (!element) {
    element = document.createElement('meta')
    element.setAttribute(attribute, key)
    document.head.append(element)
  }
  element.content = content
}

export default function SiteMetadata({ title, description, noIndex = false }: SiteMetadataProps) {
  useEffect(() => {
    const pageTitle = `${title} | Vaultnary`
    const canonicalUrl = `${SITE_URL}${window.location.pathname}`
    document.title = pageTitle
    setMeta('name', 'description', description)
    setMeta('name', 'robots', noIndex ? 'noindex, nofollow' : 'index, follow')
    setMeta('property', 'og:type', 'website')
    setMeta('property', 'og:site_name', 'Vaultnary')
    setMeta('property', 'og:title', pageTitle)
    setMeta('property', 'og:description', description)
    setMeta('property', 'og:url', canonicalUrl)
    setMeta('property', 'og:image', `${SITE_URL}/favicon.png`)
    setMeta('name', 'twitter:card', 'summary')
    setMeta('name', 'twitter:title', pageTitle)
    setMeta('name', 'twitter:description', description)
    setMeta('name', 'twitter:image', `${SITE_URL}/favicon.png`)

    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
    if (!canonical) {
      canonical = document.createElement('link')
      canonical.rel = 'canonical'
      document.head.append(canonical)
    }
    canonical.href = canonicalUrl
  }, [description, noIndex, title])

  return null
}
