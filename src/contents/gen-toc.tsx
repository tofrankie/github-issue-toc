import type { PlasmoCSConfig, PlasmoGetInlineAnchor } from 'plasmo'
import { useEffect, useState } from 'react'

import { findHeadings } from '@/utils'

type Heading = {
  level: number
  text: string
}

export const config: PlasmoCSConfig = {
  matches: ['https://github.com/*/*/issues/*'],
  run_at: 'document_end'
}

export const getInlineAnchor: PlasmoGetInlineAnchor = async () => ({
  element: document.querySelector('.Layout-sidebar > div'),
  insertPosition: 'afterend'
})

function getHeadings() {
  let minLevel = 6
  const headings = findHeadings()
  const formattedHeadings: Heading[] = headings
    .map(heading => {
      const headingLevel = Number(heading.tagName[1])
      const headingText = heading.textContent

      if (!headingText) return null

      minLevel = Math.min(minLevel, headingLevel)

      return { level: headingLevel, text: headingText }
    })
    .filter(Boolean)

  return formattedHeadings
}

export default function SidebarHeadings() {
  const [headings, setHeadings] = useState<Heading[]>([])

  useEffect(() => {
    const headings = getHeadings()
    setHeadings(headings)
  }, [])

  return (
    <div className="discussion-sidebar-item sidebar-headings">
      <ul>
        {headings.map((heading, index) => {
          const { level, text } = heading
          return (
            <li key={level + text}>
              <a href={`#heading-${index}`}>{text}</a>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
