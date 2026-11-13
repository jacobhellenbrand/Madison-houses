# Reynolds Transfer & Storage — SEO & AI Visibility Notes
*Reviewed: March 2026*

---

## The Core Problem

When searching "best movers in madison wi," Reynolds does appear in results — but typically in position 4 or lower, behind:
1. Gorilla Movers of Wisconsin
2. Two Men and a Truck
3. Big Dog Movers

Above those organic results, Google shows a **Local Pack** (the map with 3 businesses) and often an **AI Overview** — Reynolds is likely missing from both of those, which is where most clicks go.

---

## What's Hurting Visibility

### 1. No Structured Data (Schema Markup) — Highest Priority
The site has zero JSON-LD schema markup. This is the single biggest thing holding back AI visibility.

- Google AI Overviews, ChatGPT, and Perplexity all pull heavily from structured data to identify and summarize local businesses.
- Without it, AI tools can't confidently surface Reynolds in answers to queries like "best movers in madison."
- **What to add:**
  - `LocalBusiness` / `MovingCompany` schema on the homepage (name, address, phone, hours, geo coordinates)
  - `Service` schema on each service page
  - `FAQPage` schema on any FAQ sections
  - `Review` / `AggregateRating` schema if reviews are displayed on the site

### 2. Google Business Profile — Likely the Biggest Ranking Factor for Local
The Local Pack (map results) is driven almost entirely by the Google Business Profile, not the website itself.
- Make sure the profile is fully filled out: hours, photos, services, description, Q&A
- The review count and recency matter enormously — Dairyland Moving advertises **190+ 5-star reviews at 4.9 stars**, which is a strong Local Pack signal
- Reynolds should be actively requesting reviews from every completed job and responding to all existing reviews (including negative ones)
- Ensure NAP (Name, Address, Phone) is identical across the website, GBP, Yelp, and any other directory listings — inconsistencies hurt local ranking

### 3. Thin/Competing Pages
The site has two pages targeting nearly the same keyword:
- `/movers-in-madison/`
- `/madison-moving-companies/`

These pages split authority and compete against each other rather than consolidating into one strong page. One should be the canonical page; the other should redirect to it.

### 4. Crawl Delay of 10 Seconds in robots.txt
`robots.txt` includes `Crawl-delay: 10`. This instructs crawlers to wait 10 seconds between requests, meaning Google re-indexes the site much more slowly than competitors. Unless the server genuinely can't handle crawl traffic, this should be removed or reduced to 1-2 seconds.

### 5. Missing Meta Descriptions
Several pages appear to lack hand-written meta descriptions. Google and AI tools write their own summaries when this tag is missing, which are usually generic and less compelling than a crafted one. Every page should have a unique, keyword-relevant meta description under 160 characters.

### 6. Page Content is JavaScript-Heavy (Divi Builder)
The site is built on Divi, which renders a lot of content via JavaScript. While Google can crawl JS, it's slower and less reliable than static HTML — especially for AI crawlers like those used by Perplexity or ChatGPT, which often can't execute JavaScript at all. Key content (services, about text, contact info) should be in plain HTML, not buried in JS-rendered elements.

### 7. No Clear Review Count or Social Proof Displayed on Site
Competitors prominently display their review numbers ("4.9 stars, 190+ reviews"). Reynolds' site doesn't appear to surface this on the homepage or service pages. Even if Reynolds has strong reviews elsewhere, not displaying them on the site means AI and search engines don't associate that trust signal with the website.

---

## What Competitors Are Doing Well

| Competitor | Advantage |
|---|---|
| Gorilla Movers | "30,000+ successful moves" prominently stated — specific numbers build trust and are cited by AI |
| Dairyland Moving | "190+ 5-star Google reviews, 4.9 rating" — very strong local SEO signal |
| Two Men and a Truck | National brand with local page — massive domain authority |
| Big Dog Movers | Very clear hourly pricing on the site — Google/AI can surface this as a direct answer |

---

## Reynolds' Strengths to Leverage

