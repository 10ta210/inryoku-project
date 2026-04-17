# inryoku.online 母艦HP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the inryoku.online business website — a 7-page marketing site for 株式会社インリョク that showcases AI web design, restaurant marketing, and knowledge products.

**Architecture:** Next.js 14 App Router with static export. All pages are static marketing pages with a single client-side contact form. Tailwind CSS for styling with a dark theme. Framer Motion for subtle scroll animations. Deployed to Vercel with custom domain inryoku.online.

**Tech Stack:** Next.js 14, TypeScript, Tailwind CSS, Framer Motion, Web3Forms (contact form), Vercel

---

## File Structure

```
Desktop/inryoku-online/
├── app/
│   ├── globals.css           # Tailwind imports + custom styles
│   ├── layout.tsx            # Root layout (fonts, metadata, Header, Footer)
│   ├── page.tsx              # Top page
│   ├── web-design/page.tsx   # AI web design service
│   ├── restaurant/page.tsx   # Restaurant marketing service
│   ├── knowledge/page.tsx    # Knowledge/PDF products
│   ├── works/page.tsx        # Portfolio
│   ├── about/page.tsx        # Company info
│   └── contact/page.tsx      # Contact (LINE + form)
├── components/
│   ├── Header.tsx            # Fixed header with nav
│   ├── Footer.tsx            # Site footer
│   ├── Hero.tsx              # Reusable hero section
│   ├── ServiceCard.tsx       # Service overview card
│   ├── WorkCard.tsx          # Portfolio item card
│   ├── PricingCard.tsx       # Pricing tier card
│   ├── FaqItem.tsx           # Expandable FAQ item
│   ├── ContactForm.tsx       # Web3Forms contact form
│   ├── LineButton.tsx        # LINE CTA button
│   ├── SectionHeading.tsx    # Reusable section title
│   └── FadeIn.tsx            # Framer Motion scroll reveal wrapper
├── lib/
│   └── constants.ts          # Site metadata, nav links, colors
├── public/
│   ├── images/
│   │   ├── logo.svg          # inryoku logo
│   │   ├── work-inryoku.jpg  # Portfolio screenshot
│   │   └── work-restaurant.jpg # Restaurant LP screenshot
│   └── favicon.ico
├── tailwind.config.ts
├── next.config.ts
├── tsconfig.json
└── package.json
```

---

### Task 1: Project Scaffold

**Files:**
- Create: `Desktop/inryoku-online/` (entire scaffold)

- [ ] **Step 1: Create Next.js project**

```bash
cd /Users/10ta210/Desktop
npx create-next-app@14 inryoku-online --typescript --tailwind --eslint --app --src-dir=false --import-alias="@/*" --use-npm
```

- [ ] **Step 2: Install dependencies**

```bash
cd /Users/10ta210/Desktop/inryoku-online
npm install framer-motion
```

- [ ] **Step 3: Create lib/constants.ts**

```typescript
export const SITE = {
  name: "inryoku",
  company: "株式会社インリョク",
  tagline: "見えない魅力を、引力に変える。",
  subtitle: "AI × デザイン × 心理学で、ビジネスの"引力"を設計する",
  url: "https://inryoku.online",
} as const;

export const NAV_LINKS = [
  { href: "/web-design", label: "Web制作" },
  { href: "/restaurant", label: "飲食店集客" },
  { href: "/knowledge", label: "ナレッジ" },
  { href: "/works", label: "実績" },
  { href: "/about", label: "会社概要" },
  { href: "/contact", label: "お問い合わせ" },
] as const;

export const COLORS = {
  primary: "#0A0A0A",
  accent: "#FF6B35",
  text: "#FAFAFA",
  muted: "#6B7280",
  surface: "#1A1A1A",
} as const;
```

- [ ] **Step 4: Configure Tailwind with custom theme**

Replace `tailwind.config.ts`:

```typescript
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#0A0A0A",
        accent: "#FF6B35",
        surface: "#1A1A1A",
        muted: "#6B7280",
      },
      fontFamily: {
        sans: ['"Noto Sans JP"', '"Inter"', "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
```

- [ ] **Step 5: Set up globals.css**

Replace `app/globals.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Noto+Sans+JP:wght@400;500;700&display=swap');

body {
  background-color: #0A0A0A;
  color: #FAFAFA;
}

::selection {
  background-color: #FF6B35;
  color: #0A0A0A;
}
```

- [ ] **Step 6: Copy logo and placeholder images**

```bash
cp /Users/10ta210/Desktop/inryoku/inryoku_logo_icon.png /Users/10ta210/Desktop/inryoku-online/public/images/logo.png
```

Take a screenshot of the inryoku art project and Manus restaurant LP for portfolio images later.

- [ ] **Step 7: Verify dev server starts**

```bash
cd /Users/10ta210/Desktop/inryoku-online && npm run dev
```

Open http://localhost:3000 — should see default Next.js page with dark background.

- [ ] **Step 8: Init git and commit**

```bash
cd /Users/10ta210/Desktop/inryoku-online
git init
git add -A
git commit -m "chore: scaffold Next.js 14 + Tailwind + Framer Motion project"
```

---

### Task 2: Shared Components (Header, Footer, Hero, FadeIn)

