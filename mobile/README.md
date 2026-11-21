# RIO Mobile App (Expo + React Native)

Expo Router React Native client for **RIO: Circular Asset Handover**, sharing the exact UI design tokens (`#eeebe3` stone, `#faf8f3` chalk, `#1f4033` forest, `#9e4a2c` clay, Bricolage Grotesque + Instrument Sans, hang-tag `PriceTag`, `CategoryArt`) and live Supabase Postgres/RLS/Storage backend with `RIO/web`.

## Setup

```bash
cd RIO/mobile
npm install
cp .env.example .env   # add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY
```

## Run

```bash
npm start              # Expo dev server (scan QR in Expo Go)
npm run android        # Android emulator / device
npm run ios            # iOS simulator (macOS)
npm run web            # Metro web preview
npm run typecheck      # TypeScript check (tsc --noEmit)
```

## Features

- **Marketplace & Dutch auction:** live price decay hang-tags, search, category chips, condition/price/rentable filters, pagination, saved items.
- **Sell & Edit:** native camera/gallery multi-photo upload (compressed to JPEG + thumbnail via `expo-image-manipulator`), live rental quote preview.
- **QR Handover:** generates 10-minute single-use SVG QR codes (`issue_handover_token`) with live countdown & polling, plus native camera QR scanner (`expo-camera` `CameraView`) and manual Crockford entry (`consume_handover_token`).
- **Rentals & Rent-to-Own:** Day/Week/Month booking, live rent-to-own credit breakdown, deposit refunds, damage disputes with photo evidence.
- **Warden, Staff & Admin tools:** final-hour staff routing, listing report moderation, dispute decisions, staff custody queues, no-dues report, and scoped role assignment.
