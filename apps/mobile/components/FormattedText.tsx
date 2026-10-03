import React from 'react'
import { Text, StyleSheet, TextStyle } from 'react-native'
import { colors } from '../constants/colors'

interface FormattedTextProps {
  text: string
  style?: TextStyle | TextStyle[]
  onPressMention?: (username: string) => void
  onPressHashtag?: (hashtag: string) => void
}

export function FormattedText({
  text,
  style,
  onPressMention,
  onPressHashtag,
}: FormattedTextProps) {
  if (!text) return null

  // Split text by mention pattern (@username) and hashtags (#hashtag)
  const tokens = text.split(/(@[a-zA-Z0-9_]{1,30}|#[a-zA-Z0-9_]+)/g)

  return (
    <Text style={style}>
      {tokens.map((token, index) => {
        if (token.startsWith('@')) {
          const username = token.slice(1)
          return (
            <Text
              key={index}
              style={styles.mention}
              onPress={() => onPressMention?.(username)}
            >
              {token}
            </Text>
          )
        }
        if (token.startsWith('#')) {
          return (
            <Text
              key={index}
              style={styles.hashtag}
              onPress={() => onPressHashtag?.(token)}
            >
              {token}
            </Text>
          )
        }
        return <Text key={index}>{token}</Text>
      })}
    </Text>
  )
}

const styles = StyleSheet.create({
  mention: {
    color: colors.brand,
    fontWeight: '700',
  },
  hashtag: {
    color: colors.brand,
    fontWeight: '600',
  },
})