- **Founded in 1888** — one of the oldest moving companies in Wisconsin. This history is barely surfaced in SEO copy and should be front and center.
- **Breadth of services** — heavy haul, international, trade show, art/museum moving are highly specialized and worth dedicated SEO pages
- **Case studies** — the site has great case studies (City of Madison Fire Dept, Chazen Art Museum, etc.) but these likely have little SEO value without proper schema and internal linking

---

## Recommended Priority List for Web Admins

1. **Add `LocalBusiness`/`MovingCompany` JSON-LD schema to homepage** — immediate AI visibility improvement
2. **Audit and optimize Google Business Profile** — most direct path to the Local Pack
3. **Start a review generation campaign** — ask every customer post-move for a Google review
4. **Remove `Crawl-delay` from robots.txt** or reduce to 1 second
5. **Consolidate `/movers-in-madison/` and `/madison-moving-companies/`** into one strong page
6. **Write meta descriptions for all pages** — especially homepage and service pages
7. **Add aggregate rating display to homepage** — pull in Google review score visually
8. **Add `Service` schema to each service page**
9. **Add `FAQPage` schema** to any FAQ sections
10. **Ensure NAP consistency** across all directories (Yelp, GBP, BBB, etc.)

---

---

## Competitor Deep Dive: Badger Brothers Moving

*URL shared was a Google Ads landing page — they are actively running paid search campaigns.*

### What They're Doing Better

**1. Review Volume is Overwhelming**
- 1,148+ Google reviews at 5 stars
- 628 reviews on Sirelo, rated 10.0/10
- Rated 5.0 on Angi
- **Won "Best of Madison" Gold Medal two years running** — voted on by customers
- This level of review volume dominates the local pack and is heavily cited by AI tools. It is almost certainly the #1 reason they outrank Reynolds for local queries.

**2. Dedicated Location Pages with Conversion Funnels**
Their site (only 34 pages total — leaner than Reynolds' 50) has a purpose-built page for every territory:
- `/madison/` — dedicated Madison page
- `/milwaukee-north/`, `/milwaukee-south/`, `/waukesha/`

Each location then has its own:
- Estimate request page
- Online estimate form
- Internal office estimator

This laser-focused structure tells Google exactly what city each page serves, and gives users a direct path to booking.

**3. Dedicated Trust Pages**
They have standalone pages for:
- `/our-story/`
- `/our-mission/`
- `/our-promise/`
- `/the-badger-brothers-difference/`
- `/price-match-policy/` — directly addresses the price objection before a customer even asks
- `/testimonials/` — a dedicated page Google can index and surface

**4. FAQ Page**
`/faqs/` is a high-value SEO asset. FAQ content is one of the primary sources AI tools pull from when answering "what should I look for in a mover" type questions. Reynolds has no equivalent page.

**5. Referral Program**
Location-specific referral pages (`/madison-referrals/`, `/milwaukee-referrals/`) drive word-of-mouth systematically. This compounds review volume over time.

**6. They Are Running Google Ads**
The URL shared was a paid ad landing page (note: `gclid=` parameter). They are buying traffic for location-specific terms while also winning organically. Reynolds would need to decide if paid search is worth pursuing alongside organic improvements.

### What Reynolds Has That Badger Brothers Doesn't
- Far deeper service breadth (heavy haul, international, trade show, art/museum, containers, auto transport)
- 138 years of history vs. a newer company
- Actual case studies with named clients (City of Madison, UW-Milwaukee, Chazen Art Museum)
- These are stronger differentiators — they just aren't being leveraged for SEO

---

## On AI Queries Specifically

AI tools like ChatGPT and Perplexity build their knowledge from:
1. Structured data (schema markup)
2. High-authority third-party mentions (Yelp, MoveBuddha, local news)
3. Consistent NAP across the web
4. Google Business Profile data

Reynolds appearing on review aggregators like MoveBuddha, Yelp, and Angi with strong ratings and consistent information will directly improve how AI tools describe and recommend the company.
