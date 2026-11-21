import React, { useCallback, useEffect, useState } from 'react'
import { FlatList, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
import { Search, SearchX, SlidersHorizontal, X } from 'lucide-react-native'
import { ListingCard } from '@/components/listings/ListingCard'
import { Button } from '@/components/ui/Button'
import { EmptyState, Notice, Skeleton } from '@/components/ui/Feedback'
import { CheckboxRow, ChipSelect, Field, TextInputField } from '@/components/ui/Field'
import { CATEGORIES, CONDITIONS, CONDITION_KEYS, type Condition } from '@/domain/catalog'
import { useAuth } from '@/lib/auth-context'
import {
  PAGE_SIZE,
  SORTS,
  getMarketplace,
  getSavedIds,
  toggleSaved,
  type ListingCardData,
  type MarketplaceFilters,
  type Sort,
} from '@/lib/data/listings'
import { formatTime } from '@/lib/format'
import { colors, fonts, radii, textStyles } from '@/theme/tokens'

export default function MarketplaceScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ q?: string; category?: string }>()
  const { viewer } = useAuth()

  const [filters, setFilters] = useState<MarketplaceFilters>({
    q: params.q ?? '',
    category: params.category || undefined,
    sort: 'ending',
    page: 1,
  })
  const [searchDraft, setSearchDraft] = useState(params.q ?? '')
  const [filterModalOpen, setFilterModalOpen] = useState(false)
  const [draftCondition, setDraftCondition] = useState<Condition | undefined>(undefined)
  const [draftMin, setDraftMin] = useState('')
  const [draftMax, setDraftMax] = useState('')
  const [draftRentable, setDraftRentable] = useState(false)
  const [draftSort, setDraftSort] = useState<Sort>('ending')

  const [items, setItems] = useState<ListingCardData[]>([])
  const [total, setTotal] = useState(0)
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())
  const [asOf, setAsOf] = useState(Date.now())
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (params.q !== undefined || params.category !== undefined) {
      setFilters((prev) => ({
        ...prev,
        q: params.q ?? prev.q,
        category: params.category || undefined,
        page: 1,
      }))
      if (params.q !== undefined) setSearchDraft(params.q)
    }
  }, [params.q, params.category])

  const fetchListings = useCallback(
    async (nextFilters: MarketplaceFilters, append = false) => {
      const now = Date.now()
      try {
        setError(null)
        const res = await getMarketplace(nextFilters, now)
        setAsOf(now)
        setTotal(res.total)
        setItems((prev) => (append ? [...prev, ...res.items] : res.items))
        if (viewer && res.items.length) {
          const saved = await getSavedIds(res.items.map((i) => i.id))
          setSavedIds((prev) => (append ? new Set([...prev, ...saved]) : saved))
        } else if (!viewer) {
          setSavedIds(new Set())
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Listings couldnâ€™t be loaded.')
      } finally {
        setLoading(false)
        setLoadingMore(false)
        setRefreshing(false)
      }
    },
    [viewer],
  )

  useEffect(() => {
    setLoading(filters.page === 1 && items.length === 0)
    void fetchListings(filters, filters.page > 1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, viewer?.id])

  useFocusEffect(
    useCallback(() => {
      if (viewer && items.length) {
        void getSavedIds(items.map((i) => i.id)).then(setSavedIds)
      }
    }, [viewer, items]),
  )

  const handleToggleSave = async (item: ListingCardData) => {
    if (!viewer) {
      router.push('/auth/login')
      return
    }
    const currentlySaved = savedIds.has(item.id)
    setSavedIds((prev) => {
      const next = new Set(prev)
      if (currentlySaved) next.delete(item.id)
      else next.add(item.id)
      return next
    })
    try {
      await toggleSaved(item.id, currentlySaved)
    } catch {
      setSavedIds((prev) => {
        const next = new Set(prev)
        if (currentlySaved) next.add(item.id)
        else next.delete(item.id)
        return next
      })
    }
  }

  const openFilterModal = () => {
    setDraftCondition(filters.condition)
    setDraftMin(filters.min !== undefined ? String(filters.min) : '')
    setDraftMax(filters.max !== undefined ? String(filters.max) : '')
    setDraftRentable(Boolean(filters.rentable))
    setDraftSort(filters.sort)
    setFilterModalOpen(true)
  }

  const applyFilterModal = () => {
    let minVal = draftMin.trim() ? Number(draftMin.trim()) : undefined
    let maxVal = draftMax.trim() ? Number(draftMax.trim()) : undefined
    if (minVal !== undefined && !Number.isFinite(minVal)) minVal = undefined
    if (maxVal !== undefined && !Number.isFinite(maxVal)) maxVal = undefined
    if (minVal !== undefined && maxVal !== undefined && minVal > maxVal) {
      const tmp = minVal
      minVal = maxVal
      maxVal = tmp
    }
    setFilters((prev) => ({
      ...prev,
      condition: draftCondition,
      min: minVal,
      max: maxVal,
      rentable: draftRentable,
      sort: draftSort,
      page: 1,
    }))
    setFilterModalOpen(false)
  }

  const resetAllFilters = () => {
    setSearchDraft('')
    setFilters({ sort: 'ending', page: 1 })
    setFilterModalOpen(false)
  }

  const activeCount = [
    filters.q?.trim() || undefined,
    filters.category,
    filters.condition,
    filters.min,
    filters.max,
    filters.rentable || undefined,
  ].filter((v) => v !== undefined).length

  const hasMore = items.length < total

  return (
    <View style={styles.screen}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true)
              setFilters((prev) => ({ ...prev, page: 1 }))
              void fetchListings({ ...filters, page: 1 }, false)
            }}
            tintColor={colors.forest}
          />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <View style={{ flex: 1 }}>
                <Text style={textStyles.h1}>Marketplace</Text>
                <Text style={styles.subtitle}>
                  Everything here is already on campus. Prices fall towards each sellerâ€™s floor as their departure gets closer.
                </Text>
              </View>
            </View>

            <View style={styles.searchBar}>
              <View style={styles.searchWrap}>
                <Search size={18} color={colors.muted} style={styles.searchIcon} />
                <TextInputField
                  value={searchDraft}
                  onChangeText={setSearchDraft}
                  placeholder="cooler, mattressâ€¦"
                  returnKeyType="search"
                  onSubmitEditing={() => setFilters((prev) => ({ ...prev, q: searchDraft.trim(), page: 1 }))}
                  style={{ paddingLeft: 38 }}
                />
              </View>
              <Button
                label={activeCount ? `Filters (${activeCount})` : 'Filters'}
                variant="secondary"
                icon={<SlidersHorizontal size={15} color={colors.ink} />}
                onPress={openFilterModal}
              />
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsScroll}>
              <Pressable
                onPress={() => setFilters((prev) => ({ ...prev, category: undefined, page: 1 }))}
                style={[styles.chip, !filters.category ? styles.chipOn : styles.chipOff]}
              >
                <Text style={[styles.chipText, !filters.category ? styles.chipTextOn : styles.chipTextOff]}>All</Text>
              </Pressable>
              {CATEGORIES.map((c) => {
                const on = filters.category === c.slug
                return (
                  <Pressable
                    key={c.slug}
                    onPress={() => setFilters((prev) => ({ ...prev, category: c.slug, page: 1 }))}
                    style={[styles.chip, on ? styles.chipOn : styles.chipOff]}
                  >
                    <Text style={[styles.chipText, on ? styles.chipTextOn : styles.chipTextOff]}>{c.name}</Text>
                  </Pressable>
                )
              })}
            </ScrollView>

            {error ? <Notice tone="error" title={error} /> : null}

            <View style={styles.metaBar}>
              <Text style={styles.countText}>
                {total === 0 ? 'No items found' : `${total} ${total === 1 ? 'item' : 'items'} available`}
              </Text>
              <Text style={styles.asOfText}>Prices as of {formatTime(asOf)}</Text>
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.cardWrap}>
            <ListingCard
              item={item}
              now={asOf}
              saved={savedIds.has(item.id)}
              onPress={() => router.push({ pathname: '/items/[id]', params: { id: item.id } })}
              onToggleSave={() => void handleToggleSave(item)}
            />
          </View>
        )}
        ListEmptyComponent={
          loading ? (
            <View style={{ gap: 14 }}>
              <Skeleton height={280} />
              <Skeleton height={280} />
            </View>
          ) : (
            <EmptyState
              icon={<SearchX size={24} color={colors.forest} />}
              title={activeCount ? 'Nothing matches those filters' : 'Nothing listed yet'}
              message={activeCount ? 'Try a wider price range or a different category.' : 'When students list things theyâ€™re leaving behind, theyâ€™ll show up here.'}
              actionLabel={activeCount ? 'Clear filters' : 'List the first item'}
              onAction={activeCount ? resetAllFilters : () => router.push('/(tabs)/sell')}
            />
          )
        }
        ListFooterComponent={
          hasMore ? (
            <View style={styles.footer}>
              <Button
                label={loadingMore ? 'Loadingâ€¦' : `Load more (${total - items.length} left)`}
                variant="secondary"
                loading={loadingMore}
                onPress={() => {
                  setLoadingMore(true)
                  setFilters((prev) => ({ ...prev, page: prev.page + 1 }))
                }}
              />
            </View>
          ) : items.length > 0 && total > PAGE_SIZE ? (
            <Text style={styles.endNote}>Showing all {total} items</Text>
          ) : undefined
        }
      />

      <Modal visible={filterModalOpen} animationType="slide" transparent onRequestClose={() => setFilterModalOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHead}>
              <Text style={textStyles.h2}>Filters</Text>
              <Pressable onPress={() => setFilterModalOpen(false)} hitSlop={8}>
                <X size={22} color={colors.muted} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.modalBody}>
              <Field label="Condition">
                <ChipSelect
                  value={draftCondition ?? ''}
                  onChange={(v) => setDraftCondition(v ? (v as Condition) : undefined)}
                  options={[{ value: '', label: 'Any' }, ...CONDITION_KEYS.map((k) => ({ value: k, label: CONDITIONS[k].label }))]}
                />
              </Field>

              <Field label="Current price (â‚¹)">
                <View style={styles.priceInputs}>
                  <TextInputField
                    value={draftMin}
                    onChangeText={setDraftMin}
                    keyboardType="numeric"
                    placeholder="Min"
                    style={{ flex: 1 }}
                  />
                  <Text style={textStyles.bodyMuted}>to</Text>
                  <TextInputField
                    value={draftMax}
                    onChangeText={setDraftMax}
                    keyboardType="numeric"
                    placeholder="Max"
                    style={{ flex: 1 }}
                  />
                </View>
              </Field>

              <CheckboxRow label="Available to rent" checked={draftRentable} onChange={setDraftRentable} />

              <Field label="Sort by">
                <ChipSelect
                  value={draftSort}
                  onChange={(v) => setDraftSort(v as Sort)}
                  options={(Object.keys(SORTS) as Sort[]).map((k) => ({ value: k, label: SORTS[k] }))}
                />
              </Field>
            </ScrollView>

            <View style={styles.modalFooter}>
              <Button label="Reset" variant="ghost" onPress={resetAllFilters} />
              <Button label="Apply filters" onPress={applyFilterModal} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.stone,
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  header: {
    gap: 14,
    marginBottom: 14,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  subtitle: {
    fontFamily: fonts.sansRegular,
    fontSize: 15,
    lineHeight: 22,
    color: colors.muted,
    marginTop: 6,
  },
  searchBar: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  searchWrap: {
    flex: 1,
    position: 'relative',
  },
  searchIcon: {
    position: 'absolute',
    left: 12,
    top: 14,
    zIndex: 1,
  },
  chipsScroll: {
    gap: 8,
    paddingVertical: 2,
  },
  chip: {
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: radii.pill,
    borderWidth: 1,
    justifyContent: 'center',
  },
  chipOn: {
    backgroundColor: colors.forest,
    borderColor: colors.forest,
  },
  chipOff: {
    backgroundColor: colors.chalk,
    borderColor: colors.line,
  },
  chipText: {
    fontFamily: fonts.sansMedium,
    fontSize: 13,
  },
  chipTextOn: {
    color: colors.chalk,
  },
  chipTextOff: {
    color: colors.ink,
  },
  metaBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: 8,
  },
  countText: {
    fontFamily: fonts.sansMedium,
    fontSize: 14,
    color: colors.muted,
  },
  asOfText: {
    fontFamily: fonts.sansRegular,
    fontSize: 13,
    color: colors.muted,
  },
  cardWrap: {
    marginBottom: 14,
  },
  footer: {
    paddingTop: 8,
  },
  endNote: {
    fontFamily: fonts.sansRegular,
    fontSize: 13,
    color: colors.muted,
    textAlign: 'center',
    paddingVertical: 10,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(27, 36, 32, 0.45)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: colors.chalk,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderTopWidth: 1,
    borderColor: colors.line,
    maxHeight: '85%',
    padding: 20,
    gap: 14,
  },
  modalHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalBody: {
    gap: 18,
    paddingBottom: 12,
  },
  priceInputs: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: 12,
  },
})
