export function isGitHubIssuePage(url: string) {
  const pattern = /^https:\/\/github\.com\/[^\/]+\/[^\/]+\/issues\/\d+/
  return pattern.test(url)
}

export function findHeadings() {
  const markdownBody = document.querySelector('.edit-comment-hide .markdown-body')
  const headings = markdownBody.querySelectorAll('h1, h2, h3, h4, h5, h6')
  return [...headings]
}

export type Heading = {
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
        element: heading
      }
    })
    .filter(Boolean)
}

export function throttle(func: (...args: any[]) => any, wait: number) {
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
