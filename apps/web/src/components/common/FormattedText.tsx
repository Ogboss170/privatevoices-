'use client'

import React from 'react'
import Link from 'next/link'

interface FormattedTextProps {
  text: string
  className?: string
}

export default function FormattedText({ text, className = '' }: FormattedTextProps): React.JSX.Element {
  if (!text) return <></>

  // Split text by mention pattern (@username) and hashtags (#hashtag)
  const tokens = text.split(/(@[a-zA-Z0-9_]{1,30}|#[a-zA-Z0-9_]+)/g)

  return (
    <span className={className}>
      {tokens.map((token, index) => {
        if (token.startsWith('@')) {
          const username = token.slice(1)
          return (
            <Link
              key={index}
              href={`/@${username}`}
              className="font-semibold text-brand-600 hover:text-brand-700 hover:underline transition-colors inline-block"
              onClick={(e) => e.stopPropagation()}
            >
              {token}
            </Link>
          )
        }
        if (token.startsWith('#')) {
          const tag = token.slice(1)
          return (
            <Link
              key={index}
              href={`/explore?q=%23${encodeURIComponent(tag)}&tab=voices`}
              className="font-semibold text-brand-600 hover:text-brand-700 hover:underline transition-colors inline-block"
              onClick={(e) => e.stopPropagation()}
            >
              {token}
            </Link>
          )
        }
        return <React.Fragment key={index}>{token}</React.Fragment>
      })}
    </span>
  )
}
