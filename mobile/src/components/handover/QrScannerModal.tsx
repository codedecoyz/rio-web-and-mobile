import React, { useEffect, useRef } from 'react'
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { X } from 'lucide-react-native'
import { Button } from '@/components/ui/Button'
import { formatHandoverCode, normalizeHandoverCode } from '@/domain/handoverCode'
import { colors, fonts, radii } from '@/theme/tokens'

export function QrScannerModal({
  visible,
  onCode,
  onClose,
}: {
  visible: boolean
  onCode: (formattedCode: string) => void
  onClose: () => void
}) {
  const [permission, requestPermission] = useCameraPermissions()
  const insets = useSafeAreaInsets()
  const handledRef = useRef(false)

  useEffect(() => {
    if (visible) {
      handledRef.current = false
      if (permission && !permission.granted && permission.canAskAgain) {
        void requestPermission()
      }
    }
  }, [visible, permission, requestPermission])

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.container, { paddingTop: Math.max(insets.top, 12), paddingBottom: Math.max(insets.bottom, 16) }]}>
        <View style={styles.topBar}>
          <Text style={styles.title}>Scan handover QR</Text>
          <Pressable onPress={onClose} style={styles.closeBtn} accessibilityLabel="Close scanner">
            <X size={22} color={colors.chalk} />
          </Pressable>
        </View>

        {!permission?.granted ? (
          <View style={styles.permissionBox}>
            <Text style={styles.permHeading}>Camera access needed</Text>
            <Text style={styles.permBody}>Allow camera access to scan a studentâ€™s handover QR code, or close to type the 16-character code manually.</Text>
            <Button label="Allow camera" onPress={() => void requestPermission()} />
            <Button label="Enter code manually" variant="secondary" onPress={onClose} />
          </View>
        ) : (
          <View style={styles.cameraWrap}>
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={(result) => {
                if (handledRef.current) return
                const normalized = normalizeHandoverCode(result.data ?? '')
                if (!normalized) return
                handledRef.current = true
                onCode(formatHandoverCode(normalized))
              }}
            />
            <View style={styles.overlay}>
              <View style={styles.frame} />
              <Text style={styles.hint}>Point at the QR code shown by the giver</Text>
            </View>
          </View>
        )}
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.ink,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  title: {
    fontFamily: fonts.displaySemiBold,
    fontSize: 20,
    color: colors.chalk,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: 'rgba(250, 248, 243, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraWrap: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
    borderRadius: radii.card,
    marginHorizontal: 12,
  },
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
    backgroundColor: 'rgba(27, 36, 32, 0.28)',
  },
  frame: {
    width: 236,
    height: 236,
    borderRadius: radii.card,
    borderWidth: 3,
    borderColor: colors.chalk,
    backgroundColor: 'transparent',
  },
  hint: {
    fontFamily: fonts.sansMedium,
    fontSize: 14,
    color: colors.chalk,
    backgroundColor: 'rgba(27, 36, 32, 0.72)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.pill,
  },
  permissionBox: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    gap: 14,
  },
  permHeading: {
    fontFamily: fonts.displaySemiBold,
    fontSize: 22,
    color: colors.chalk,
  },
  permBody: {
    fontFamily: fonts.sansRegular,
    fontSize: 15,
    lineHeight: 22,
    color: colors.stone,
  },
})
