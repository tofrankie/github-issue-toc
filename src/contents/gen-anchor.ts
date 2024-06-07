import type { PlasmoCSConfig } from 'plasmo'

import { findHeadings } from '@/utils'

export const config: PlasmoCSConfig = {
  matches: ['https://github.com/*/*/issues/*'],
  run_at: 'document_end'
}

insertAnchor()

function insertAnchor() {
  const headings = findHeadings()

  headings.forEach((heading, index) => {
    heading.setAttribute('id', `heading-${index}`)
  })
}
