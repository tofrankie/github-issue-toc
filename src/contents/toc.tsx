import styleText from 'data-text:./toc.css'
import type { PlasmoCSConfig, PlasmoCSUIJSXContainer, PlasmoGetStyle, PlasmoRender } from 'plasmo'
import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'

type Heading = {
  level: number
  text: string
}

export const getStyle: PlasmoGetStyle = () => {
  const style = document.createElement('style')
  style.textContent = styleText
  return style
}

export const config: PlasmoCSConfig = {
  matches: ['https://github.com/*/*/issues/*'],
  css: ['./toc.css'],
  run_at: 'document_end'
}

export const getRootContainer = () => {
  return new Promise(resolve => {
    const timer = setInterval(() => {
      const rootContainer = document.querySelector('#plasmo-toc')
      if (rootContainer) {
        resolve(rootContainer)
        return
      }

      const rootContainerParent = document.querySelector('#partial-discussion-sidebar')
      if (rootContainerParent) {
        clearInterval(timer)

        const rootContainer = document.createElement('div')
        rootContainer.id = 'plasmo-toc'
        rootContainer.className = 'discussion-sidebar-item'
        rootContainerParent.appendChild(rootContainer)

        resolve(rootContainer)
      }
    }, 137)
  })
}

export const render: PlasmoRender<PlasmoCSUIJSXContainer> = async ({ createRootContainer }) => {
  const rootContainer = await createRootContainer()
  const root = createRoot(rootContainer)
  root.render(<Toc />)
}

function findHeadings() {
  const markdownBody: HTMLElement = document.querySelector('.edit-comment-hide .markdown-body')
  const headings: NodeListOf<HTMLElement> = markdownBody.querySelectorAll('h1, h2, h3, h4, h5, h6')
  return [...headings]
}

function formatHeadings(headings: HTMLElement[]): Heading[] {
  // let minLevel = 1
  // let maxLevel = 6

  return headings
    .map(heading => {
      const headingLevel = Number(heading.tagName[1])
      const headingText = heading.textContent

      if (!headingText) return null

      // minLevel = Math.max(minLevel, headingLevel)
      // maxLevel = Math.min(maxLevel, headingLevel)

      return { level: headingLevel, text: headingText }
    })
    .filter(Boolean)
}

export default function Toc() {
  const [headings, setHeadings] = useState<Heading[]>([])

  useEffect(() => {
    const headings = findHeadings()
    const formattedHeadings = formatHeadings(headings)

    headings.forEach((heading, index) => {
      heading.setAttribute('id', `heading-${index}`)
    })

    setHeadings(formattedHeadings)
  }, [])

  const minLevel = Math.min(...headings.map(heading => heading.level))

  return (
    <div className="toc">
      <div className="text-bold discussion-sidebar-heading">Table of Contents</div>
      <ul className="toc-ul">
        {headings.map((heading, index) => {
          const { level, text } = heading
          return (
            <li key={level + text} className="toc-li">
              <a
                href={`#heading-${index}`}
                style={{ paddingLeft: `${(heading.level - minLevel) * 16 + 8}px` }}>
                {text}
              </a>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
