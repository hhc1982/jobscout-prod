# JobScout Production — Deploy Guide
## From zero to live app in ~2 hours

---

## STEP 1 — Create your accounts (15 min)

Sign up for these free services:

| Service | URL | What for |
|---|---|---|
| Supabase | supabase.com | Database + auth + edge functions |
| Stripe | stripe.com | Payments (S$2/month billing) |
| Vercel | vercel.com | Hosting |
| Resend | resend.com | Daily email digest |
| Anthropic | console.anthropic.com | Claude AI API |

---

## STEP 2 — Set up Supabase (20 min)

### 2a. Create project
1. Go to supabase.com → New Project
2. Name: `jobscout`
3. Database password: save this somewhere safe
4. Region: **Southeast Asia (Singapore)**

### 2b. Run database schema
1. In Supabase → SQL Editor → New Query
2. Paste the entire contents of `supabase/migrations/001_schema.sql`
3. Click Run

### 2c. Create storage buckets
In Supabase → Storage → New Bucket:
- Name: `cvs` · Public: OFF
- Name: `screenshots` · Public: OFF

### 2d. Enable Google auth
1. Supabase → Authentication → Providers → Google
2. Enable it
3. Go to console.cloud.google.com → Create OAuth credentials
4. Paste Client ID and Secret back into Supabase

### 2e. Get your keys
Supabase → Settings → API:
- `Project URL` → VITE_SUPABASE_URL
- `anon public` key → VITE_SUPABASE_ANON_KEY
- `service_role` key → SUPABASE_SERVICE_ROLE_KEY (keep secret!)

---

## STEP 3 — Set up Stripe (15 min)

### 3a. Create product
1. Stripe Dashboard → Products → Add Product
2. Name: `JobScout Pro`
3. Price: SGD 2.00 / month / recurring
4. Copy the **Price ID** (starts with `price_`)

### 3b. Get API keys
Stripe → Developers → API Keys:
- Publishable key → VITE_STRIPE_PUBLISHABLE_KEY
- Secret key → STRIPE_SECRET_KEY

### 3c. Set up webhook (after deploying)
1. Stripe → Developers → Webhooks → Add endpoint
2. URL: `https://YOUR_PROJECT.supabase.co/functions/v1/stripe-webhook`
3. Events to listen: `customer.subscription.*`, `invoice.payment_failed`, `checkout.session.completed`
4. Copy webhook signing secret → STRIPE_WEBHOOK_SECRET

---

## STEP 4 — Configure environment variables

Copy `.env.example` to `.env` and fill in all values:

```bash
cp .env.example .env
```

Then edit `.env` with your actual keys.

---

## STEP 5 — Deploy Edge Functions to Supabase (10 min)

Install Supabase CLI:
```bash
npm install -g supabase
supabase login
supabase link --project-ref YOUR_PROJECT_REF
```

Deploy all functions:
```bash
supabase functions deploy parse-cv
supabase functions deploy research
supabase functions deploy cover-letter
supabase functions deploy screenshot-ocr
supabase functions deploy daily-crawl
supabase functions deploy stripe-webhook
```

Set secrets on Supabase (server-side env vars):
```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-xxx
supabase secrets set STRIPE_SECRET_KEY=sk_live_xxx
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_xxx
supabase secrets set ADZUNA_APP_ID=xxx
supabase secrets set ADZUNA_APP_KEY=xxx
supabase secrets set RESEND_API_KEY=re_xxx
supabase secrets set DIGEST_FROM_EMAIL=digest@yourapp.com
supabase secrets set VITE_APP_URL=https://your-app.vercel.app
```

### Schedule daily crawl
In Supabase → Edge Functions → daily-crawl → Schedule:
- Cron: `0 22 * * *` (10 PM UTC = 6 AM Singapore time)

---

## STEP 6 — Deploy to Vercel (10 min)

### 6a. Build and push
```bash
npm install
git add .
git commit -m "JobScout production v1.0"
git push origin main
```

### 6b. Deploy on Vercel
1. vercel.com → Add New Project → Import your repo
2. Framework: **Vite**
3. Add environment variables (copy from your .env file):
   - VITE_SUPABASE_URL
   - VITE_SUPABASE_ANON_KEY
   - VITE_STRIPE_PUBLISHABLE_KEY
   - VITE_STRIPE_PRICE_ID
   - VITE_APP_URL (set to your Vercel URL after first deploy)
   - VITE_TRIAL_DAYS=7
   - VITE_PRICE_SGD=2
4. Click Deploy

### 6c. Add your domain (optional)
Vercel → Settings → Domains → add `jobscout.app` or similar

---

## STEP 7 — Set up Google Play (for Android app)

### 7a. Build the Android app
```bash
npm run build
npm run cap:add:android
npm run cap:sync
npm run cap:android
```

This opens Android Studio. You need:
- Android Studio installed: developer.android.com/studio
- Java 17+

### 7b. Generate a release APK
In Android Studio:
1. Build → Generate Signed Bundle/APK
2. Choose APK
3. Create a new keystore (SAVE THIS FILE — you need it for every update)
4. Build release APK

### 7c. Submit to Google Play
1. play.google.com/console → Create app
2. Pay $25 one-time fee
3. Fill in app details, upload screenshots
4. Upload your APK under Production → Create new release
5. Review and publish (1–3 day review)

---

## STEP 8 — Install on iPhone (PWA — free, no Apple account needed)

Until you're ready for the App Store:
1. Send users to your Vercel URL
2. iPhone: Open in Safari → Share → Add to Home Screen
3. Android: Open in Chrome → three dots → Install App

---

## GOING LIVE CHECKLIST

- [ ] Supabase project created (Singapore region)
- [ ] Database schema run
- [ ] Storage buckets created (cvs, screenshots)
- [ ] Google OAuth configured
- [ ] Stripe product created (SGD 2/month)
- [ ] All Edge Functions deployed
- [ ] Daily crawl scheduled (6 AM SGT)
- [ ] Environment variables set on Vercel
- [ ] Deployed to Vercel
- [ ] Stripe webhook pointing to Supabase
- [ ] Test signup → trial starts
- [ ] Test Stripe checkout → subscription activates
- [ ] Test daily crawl manually
- [ ] Google Play account created ($25)
- [ ] Android APK uploaded

---

## COSTS AT LAUNCH

| Service | Cost | Notes |
|---|---|---|
| Supabase | Free | Up to 500MB DB, 50K users |
| Vercel | Free | Unlimited deployments |
| Anthropic API | ~S$0.02–0.05/user/day | Only when AI features used |
| Resend email | Free | 3,000 emails/month |
| Google Play | S$34 once | One-time developer fee |
| Stripe | 2.9% + S$0.30 | Per transaction |

**Break-even at ~20 paying users** (covers Anthropic API costs)

---

## SUPPORT

For issues, check:
- Supabase logs: supabase.com → Logs → Edge Functions
- Vercel logs: vercel.com → Deployments → Functions
- Stripe events: stripe.com → Developers → Events

---

Built with React + Supabase + Claude API + Stripe
JobScout v1.0 — Production Build
