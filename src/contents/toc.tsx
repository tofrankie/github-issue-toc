import styleText from 'data-text:./toc.css'
import type { PlasmoCSConfig, PlasmoCSUIJSXContainer, PlasmoGetStyle, PlasmoRender } from 'plasmo'
import { useCallback, useEffect, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'

type Heading = {
  level: number
  text: string
  element: HTMLElement
}

declare global {
  interface Window {
    __plasmoTocRoot: Root
  }
}

export const getStyle: PlasmoGetStyle = () => {
  const style = document.createElement('style')
  style.textContent = styleText
  return style
}

export const config: PlasmoCSConfig = {
  matches: ['https://github.com/*/*/issues/*'],
  css: ['./toc.css'],
  run_at: 'document_idle'
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
    }, 200)
  })
}

export const render: PlasmoRender<PlasmoCSUIJSXContainer> = async ({ createRootContainer }) => {
  const rootContainer = await createRootContainer()
  const root = createRoot(rootContainer)
  window.__plasmoTocRoot = root
  root.render(<Toc />)

  onIssueContentUpdate()
}

function findHeadings() {
  const markdownBody: HTMLElement = document.querySelector('.edit-comment-hide .markdown-body')
  const headings: NodeListOf<HTMLElement> = markdownBody.querySelectorAll('h1, h2, h3, h4, h5, h6')
  return [...headings]
}

function formatHeadings(headings: HTMLElement[]): Heading[] {
  return headings
    .map(heading => {
      const headingLevel = Number(heading.tagName[1])
      const headingText = heading.textContent

      if (!headingText) return null

      return {
        level: headingLevel,
        text: headingText,
        element: heading
      }
    })
    .filter(Boolean)
}

function onIssueContentUpdate() {
  const observer = new MutationObserver(mutationsList => {
    // 当 issue 内容更新时，会先移除 TimelineItem 再重新添加
    const addedNodeList = mutationsList
      .filter(mutationRecord => {
        return mutationRecord.type === 'childList' && mutationRecord.addedNodes.length > 0
      })
      .map(mutationRecord => mutationRecord.addedNodes)
      .flat()

    if (addedNodeList.length === 0) return

    const firstCommentContainer = document.querySelector(
      '.js-discussion .TimelineItem .timeline-comment'
    )

    // @ts-ignore
    if (addedNodeList.includes(firstCommentContainer)) return

    recreateRoot()
  })

  const node = document.querySelector('.js-discussion')
  observer.observe(node, {
    childList: true,
    subtree: true
  })
}

async function recreateRoot() {
  const rootContainer = await getRootContainer()

  if (window.__plasmoTocRoot) {
    window.__plasmoTocRoot.unmount()
  }

  const root = createRoot(rootContainer as Element)
  window.__plasmoTocRoot = root
  root.render(<Toc />)
}

function throttle(func: () => any, wait: number) {
  let prev = 0
  let timer

  return function (...args) {
    const now = +new Date()
    if (timer) clearTimeout(timer)

    if (now >= prev + wait) {
      prev = now
      func.apply(this, args)
      return
    }

    timer = setTimeout(() => {
      prev = now
      func.apply(this, args)
    }, wait)
  }
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

  useEffect(() => {
    window.removeEventListener('scroll', setActiveToc)
    window.addEventListener('scroll', setActiveToc)

    return () => {
      window.removeEventListener('scroll', setActiveToc)
    }
  }, [headings])

  const setActiveToc = useCallback(
    throttle(() => {
      let activeHeadingId: string

      for (let i = 0; i < headings.length; i++) {
        const { element } = headings[i]
        const rect = element.getBoundingClientRect()
        if (rect.top >= 0 && rect.top <= window.innerHeight / 2) {
          activeHeadingId = element.id
          break
        }
      }

      document.querySelectorAll('#plasmo-toc .toc-li a').forEach(link => {
        link.parentElement.classList.toggle(
          'toc-li-active',
          link.getAttribute('href') === `#${activeHeadingId}`
        )
      })
    }, 100),
    [headings]
  )

  const minLevel = Math.min(...headings.map(heading => heading.level))

  if (headings.length === 0) return null

  // TODO: 指定 max-height
  return (
    <div className="toc">
      <div className="text-bold discussion-sidebar-heading">Table of contents</div>
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