**Files:**
- Create: `components/Header.tsx`
- Create: `components/Footer.tsx`
- Create: `components/Hero.tsx`
- Create: `components/FadeIn.tsx`
- Create: `components/SectionHeading.tsx`
- Create: `components/LineButton.tsx`
- Modify: `app/layout.tsx`

- [ ] **Step 1: Create FadeIn component**

```typescript
// components/FadeIn.tsx
"use client";
import { motion } from "framer-motion";
import { ReactNode } from "react";

export default function FadeIn({
  children,
  className = "",
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-64px" }}
      transition={{ duration: 0.6, delay, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
```

- [ ] **Step 2: Create SectionHeading component**

```typescript
// components/SectionHeading.tsx
export default function SectionHeading({
  sub,
  title,
  description,
}: {
  sub?: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="text-center mb-16">
      {sub && (
        <p className="text-accent text-sm font-medium tracking-widest uppercase mb-3">
          {sub}
        </p>
      )}
      <h2 className="text-3xl md:text-4xl font-bold mb-4">{title}</h2>
      {description && (
        <p className="text-muted max-w-2xl mx-auto">{description}</p>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create Header component**

```typescript
// components/Header.tsx
"use client";
import Link from "next/link";
import { useState } from "react";
import { NAV_LINKS, SITE } from "@/lib/constants";

export default function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-primary/80 backdrop-blur-md border-b border-white/5">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold tracking-tight">
          {SITE.name}
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-8">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm text-muted hover:text-white transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Mobile hamburger */}
        <button
          onClick={() => setOpen(!open)}
          className="md:hidden p-2"
          aria-label="メニュー"
        >
          <div className="space-y-1.5">
            <span className={`block w-6 h-0.5 bg-white transition-transform ${open ? "rotate-45 translate-y-2" : ""}`} />
            <span className={`block w-6 h-0.5 bg-white transition-opacity ${open ? "opacity-0" : ""}`} />
            <span className={`block w-6 h-0.5 bg-white transition-transform ${open ? "-rotate-45 -translate-y-2" : ""}`} />
          </div>
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <nav className="md:hidden bg-primary border-t border-white/5 px-6 py-4">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="block py-3 text-muted hover:text-white transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
```

- [ ] **Step 4: Create Footer component**

```typescript
// components/Footer.tsx
import Link from "next/link";
import { NAV_LINKS, SITE } from "@/lib/constants";

