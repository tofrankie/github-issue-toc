import styleText from 'data-text:./toc.css'
import type { PlasmoCSConfig, PlasmoCSUIJSXContainer, PlasmoGetStyle, PlasmoRender } from 'plasmo'
import { useCallback, useEffect, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'

import { MESSAGE_TYPE } from '@/constants'
import { findHeadings, formatHeadings, isGitHubIssuePage, throttle, type Heading } from '@/utils'

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
  matches: ['https://github.com/*'], // https://github.com/*/*/issues/*
  css: ['./toc.css'],
  run_at: 'document_end'
}

export const getRootContainer = () => {
  return new Promise(resolve => {
    const timer = setInterval(() => {
      const rootContainer = document.querySelector('#plasmo-toc')
      if (rootContainer) {
        clearInterval(timer)
        resolve(rootContainer)
        return
      }

      const rootContainerParent = document.querySelector('[data-testid="sticky-sidebar"] > div')
      if (rootContainerParent) {
        clearInterval(timer)

        const rootContainer = document.createElement('div')
        rootContainer.id = 'plasmo-toc'
        rootContainerParent.insertBefore(rootContainer, rootContainerParent.firstChild)

        resolve(rootContainer)
      }
    }, 200)
  })
}

export const render: PlasmoRender<PlasmoCSUIJSXContainer> = async ({ createRootContainer }) => {
  const url = document.location.href
  if (!isGitHubIssuePage(url)) return

  const rootContainer = await createRootContainer()
  const root = createRoot(rootContainer)
  window.__plasmoTocRoot = root
  root.render(<Toc />)

  onIssueUpdate()
}

let observer: MutationObserver

// TODO: 监听内容高度变化，调整 toc 容器高度
function onIssueUpdate() {
  if (observer) observer.disconnect()

  // 监听 issue 内容更新
  observer = new MutationObserver(mutationsList => {
    const addedNodeList = mutationsList
      .filter(mutationRecord => {
        return mutationRecord.type === 'childList' && mutationRecord.addedNodes.length > 0
      })
      .map(mutationRecord => mutationRecord.addedNodes)
      .flat()

    if (addedNodeList.length === 0) return

    recreateRoot()
  })

  const node = document.querySelector('[data-testid="issue-body"]')
  observer.observe(node, {
    childList: true,
    subtree: true,
    characterData: true
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

  onIssueUpdate()
}

export default function Toc() {
  const [headings, setHeadings] = useState<Heading[]>([])
  const [activeHeadingId, setActiveHeadingId] = useState('')

  useEffect(() => {
    const headings = findHeadings()
    const formattedHeadings = formatHeadings(headings)

    headings.forEach((heading, index) => {
      heading.setAttribute('id', `heading-${index}`)
    })

    setHeadings(formattedHeadings)
  }, [])

  useEffect(() => {
    window.removeEventListener('scroll', updateActiveToc)
    if (headings.length === 0) return

    window.addEventListener('scroll', updateActiveToc)
    return () => {
      window.removeEventListener('scroll', updateActiveToc)
    }
  }, [headings])

  useEffect(() => {
    if (headings.length === 0) return

    const metaDataContianer = document.querySelector(
      '[data-testid="issue-viewer-metadata-container"]'
    )
    const metaDataPane = document.querySelector('[data-testid="issue-viewer-metadata-pane"]')
    const plasmoToc = metaDataContianer.querySelector('#plasmo-toc') as HTMLElement

    // margin-top + border
    const extraHeight = 16 + 1
    const stickyContainerHeight =
      metaDataContianer.clientHeight - metaDataPane.clientHeight - extraHeight

    plasmoToc.style.height = `${stickyContainerHeight}px`
  }, [headings])

  useEffect(() => {
    if (!headings.length || activeHeadingId) return
    updateActiveToc()
  }, [headings, activeHeadingId])

  const updateActiveToc = useCallback(
    throttle(() => {
      const headingsWithTop = headings.map(item => {
        const { top } = item.element.getBoundingClientRect()
        return { ...item, top: top - 84 } // 72 + 24
      })

      let matchedIndex = headingsWithTop.findIndex(item => item.top >= 0)

      const allHeadingInvisible = matchedIndex === -1
      const reachedBottom =
        document.documentElement.clientHeight + window.scrollY ===
        document.documentElement.scrollHeight

      if (allHeadingInvisible || reachedBottom) {
        matchedIndex = headingsWithTop.length - 1
      } else if (headingsWithTop[matchedIndex].top > 0 && matchedIndex > 0) {
        matchedIndex--
      }

      const activeHeadingId = headingsWithTop[matchedIndex].element.id
      setActiveHeadingId(activeHeadingId)
    }, 100),
    [headings]
  )

  const scrollToHeading = useCallback((e: React.MouseEvent<HTMLLIElement>) => {
    const headingId = e.currentTarget.dataset.href?.split('#')[1]
    const headingElement = document.getElementById(headingId)
    if (!headingElement) return
    window.scrollTo({ top: headingElement.offsetTop + 24, behavior: 'instant' })
  }, [])

  if (headings.length === 0) return null

  const minLevel = Math.min(...headings.map(heading => heading.level))
  return (
    <div className="toc">
      <div className="toc-heading text-bold discussion-sidebar-heading">Table of contents</div>
      <ul className="toc-ul">
        {headings.map((heading, index) => {
          const { level, text } = heading
          return (
            <li
              key={`${text}_${level}_${index}`}
              data-href={`#heading-${index}`}
              onClick={scrollToHeading}
              className={`toc-li ${activeHeadingId === `heading-${index}` ? 'toc-li-active' : ''}`}>
              <div
                className="toc-li-text"
                style={{ paddingLeft: `${(heading.level - minLevel) * 16 + 8}px` }}>
                {text}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

chrome.runtime.onMessage.addListener(throttle(onBackgroundMessage, 500))

let plasmoTocMounting = false

function onBackgroundMessage(message: { type: string; payload: any }) {
  try {
    if (message.type !== MESSAGE_TYPE.PLASMO_TOC_MOUNT) return

    if (plasmoTocMounting) return
    plasmoTocMounting = true

    const rootContainer = document.querySelector('#plasmo-toc')
    if (rootContainer) return

    recreateRoot()
  } finally {
    plasmoTocMounting = false
  }
}
