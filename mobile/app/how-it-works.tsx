import React from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { QrCode, Repeat, ShieldCheck, Users } from 'lucide-react-native'
import { Card } from '@/components/ui/Feedback'
import { CATEGORIES } from '@/domain/catalog'
import { LOGISTICS_CO2E_PER_TRANSFER_KG } from '@/domain/impact'
import { formatINR } from '@/domain/money'
import { DAMAGE_DEDUCTION_BPS, DEPOSIT_BPS, RENTAL_PERIODS, RENT_TO_OWN_CREDIT_BPS } from '@/domain/rental'
import { colors, fonts, radii, textStyles } from '@/theme/tokens'

const STEPS = [
  {
    title: 'List it where it stands',
    body: 'Photograph the cooler, mattress or drafter in your room. Set a starting price, the lowest price youâ€™d accept, and the day you leave.',
  },
  {
    title: 'The price walks down',
    body: 'The price falls steadily towards your floor and reaches it two hours before you leave. Buyers see the floor and the deadline up front.',
  },
  {
    title: 'Claim, then meet',
    body: 'A buyer claims the item and the money waits in sandbox escrow. Your exact room is never shown publicly; you arrange the handover yourselves.',
  },
  {
    title: 'Scan to finish',
    body: 'You show a one-time QR code, the buyer scans it, and the sale settles. Codes expire in 10 minutes and work once.',
  },
  {
    title: 'Nothing gets dumped',
    body: 'In your final hour, anything unsold is routed to campus staff by your warden, and they take custody with the same QR handover.',
  },
]

const pct = (bps: number) => `${bps / 100}%`

export default function HowItWorksScreen() {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={textStyles.h1}>How a handover works</Text>
      <Text style={textStyles.bodyMuted}>
        Nothing moves off campus. Everything runs on the exact same rules in the app and the database.
      </Text>

      <View style={{ gap: 12 }}>
        {STEPS.map((s, i) => (
          <Card key={s.title} style={{ gap: 4 }}>
            <Text style={styles.stepNum}>{i + 1}</Text>
            <Text style={textStyles.h3}>{s.title}</Text>
            <Text style={textStyles.bodyMuted}>{s.body}</Text>
          </Card>
        ))}
      </View>

      <Text style={textStyles.h2}>The rules, in numbers</Text>
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        {(Object.keys(RENTAL_PERIODS) as (keyof typeof RENTAL_PERIODS)[]).map((k, idx) => (
          <RuleRow
            key={k}
            term={`Rent for a ${RENTAL_PERIODS[k].label.toLowerCase()}`}
            value={`${pct(RENTAL_PERIODS[k].bps)} of starting price`}
            bordered={idx > 0}
          />
        ))}
        <RuleRow term="Refundable deposit" value={`${pct(DEPOSIT_BPS)} of starting price`} bordered />
        <RuleRow term="Rent-to-own credit" value={`${pct(RENT_TO_OWN_CREDIT_BPS)} of rent paid`} bordered />
        <RuleRow term="Damage deduction" value={`${pct(DAMAGE_DEDUCTION_BPS)} of deposit`} bordered />
        <RuleRow term="Price rounding" value="Nearest â‚¹5, never below floor" bordered />
      </Card>

      <View style={{ gap: 10 }}>
        <Feature Icon={ShieldCheck} title="Room numbers stay private" body="Only you and your hostelâ€™s warden can see your block and room." />
        <Feature Icon={QrCode} title="Single-use QR codes" body="Checked by the server, valid for 10 minutes, and useless once scanned." />
        <Feature Icon={Repeat} title="Rent first, buy later" body="Half of what you paid in rent comes off the price if you decide to keep it." />
        <Feature Icon={Users} title="Wardens settle disputes" body="A warden from your hostel, who isnâ€™t involved, decides refunds and damage claims." />
      </View>

      <View style={styles.impactBox}>
        <Text style={styles.impactTitle}>What a handover is estimated to save</Text>
        <Text style={styles.impactSub}>
          Estimates, not measurements: embodied carbon plus {LOGISTICS_CO2E_PER_TRANSFER_KG.toFixed(1)} kg avoided transport.
        </Text>
        {CATEGORIES.filter((c) => c.embodiedCo2eKg > 0).map((c) => (
          <View key={c.slug} style={styles.impactRow}>
            <Text style={styles.impactCat}>{c.name}</Text>
            <Text style={styles.impactMetrics}>
              {(c.embodiedCo2eKg + LOGISTICS_CO2E_PER_TRANSFER_KG).toFixed(1)} kg COâ‚‚e Â· {c.tareKg} kg Â· {formatINR(c.defaultStartPaise)}
            </Text>
          </View>
        ))}
      </View>
    </ScrollView>
  )
}

function RuleRow({ term, value, bordered }: { term: string; value: string; bordered?: boolean }) {
  return (
    <View style={[styles.ruleRow, bordered && styles.ruleBorder]}>
      <Text style={styles.ruleTerm}>{term}</Text>
      <Text style={textStyles.caption}>{value}</Text>
    </View>
  )
}

function Feature({ Icon, title, body }: { Icon: typeof ShieldCheck; title: string; body: string }) {
  return (
    <Card style={{ gap: 6 }}>
      <View style={styles.featureIcon}>
        <Icon size={18} color={colors.forest} />
      </View>
      <Text style={textStyles.h3}>{title}</Text>
      <Text style={textStyles.bodyMuted}>{body}</Text>
    </Card>
  )
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  stepNum: {
    fontFamily: fonts.displayBold,
    fontSize: 30,
    color: colors.forest,
  },
  ruleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    padding: 14,
  },
  ruleBorder: {
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  ruleTerm: {
    fontFamily: fonts.sansMedium,
    fontSize: 14,
    color: colors.ink,
  },
  featureIcon: {
    width: 36,
    height: 36,
    borderRadius: 999,
    backgroundColor: colors.forestTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  impactBox: {
    backgroundColor: colors.forest,
    borderRadius: radii.card,
    padding: 18,
    gap: 10,
  },
  impactTitle: {
    fontFamily: fonts.displaySemiBold,
    fontSize: 22,
    color: colors.chalk,
  },
  impactSub: {
    fontFamily: fonts.sansRegular,
    fontSize: 13,
    color: 'rgba(250, 248, 243, 0.85)',
  },
  impactRow: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(250, 248, 243, 0.2)',
    paddingTop: 8,
    gap: 2,
  },
  impactCat: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 14,
    color: colors.chalk,
  },
  impactMetrics: {
    fontFamily: fonts.sansRegular,
    fontSize: 13,
    color: 'rgba(250, 248, 243, 0.85)',
    fontVariant: ['tabular-nums'],
  },
})
