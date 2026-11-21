import React, { useCallback, useEffect, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Svg, { Path, Rect } from 'react-native-svg'
import { CheckCircle2, QrCode, RefreshCw } from 'lucide-react-native'
import { Button } from '@/components/ui/Button'
import { Notice } from '@/components/ui/Feedback'
import { formatHandoverCode } from '@/domain/handoverCode'
import {
  getHandoverTokenStatus,
  issueHandoverToken,
  type HandoverPurpose,
  type IssuedCode,
} from '@/lib/data/transactions'
import { colors, fonts, radii } from '@/theme/tokens'

const COPY: Record<HandoverPurpose, { button: string; instruction: string }> = {
  CLAIM: {
    button: 'Show handover code',
    instruction: 'Hand over the item, then let the buyer scan this code. Scanning confirms they received it and releases payment to you.',
  },
  RENTAL_PICKUP: {
    button: 'Show pickup code',
    instruction: 'Let the renter scan this when they collect the item. Their rental starts on scan.',
  },
  RENTAL_RETURN: {
    button: 'Show return code',
    instruction: 'When you return the item, the owner scans this code to confirm. Your deposit is refunded on a clean return.',
  },
  STAFF_CUSTODY: {
    button: 'Show custody code',
    instruction: 'Campus staff or your warden scans this code when they take the item.',
  },
}

export function HandoverCodePanel({
  purpose,
  subjectId,
  onConsumed,
}: {
  purpose: HandoverPurpose
  subjectId: string
  onConsumed?: () => void
}) {
  const [issued, setIssued] = useState<IssuedCode | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<'pending' | 'consumed' | 'expired' | 'revoked' | 'unknown'>('pending')
  const [remaining, setRemaining] = useState(0)

  const issue = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await issueHandoverToken(purpose, subjectId)
      setIssued(res)
      setRemaining(Math.max(0, new Date(res.expiresAt).getTime() - Date.now()))
      setStatus('pending')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Couldnâ€™t generate a handover code.')
    } finally {
      setLoading(false)
    }
  }, [purpose, subjectId])

  useEffect(() => {
    if (!issued || status !== 'pending') return
    const tick = () => setRemaining(Math.max(0, new Date(issued.expiresAt).getTime() - Date.now()))
    tick()
    const clock = setInterval(tick, 1000)
    const poll = setInterval(async () => {
      const next = await getHandoverTokenStatus(issued.tokenId)
      if (next !== 'pending') {
        setStatus(next)
        if (next === 'consumed') onConsumed?.()
      }
    }, 4000)
    return () => {
      clearInterval(clock)
      clearInterval(poll)
    }
  }, [issued, status, onConsumed])

  if (!issued && !error) {
    return (
      <Button
        label={loading ? 'Generatingâ€¦' : COPY[purpose].button}
        icon={<QrCode size={16} color={colors.chalk} />}
        loading={loading}
        onPress={issue}
      />
    )
  }

  if (error) {
    return (
      <View style={{ gap: 10 }}>
        <Notice tone="error" title={error} />
        <Button label="Try again" variant="secondary" onPress={issue} loading={loading} />
      </View>
    )
  }

  if (status === 'consumed') {
    return (
      <View style={styles.consumedBox}>
        <CheckCircle2 size={20} color={colors.forestStrong} />
        <Text style={styles.consumedText}>Scanned and confirmed. This handover is complete.</Text>
      </View>
    )
  }

  if (!issued) return null
  const expired = status === 'pending' && remaining === 0
  const minutes = Math.floor(remaining / 60000)
  const seconds = Math.floor((remaining % 60000) / 1000)

  return (
    <View style={styles.panel}>
      <Text style={styles.heading}>Handover code</Text>
      <Text style={styles.instruction}>{COPY[purpose].instruction}</Text>

      <View style={styles.qrRow}>
        <View style={[styles.qrWrap, (expired || status !== 'pending') && { opacity: 0.3 }]}>
          <QrMatrix size={issued.qr.size} bits={issued.qr.bits} />
        </View>
        <View style={styles.codeCol}>
          <Text selectable style={styles.codeText}>
            {formatHandoverCode(issued.code)}
          </Text>
          {status === 'pending' && !expired ? (
            <Text style={styles.timer}>
              Expires in{' '}
              <Text style={styles.timerStrong}>
                {minutes}:{seconds.toString().padStart(2, '0')}
              </Text>
              . Works once.
            </Text>
          ) : (
            <Text style={styles.expiredText}>
              {status === 'revoked' ? 'A newer code replaced this one.' : 'This code has expired.'}
            </Text>
          )}
          <Button
            label="New code"
            variant="secondary"
            size="sm"
            icon={<RefreshCw size={14} color={colors.ink} />}
            onPress={issue}
            loading={loading}
          />
        </View>
      </View>
    </View>
  )
}

function QrMatrix({ size, bits }: { size: number; bits: string }) {
  let d = ''
  for (let i = 0; i < bits.length; i++) {
    if (bits[i] === '1') {
      d += `M${i % size} ${Math.floor(i / size)}h1v1h-1z`
    }
  }
  const q = 2
  return (
    <Svg width={164} height={164} viewBox={`${-q} ${-q} ${size + 2 * q} ${size + 2 * q}`}>
      <Rect x={-q} y={-q} width={size + 2 * q} height={size + 2 * q} fill={colors.chalk} />
      <Path d={d} fill={colors.ink} />
    </Svg>
  )
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: colors.chalk,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.card,
    padding: 16,
    gap: 10,
  },
  heading: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 16,
    color: colors.ink,
  },
  instruction: {
    fontFamily: fonts.sansRegular,
    fontSize: 13,
    lineHeight: 19,
    color: colors.muted,
  },
  qrRow: {
    marginTop: 6,
    gap: 14,
    alignItems: 'center',
  },
  qrWrap: {
    backgroundColor: colors.chalk,
    borderRadius: radii.media,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 8,
  },
  codeCol: {
    width: '100%',
    alignItems: 'center',
    gap: 10,
  },
  codeText: {
    fontFamily: fonts.displaySemiBold,
    fontSize: 22,
    letterSpacing: 1.5,
    color: colors.ink,
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
  },
  timer: {
    fontFamily: fonts.sansRegular,
    fontSize: 13,
    color: colors.muted,
  },
  timerStrong: {
    fontFamily: fonts.sansSemiBold,
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },
  expiredText: {
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    color: colors.clay,
  },
  consumedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.forestTint,
    borderWidth: 1,
    borderColor: colors.forestBorder,
    borderRadius: radii.card,
    padding: 14,
  },
  consumedText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 14,
    color: colors.forestStrong,
    flex: 1,
  },
})