export default function Footer() {
  return (
    <footer className="border-t border-white/5 bg-primary">
      <div className="max-w-6xl mx-auto px-6 py-16">
        <div className="grid md:grid-cols-3 gap-12">
          <div>
            <p className="text-xl font-bold mb-2">{SITE.name}</p>
            <p className="text-muted text-sm">{SITE.company}</p>
            <p className="text-muted text-sm mt-1">{SITE.subtitle}</p>
          </div>
          <div>
            <p className="font-medium mb-4">ページ</p>
            <ul className="space-y-2">
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted hover:text-white transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="font-medium mb-4">お問い合わせ</p>
            <Link
              href="/contact"
              className="inline-block bg-accent text-primary px-6 py-2.5 rounded-lg text-sm font-medium hover:brightness-110 transition"
            >
              無料相談する
            </Link>
          </div>
        </div>
        <div className="mt-16 pt-8 border-t border-white/5 text-center text-muted text-xs">
          &copy; {new Date().getFullYear()} {SITE.company}. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
```

- [ ] **Step 5: Create Hero component**

```typescript
// components/Hero.tsx
import Link from "next/link";
import FadeIn from "./FadeIn";

export default function Hero({
  title,
  subtitle,
  cta,
  ctaHref = "/contact",
}: {
  title: string;
  subtitle?: string;
  cta?: string;
  ctaHref?: string;
}) {
  return (
    <section className="relative min-h-[60vh] flex items-center justify-center pt-16">
      {/* Subtle gradient bg */}
      <div className="absolute inset-0 bg-gradient-to-b from-accent/5 via-transparent to-transparent pointer-events-none" />
      <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
        <FadeIn>
          <h1 className="text-4xl md:text-6xl font-bold leading-tight mb-6">
            {title}
          </h1>
        </FadeIn>
        {subtitle && (
          <FadeIn delay={0.15}>
            <p className="text-lg md:text-xl text-muted max-w-2xl mx-auto mb-10">
              {subtitle}
            </p>
          </FadeIn>
        )}
        {cta && (
          <FadeIn delay={0.3}>
            <Link
              href={ctaHref}
              className="inline-block bg-accent text-primary px-8 py-3.5 rounded-lg font-medium text-lg hover:brightness-110 transition"
            >
              {cta}
            </Link>
          </FadeIn>
        )}
      </div>
    </section>
  );
}
```

- [ ] **Step 6: Create LineButton component**

```typescript
// components/LineButton.tsx
export default function LineButton({ className = "" }: { className?: string }) {
  return (
    <a
      href="https://line.me/R/"
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-2 bg-[#06C755] text-white px-6 py-3 rounded-lg font-medium hover:brightness-110 transition ${className}`}
    >
      <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
        <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
      </svg>
      LINEで相談する
    </a>
  );
}
```

- [ ] **Step 7: Update app/layout.tsx**

```typescript
// app/layout.tsx
import type { Metadata } from "next";
import { SITE } from "@/lib/constants";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: `${SITE.name} | ${SITE.tagline}`,
    template: `%s | ${SITE.name}`,
  },
  description: SITE.subtitle,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className="font-sans antialiased">
        <Header />
        <main className="min-h-screen">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
```

- [ ] **Step 8: Verify header/footer render on dev server**

Run dev server, check http://localhost:3000.

- [ ] **Step 9: Commit**

```bash
git add -A && git commit -m "feat: add shared components (Header, Footer, Hero, FadeIn, SectionHeading, LineButton)"
```

---

### Task 3: Top Page

**Files:**
- Create: `components/ServiceCard.tsx`
- Modify: `app/page.tsx`

- [ ] **Step 1: Create ServiceCard component**

```typescript
// components/ServiceCard.tsx
import Link from "next/link";
import FadeIn from "./FadeIn";

export default function ServiceCard({
  title,
  description,
  href,
  icon,
  delay = 0,
}: {
  title: string;
  description: string;
  href: string;
  icon: string;
  delay?: number;
}) {
  return (
    <FadeIn delay={delay}>
      <Link
        href={href}
        className="group block bg-surface rounded-2xl p-8 border border-white/5 hover:border-accent/30 transition-all duration-300"
      >
        <span className="text-4xl mb-4 block">{icon}</span>
        <h3 className="text-xl font-bold mb-2 group-hover:text-accent transition-colors">
          {title}
        </h3>
        <p className="text-muted text-sm leading-relaxed">{description}</p>
        <span className="inline-block mt-4 text-accent text-sm font-medium">
          詳しく見る &rarr;
        </span>
      </Link>
    </FadeIn>
  );
}
```

- [ ] **Step 2: Build top page**

```typescript
// app/page.tsx
import Hero from "@/components/Hero";
import ServiceCard from "@/components/ServiceCard";
import SectionHeading from "@/components/SectionHeading";
import FadeIn from "@/components/FadeIn";
import Link from "next/link";
import { SITE } from "@/lib/constants";

export default function Home() {
  return (
    <>
      {/* Hero */}
      <Hero
        title={SITE.tagline}
        subtitle={`${SITE.company} \u2014 ${SITE.subtitle}`}
        cta="無料相談する"
      />

      {/* Services */}
      <section className="max-w-6xl mx-auto px-6 py-24">
        <SectionHeading
          sub="Services"
          title="3つの引力"
          description="あなたのビジネスに最適な引力を設計します"
        />
        <div className="grid md:grid-cols-3 gap-6">
          <ServiceCard
            icon="⚡"
            title="AI爆速サイト制作"
            description="AI × デザインの力で、最短1日。5万円〜であなたのビジネスに引力を。"
            href="/web-design"
            delay={0}
          />
          <ServiceCard
            icon="🍽"
            title="飲食店集客システム"
            description="MEO × LP × LINEの三段構えで、一見さんを常連客に変える。"
            href="/restaurant"
            delay={0.1}
          />
          <ServiceCard
            icon="📘"
            title="ナレッジ"
            description="集客の「成功の型」を、あなたの手に。実践的なノウハウを提供。"
            href="/knowledge"
            delay={0.2}
          />
        </div>
      </section>

      {/* Strengths */}
      <section className="border-t border-white/5 bg-surface/50">
        <div className="max-w-6xl mx-auto px-6 py-24">
          <SectionHeading sub="Why inryoku" title="選ばれる理由" />
          <div className="grid md:grid-cols-3 gap-12">
            {[
              {
                title: "AI × デザイン",
                desc: "最新のAI技術と洗練されたデザインセンスの融合。爆速かつ高品質な制作を実現。",
              },
              {
                title: "心理学に基づく設計",
                desc: "行動経済学・心理学の知見をデザインに落とし込み、「なんとなく良い」ではなく「確実に効く」を。",
              },
              {
                title: "WIN-WIN-WIN",
                desc: "あなたも、お客様も、関わる全員がハッピーになる。引力は、幸せの循環から生まれる。",
              },
            ].map((item, i) => (
              <FadeIn key={item.title} delay={i * 0.1}>
                <div>
                  <h3 className="text-xl font-bold mb-3">{item.title}</h3>
                  <p className="text-muted text-sm leading-relaxed">{item.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-6xl mx-auto px-6 py-24 text-center">
        <FadeIn>
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            まずは、話してみませんか。
          </h2>
          <p className="text-muted mb-10 max-w-xl mx-auto">
            あなたのビジネスに最適な「引力」を、一緒に設計しましょう。
            ご相談は無料です。
          </p>
          <Link
            href="/contact"
            className="inline-block bg-accent text-primary px-8 py-3.5 rounded-lg font-medium text-lg hover:brightness-110 transition"
          >
            無料相談する
          </Link>
        </FadeIn>
      </section>
    </>
  );
}
```

- [ ] **Step 3: Verify top page in browser**

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: build top page with hero, services, strengths, CTA"
```

---

### Task 4: Web Design Service Page

**Files:**
- Create: `components/FaqItem.tsx`
- Create: `app/web-design/page.tsx`

- [ ] **Step 1: Create FaqItem component**

```typescript
// components/FaqItem.tsx
"use client";
import { useState } from "react";

export default function FaqItem({
  question,
  answer,
}: {
  question: string;
  answer: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-white/5">
      <button
        onClick={() => setOpen(!open)}
        className="w-full text-left py-5 flex items-center justify-between gap-4"
      >
        <span className="font-medium">{question}</span>
        <span className="text-accent text-xl shrink-0">{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div className="pb-5 text-muted text-sm leading-relaxed">{answer}</div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Build web-design page**

```typescript
// app/web-design/page.tsx
import { Metadata } from "next";
import Hero from "@/components/Hero";
import SectionHeading from "@/components/SectionHeading";
import FadeIn from "@/components/FadeIn";
import FaqItem from "@/components/FaqItem";
import Link from "next/link";

export const metadata: Metadata = {
  title: "AI爆速サイト制作",
  description: "AI × デザインで最短1日。5万円〜であなたのビジネスに引力を。",
};

const FEATURES = [
  {
    title: "AI × デザインで爆速制作",
    desc: "最新のAI技術を駆使し、人間のデザインセンスで仕上げる。スピードと品質を両立。",
  },
  {
    title: "納得いくまで修正対応",
    desc: "デザインに妥協はしません。あなたが「これだ」と思えるまで、何度でも調整します。",
  },
  {
    title: "レスポンシブ・SEO込み",
    desc: "PC・スマホ完全対応。基本的なSEO設計も含まれているので、追加費用は不要。",
  },
];

const FLOW = [
  { step: "01", title: "ヒアリング", desc: "ビジネスの強み・ターゲット・ご要望をお伺いします。" },
  { step: "02", title: "デザイン・制作", desc: "AI × デザインで爆速制作。初稿をお見せします。" },
  { step: "03", title: "修正・調整", desc: "フィードバックを反映し、納得いくまで仕上げます。" },
  { step: "04", title: "納品・公開", desc: "サーバー設定・ドメイン接続まで完了してお渡し。" },
];

const FAQS = [
  { q: "本当に1日で完成しますか？", a: "LP（1ページ）であれば最短1日で初稿をお出しします。ページ数や内容の複雑さによって前後しますが、一般的なコーポレートサイト（5ページ程度）でも3〜5日が目安です。" },
  { q: "写真や文章は用意する必要がありますか？", a: "なくても大丈夫です。ヒアリングをもとに、こちらでコピーライティングも対応します。写真はフリー素材を活用するか、お持ちの素材を活かします。" },
  { q: "公開後の修正や更新はできますか？", a: "納品後1ヶ月間は無料で軽微な修正に対応します。継続的な更新が必要な場合は、月額の保守プランもご用意しています。" },
  { q: "どんな業種でも対応できますか？", a: "はい。飲食店・美容室・士業・スタートアップなど、業種を問わず対応可能です。" },
];

export default function WebDesignPage() {
  return (
    <>
      <Hero
        title="最短1日。あなたのビジネスに、引力を。"
        subtitle="AI × デザインで、5万円〜。LP・ブランドサイト・コーポレートサイトを爆速で制作します。"
        cta="無料相談する"
      />

      {/* Features */}
      <section className="max-w-6xl mx-auto px-6 py-24">
        <SectionHeading sub="Features" title="特徴" />
        <div className="grid md:grid-cols-3 gap-8">
          {FEATURES.map((f, i) => (
            <FadeIn key={f.title} delay={i * 0.1}>
              <div className="bg-surface rounded-2xl p-8 border border-white/5">
                <h3 className="text-lg font-bold mb-3">{f.title}</h3>
                <p className="text-muted text-sm leading-relaxed">{f.desc}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section className="border-t border-white/5 bg-surface/50">
        <div className="max-w-4xl mx-auto px-6 py-24 text-center">
          <SectionHeading sub="Pricing" title="料金" />
          <FadeIn>
            <div className="bg-surface rounded-2xl p-10 border border-accent/20">
              <p className="text-accent text-sm font-medium mb-2">基本料金</p>
              <p className="text-5xl font-bold mb-2">
                5<span className="text-2xl">万円〜</span>
              </p>
              <p className="text-muted text-sm mb-8">
                LP / ブランドサイト / コーポレートサイト
              </p>
              <ul className="text-left max-w-md mx-auto space-y-3 text-sm">
                {[
                  "デザイン・コーディング一式",
                  "レスポンシブ対応（PC・スマホ）",
                  "基本SEO設計",
                  "サーバー設定・ドメイン接続",
                  "納品後1ヶ月の無料修正",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="text-accent mt-0.5">&#10003;</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* Flow */}
      <section className="max-w-6xl mx-auto px-6 py-24">
        <SectionHeading sub="Flow" title="制作の流れ" />
        <div className="grid md:grid-cols-4 gap-8">
          {FLOW.map((f, i) => (
            <FadeIn key={f.step} delay={i * 0.1}>
              <div>
                <p className="text-accent text-3xl font-bold mb-2">{f.step}</p>
                <h3 className="font-bold mb-2">{f.title}</h3>
                <p className="text-muted text-sm">{f.desc}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t border-white/5">
        <div className="max-w-3xl mx-auto px-6 py-24">
          <SectionHeading sub="FAQ" title="よくある質問" />
          {FAQS.map((faq) => (
            <FaqItem key={faq.q} question={faq.q} answer={faq.a} />
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-6xl mx-auto px-6 py-24 text-center">
        <FadeIn>
          <h2 className="text-3xl font-bold mb-6">まずはお気軽にご相談ください</h2>
          <Link
            href="/contact"
            className="inline-block bg-accent text-primary px-8 py-3.5 rounded-lg font-medium text-lg hover:brightness-110 transition"
          >
            無料相談する
          </Link>
        </FadeIn>
      </section>
    </>
  );
}
```

- [ ] **Step 3: Verify in browser**

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: add web-design service page with features, pricing, flow, FAQ"
```

---

### Task 5: Restaurant Service Page

**Files:**
- Create: `components/PricingCard.tsx`
- Create: `app/restaurant/page.tsx`

- [ ] **Step 1: Create PricingCard component**

```typescript
// components/PricingCard.tsx
import Link from "next/link";
import FadeIn from "./FadeIn";

export default function PricingCard({
  name,
  price,
  unit,
  description,
  features,
  featured = false,
  delay = 0,
}: {
  name: string;
  price: string;
  unit: string;
  description: string;
  features: string[];
  featured?: boolean;
  delay?: number;
}) {
  return (
    <FadeIn delay={delay}>
      <div
        className={`rounded-2xl p-8 border ${
          featured
            ? "border-accent bg-surface relative"
            : "border-white/5 bg-surface"
        }`}
      >
        {featured && (
          <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-accent text-primary text-xs font-bold px-4 py-1 rounded-full">
            おすすめ
          </span>
        )}
        <p className="font-medium mb-1">{name}</p>
        <p className="text-muted text-sm mb-4">{description}</p>
        <p className="text-4xl font-bold mb-1">
          {price}
          <span className="text-base text-muted font-normal">{unit}</span>
        </p>
        <ul className="mt-6 space-y-3 text-sm">
          {features.map((f) => (
            <li key={f} className="flex items-start gap-2">
              <span className="text-accent mt-0.5">&#10003;</span>
              {f}
            </li>
          ))}
        </ul>
        <Link
          href="/contact"
          className={`block text-center mt-8 py-3 rounded-lg font-medium transition ${
            featured
              ? "bg-accent text-primary hover:brightness-110"
              : "border border-white/10 hover:border-accent/30"
          }`}
        >
          このプランで相談する
        </Link>
      </div>
    </FadeIn>
  );
}
```

- [ ] **Step 2: Build restaurant page**

```typescript
// app/restaurant/page.tsx
import { Metadata } from "next";
import Hero from "@/components/Hero";
import SectionHeading from "@/components/SectionHeading";
import FadeIn from "@/components/FadeIn";
import PricingCard from "@/components/PricingCard";
import Link from "next/link";

export const metadata: Metadata = {
  title: "飲食店集客システム",
  description: "MEO × LP × LINEの三段構えで、一見さんを常連客に変える。",
};

const PROBLEMS = [
  { title: "探されない", desc: "Googleマップで上位に出なければ、存在しないのと同じ。" },
  { title: "選ばれない", desc: "「失敗したくない」心理が働き、他の店へ流れてしまう。" },
  { title: "忘れられる", desc: "「美味しかったね」で終わり。こちらからアプローチしなければ、記憶は薄れる。" },
];

const PROCESS = [
  { step: "認知", sub: "MEO・SNS運用", desc: "「近くの〇〇」検索で上位表示させ、お店の存在を知っていただきます。" },
  { step: "教育", sub: "LP制作", desc: "他店との違いと店主の想いを伝え、「行きたい」に変える。" },
  { step: "定着", sub: "LINE構築", desc: "一度来てくれたお客様をリスト化し、再来店を自動で促す。" },
];

const PLANS = [
  {
    name: "ライトプラン",
    price: "29,800円",
    unit: "/月",
    description: "集客の基礎を固めたい方へ",
    features: ["MEO対策（Googleマップ上位表示）", "口コミ促進サポート", "月次レポート提出"],
  },
  {
    name: "スタンダードプラン",
    price: "49,800円",
    unit: "/月",
    description: "本格的に集客を仕組み化したい方へ",
    features: ["MEO対策（Googleマップ上位表示）", "LP（ランディングページ）制作", "公式LINE構築・運用", "月次レポート・改善提案"],
    featured: true,
  },
  {
    name: "プレミアムプラン",
    price: "79,800円",
    unit: "/月",
    description: "すべてお任せで加速したい方へ",
    features: ["MEO対策（Googleマップ上位表示）", "LP制作・最適化", "公式LINE構築・ステップ配信設計", "関連店舗調査・分析レポート", "月次レポート・戦略会議"],
  },
];

export default function RestaurantPage() {
  return (
    <>
      <Hero
        title="一見さんを、あなたの店の常連客へ。"
        subtitle="MEO × LP × LINEの三段構えで、集客を仕組み化。見えない魅力を、引力に変える。"
        cta="無料相談する"
      />

      {/* Problems */}
      <section className="max-w-6xl mx-auto px-6 py-24">
        <SectionHeading sub="Problem" title="こんな悩みはありませんか？" />
        <div className="grid md:grid-cols-3 gap-6">
          {PROBLEMS.map((p, i) => (
            <FadeIn key={p.title} delay={i * 0.1}>
              <div className="bg-surface rounded-2xl p-8 border border-white/5 text-center">
                <h3 className="text-xl font-bold mb-3">{p.title}</h3>
                <p className="text-muted text-sm">{p.desc}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* Process */}
      <section className="border-t border-white/5 bg-surface/50">
        <div className="max-w-6xl mx-auto px-6 py-24">
          <SectionHeading sub="Process" title="inryoku式・三段構え" description="この3つが揃って初めて、集客の仕組みが完成する。" />
          <div className="grid md:grid-cols-3 gap-8">
            {PROCESS.map((p, i) => (
              <FadeIn key={p.step} delay={i * 0.1}>
                <div className="text-center">
                  <p className="text-accent text-sm font-medium mb-2">{p.sub}</p>
                  <h3 className="text-2xl font-bold mb-3">{p.step}</h3>
                  <p className="text-muted text-sm">{p.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="max-w-6xl mx-auto px-6 py-24">
        <SectionHeading sub="Pricing" title="選べる3つのプラン" description="店舗の規模や課題に合わせて最適なプランをお選びください。" />
        <div className="grid md:grid-cols-3 gap-6">
          {PLANS.map((plan, i) => (
            <PricingCard key={plan.name} {...plan} delay={i * 0.1} />
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-white/5">
        <div className="max-w-6xl mx-auto px-6 py-24 text-center">
          <FadeIn>
            <h2 className="text-3xl font-bold mb-6">まずは無料でご相談ください</h2>
            <p className="text-muted mb-10 max-w-xl mx-auto">
              あなたのお店の「見えない魅力」を、一緒に引力に変えましょう。
            </p>
            <Link
              href="/contact"
              className="inline-block bg-accent text-primary px-8 py-3.5 rounded-lg font-medium text-lg hover:brightness-110 transition"
            >
              無料相談する
            </Link>
          </FadeIn>
        </div>
      </section>
    </>
  );
}
```

- [ ] **Step 3: Verify in browser**

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: add restaurant service page with problems, process, pricing"
```

---

### Task 6: Knowledge, Works, About Pages

**Files:**
- Create: `app/knowledge/page.tsx`
- Create: `components/WorkCard.tsx`
- Create: `app/works/page.tsx`
- Create: `app/about/page.tsx`

- [ ] **Step 1: Build knowledge page**

```typescript
// app/knowledge/page.tsx
import { Metadata } from "next";
import Hero from "@/components/Hero";
import SectionHeading from "@/components/SectionHeading";
import FadeIn from "@/components/FadeIn";

export const metadata: Metadata = {
  title: "ナレッジ",
  description: "集客の「成功の型」を、あなたの手に。",
};

export default function KnowledgePage() {
  return (
    <>
      <Hero
        title={'"成功の型"を、あなたの手に。'}
        subtitle="飲食店経営の極意から、デジタル集客のノウハウまで。実践的な知識を提供します。"
      />

      <section className="max-w-4xl mx-auto px-6 py-24">
        <FadeIn>
          <div className="bg-surface rounded-2xl p-10 border border-white/5">
            <p className="text-accent text-sm font-medium mb-3">Coming Soon</p>
            <h2 className="text-2xl font-bold mb-4">
              飲食店経営・完全攻略バイブル
            </h2>
            <p className="text-muted leading-relaxed mb-6">
              MEO × LP × LINEの三段構えに、心理学的おもてなし術を融合。
              デジタルで「引力」を作り、心の通った「おもてなし」で常連にする方程式を、
              一冊にまとめました。
            </p>
            <ul className="space-y-2 text-sm text-muted mb-8">
              {[
                "MEO対策の完全マニュアル",
                "LP制作の設計思想",
                "LINE公式アカウント運用の型",
                "心理学に基づくおもてなし術",
                "印刷して使えるテンプレート集",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="text-accent mt-0.5">&#10003;</span>
                  {item}
                </li>
              ))}
            </ul>
            <p className="text-sm text-muted">
              販売開始時にLINEでお知らせします。
            </p>
          </div>
        </FadeIn>
      </section>
    </>
  );
}
```

- [ ] **Step 2: Create WorkCard component**

```typescript
// components/WorkCard.tsx
import FadeIn from "./FadeIn";
import Image from "next/image";

export default function WorkCard({
  title,
  category,
  description,
  image,
  href,
  delay = 0,
}: {
  title: string;
  category: string;
  description: string;
  image: string;
  href?: string;
  delay?: number;
}) {
  const Wrapper = href ? "a" : "div";
  const props = href
    ? { href, target: "_blank", rel: "noopener noreferrer" }
    : {};

  return (
    <FadeIn delay={delay}>
      <Wrapper
        {...props}
        className="group block bg-surface rounded-2xl overflow-hidden border border-white/5 hover:border-accent/30 transition-all"
      >
        <div className="aspect-video bg-primary/50 relative">
          <Image
            src={image}
            alt={title}
            fill
            className="object-cover"
          />
        </div>
        <div className="p-6">
          <span className="text-accent text-xs font-medium">{category}</span>
          <h3 className="text-lg font-bold mt-1 mb-2 group-hover:text-accent transition-colors">
            {title}
          </h3>
          <p className="text-muted text-sm">{description}</p>
        </div>
      </Wrapper>
    </FadeIn>
  );
}
```

- [ ] **Step 3: Build works page**

```typescript
// app/works/page.tsx
import { Metadata } from "next";
import Hero from "@/components/Hero";
import WorkCard from "@/components/WorkCard";

export const metadata: Metadata = {
  title: "実績",
  description: "引力が生まれた瞬間。制作実績をご紹介します。",
};

const WORKS = [
  {
    title: "inryoku Web Art Project",
    category: "Webアート",
    description: "「グレーの中に虹がある」という哲学を体験として可視化するインタラクティブWebアートプロジェクト。Three.js / GLSL / Web Audio APIで構築。",
    image: "/images/logo.png",
  },
  {
    title: "飲食店集客LP",
    category: "LP制作",
    description: "店舗ビジネスのための集客・常連化支援のランディングページ。行動経済学に基づく設計で、来店率向上を実現。",
    image: "/images/logo.png",
  },
];

export default function WorksPage() {
  return (
    <>
      <Hero
        title="引力が生まれた瞬間。"
        subtitle="見えない魅力を引力に変えた、制作実績をご紹介します。"
      />

      <section className="max-w-6xl mx-auto px-6 py-24">
        <div className="grid md:grid-cols-2 gap-8">
          {WORKS.map((work, i) => (
            <WorkCard key={work.title} {...work} delay={i * 0.1} />
          ))}
        </div>
        <p className="text-center text-muted text-sm mt-16">
          実績は随時追加していきます。
        </p>
      </section>
    </>
  );
}
```

- [ ] **Step 4: Build about page**

```typescript
// app/about/page.tsx
import { Metadata } from "next";
import Hero from "@/components/Hero";
import FadeIn from "@/components/FadeIn";
import SectionHeading from "@/components/SectionHeading";

export const metadata: Metadata = {
  title: "会社概要",
  description: "株式会社インリョクについて。見えない魅力を、引力に変える。",
};

const COMPANY_INFO = [
  { label: "会社名", value: "株式会社インリョク" },
  { label: "事業内容", value: "Webサイト制作 / 店舗集客支援 / デジタルコンテンツ企画" },
];

export default function AboutPage() {
  return (
    <>
      <Hero title="引力の源。" />

      {/* Story */}
      <section className="max-w-3xl mx-auto px-6 py-24">
        <FadeIn>
          <SectionHeading sub="Philosophy" title="見えないものを、可視化する。" />
          <div className="space-y-6 text-muted leading-relaxed">
            <p>
              世の中には、目に見えない素晴らしいものが溢れています。
              お店のこだわり、店主の想い、ビジネスの本質的な価値。
              しかしそれらは、可視化されなければ誰にも届きません。
            </p>
            <p>
              inryokuは「見えない魅力を、引力に変える」をミッションに、
              AI × デザイン × 心理学の力で、あなたのビジネスが持つ
              本質的な価値を可視化し、人を惹きつける「引力」へと変換します。
            </p>
            <p>
              私たちが大切にしているのは、WIN-WIN-WINの哲学。
              あなたも、あなたのお客様も、関わるすべての人がハッピーになる。
              そんな「幸せの循環」を生み出すことが、最も強い引力になると信じています。
            </p>
          </div>
        </FadeIn>
      </section>

      {/* Company Info */}
      <section className="border-t border-white/5">
        <div className="max-w-3xl mx-auto px-6 py-24">
          <SectionHeading sub="Company" title="会社情報" />
          <FadeIn>
            <div className="bg-surface rounded-2xl p-8 border border-white/5">
              {COMPANY_INFO.map((item) => (
                <div
                  key={item.label}
                  className="flex flex-col sm:flex-row py-4 border-b border-white/5 last:border-0"
                >
                  <span className="sm:w-40 shrink-0 text-muted text-sm mb-1 sm:mb-0">
                    {item.label}
                  </span>
                  <span className="text-sm">{item.value}</span>
                </div>
              ))}
            </div>
          </FadeIn>
        </div>
      </section>
    </>
  );
}
```

- [ ] **Step 5: Verify all three pages in browser**

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: add knowledge, works, about pages"
```

---

### Task 7: Contact Page with Form

**Files:**
- Create: `components/ContactForm.tsx`
- Create: `app/contact/page.tsx`

- [ ] **Step 1: Create ContactForm component**

```typescript
// components/ContactForm.tsx
"use client";
import { useState, FormEvent } from "react";

export default function ContactForm() {
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = e.currentTarget;
    const data = new FormData(form);

    const res = await fetch("https://api.web3forms.com/submit", {
      method: "POST",
      body: data,
    });

    if (res.ok) {
      setSent(true);
      form.reset();
    }
    setLoading(false);
  }

  if (sent) {
    return (
      <div className="bg-surface rounded-2xl p-10 border border-accent/20 text-center">
        <p className="text-2xl font-bold mb-3">送信しました</p>
        <p className="text-muted">
          ありがとうございます。2営業日以内にご連絡いたします。
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Web3Forms requires an access key — replace with real key after signup */}
      <input
        type="hidden"
        name="access_key"
        value="YOUR_WEB3FORMS_KEY"
      />
      <input type="hidden" name="subject" value="inryoku.online お問い合わせ" />

      <div>
        <label htmlFor="name" className="block text-sm font-medium mb-2">
          お名前
        </label>
        <input
          id="name"
          name="name"
          required
          className="w-full bg-surface border border-white/10 rounded-lg px-4 py-3 text-sm focus:border-accent focus:outline-none transition"
          placeholder="山田 太郎"
        />
      </div>

      <div>
        <label htmlFor="email" className="block text-sm font-medium mb-2">
          メールアドレス
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          className="w-full bg-surface border border-white/10 rounded-lg px-4 py-3 text-sm focus:border-accent focus:outline-none transition"
          placeholder="you@example.com"
        />
      </div>

      <div>
        <label htmlFor="message" className="block text-sm font-medium mb-2">
          ご相談内容
        </label>
        <textarea
          id="message"
          name="message"
          rows={6}
          required
          className="w-full bg-surface border border-white/10 rounded-lg px-4 py-3 text-sm focus:border-accent focus:outline-none transition resize-none"
          placeholder="ご相談内容をお聞かせください"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-accent text-primary py-3.5 rounded-lg font-medium text-lg hover:brightness-110 transition disabled:opacity-50"
      >
        {loading ? "送信中..." : "送信する"}
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Build contact page**

```typescript
// app/contact/page.tsx
import { Metadata } from "next";
import Hero from "@/components/Hero";
import FadeIn from "@/components/FadeIn";
import ContactForm from "@/components/ContactForm";
import LineButton from "@/components/LineButton";

export const metadata: Metadata = {
  title: "お問い合わせ",
  description: "inryokuへのご相談はこちらから。LINE・メールどちらでもお気軽に。",
};

export default function ContactPage() {
  return (
    <>
      <Hero
        title="まずは、話してみませんか。"
        subtitle="ご相談は無料です。LINEでもメールでもお気軽にどうぞ。"
      />

      <section className="max-w-4xl mx-auto px-6 py-24">
        <div className="grid md:grid-cols-2 gap-12">
          {/* LINE */}
          <FadeIn>
            <div className="bg-surface rounded-2xl p-8 border border-white/5 text-center">
              <h2 className="text-xl font-bold mb-4">LINEで相談する</h2>
              <p className="text-muted text-sm mb-8">
                お気軽にメッセージをお送りください。
                通常24時間以内に返信いたします。
              </p>
              <LineButton />
            </div>
          </FadeIn>

          {/* Form */}
          <FadeIn delay={0.1}>
            <div className="bg-surface rounded-2xl p-8 border border-white/5">
              <h2 className="text-xl font-bold mb-6">メールで相談する</h2>
              <ContactForm />
            </div>
          </FadeIn>
        </div>
      </section>
    </>
  );
}
```

- [ ] **Step 3: Verify contact page and form in browser**

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: add contact page with LINE button and Web3Forms contact form"
```

---

### Task 8: Visual Polish and Final Review

**Files:**
- Various small adjustments across all files

- [ ] **Step 1: Preview all pages in dev server**

Navigate through every page and check:
- Header navigation works on all pages
- Mobile menu opens/closes correctly
- All FadeIn animations fire on scroll
- Dark theme is consistent
- Typography is readable
- CTAs stand out

- [ ] **Step 2: Take screenshots of inryoku art project and restaurant LP for portfolio**

Use browser to capture screenshots of:
1. The inryoku art project (Desktop/inryoku/ running on localhost)
2. The Manus restaurant LP (inryoku-lp-az4rktum.manus.space)

Save to `public/images/work-inryoku.jpg` and `public/images/work-restaurant.jpg`.

Update `app/works/page.tsx` to use the real image paths.

- [ ] **Step 3: Add proper favicon**

Copy the inryoku logo as favicon:
```bash
cp /Users/10ta210/Desktop/inryoku/inryoku_logo_icon.png /Users/10ta210/Desktop/inryoku-online/app/icon.png
```

- [ ] **Step 4: Final commit**

```bash
git add -A && git commit -m "feat: visual polish, real screenshots, favicon"
```

---

### Task 9: Deploy to Vercel and Connect Domain

- [ ] **Step 1: Install Vercel CLI and deploy**

```bash
cd /Users/10ta210/Desktop/inryoku-online
npx vercel --yes
```

Follow the prompts to link to a Vercel account and deploy.

- [ ] **Step 2: Connect inryoku.online domain**

In Vercel dashboard, add custom domain `inryoku.online`.
Vercel will show DNS records to add.

- [ ] **Step 3: Update DNS at MuuMuu Domain**

Go to MuuMuu Domain control panel > ネームサーバー設定変更.
Either:
- Set nameservers to Vercel's nameservers, OR
- Add CNAME record: `inryoku.online` → `cname.vercel-dns.com`

- [ ] **Step 4: Verify site is live at inryoku.online**

Wait for DNS propagation (up to 48 hours, usually minutes).
Check https://inryoku.online loads correctly.

- [ ] **Step 5: Final commit with production URL**

```bash
git add -A && git commit -m "chore: deploy to Vercel, connect inryoku.online domain"
```
