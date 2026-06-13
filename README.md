# Pinnacle Restaurant Manager

AI-powered restaurant management — photos, inventory, staff, orders, finances, and automated business insights.

## Features

- **Dashboard** — Revenue, expenses, low-stock alerts, and quick actions
- **Photo Library** — Capture/upload photos, sort by category, AI image analysis
- **Menu / Inventory / Staff** — Full add, edit, and delete forms
- **Tables** — Visual floor plan with status toggling (available, occupied, reserved)
- **Orders** — Create orders, update status, link to tables
- **Finances** — Expense tracking with **Receipt OCR** (AI extracts vendor, amount, category)
- **AI Insights** — Automated pain point detection with **push notifications** for critical alerts
- **Multi-location** — Switch between restaurant locations; all data scoped per location

## Quick Start

```bash
npm install
npm run db:push
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Seed Sample Data

Visit `http://localhost:3000/api/seed` to populate menu, inventory, staff, tables, and expenses for the current location.

### AI Features (Optional)

Add your OpenAI API key to `.env`:

```
OPENAI_API_KEY=sk-your-key-here
```

Enables photo analysis, receipt OCR, and GPT-powered business insights. Without a key, rule-based insights still work.

### Push Notifications

On first load, the app requests notification permission. Critical and high-severity AI insights trigger browser notifications after running analysis.

## Tech Stack

- Next.js 15 (App Router)
- TypeScript · Tailwind CSS 4 · Prisma + SQLite
- OpenAI (optional) · Service Worker notifications

## Project Structure

```
src/
  app/           # Pages and API routes
  components/    # UI, forms, receipt scanner, tables
  lib/           # Database, AI, location, notifications
prisma/          # Database schema (multi-location)
public/uploads/  # Uploaded photos and receipts
```
