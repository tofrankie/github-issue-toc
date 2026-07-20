export function isGitHubIssuePage(url: string) {
  const pattern = /^https:\/\/github\.com\/[^/]+\/[^/]+\/issues\/\d+/
  return pattern.test(url)
}

export function findHeadings() {
  const markdownBody = document.querySelector(
    '[data-testid="issue-viewer-issue-container"] [data-testid="markdown-body"]'
  )
  const headings = markdownBody.querySelectorAll('h1, h2, h3, h4, h5, h6')
  return [...headings]
}

export interface Heading {
  level: number
  text: string
  element: Element
}

export function formatHeadings(headings: Element[]): Heading[] {
  return headings
    .map(heading => {
      const headingLevel = Number(heading.tagName[1])
      const headingText = heading.textContent

      if (!headingText) return null

      return {
        level: headingLevel,
        text: headingText,
        element: heading,
      }
    })
    .filter(Boolean)
}

export function throttle<T extends (...args: any[]) => any>(
  func: (...args: Parameters<T>) => ReturnType<T>,
  wait: number
) {
  let prev = 0
  let timer: ReturnType<typeof setTimeout>

  return function (this: any, ...args: Parameters<T>) {
    const now = Date.now()
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
