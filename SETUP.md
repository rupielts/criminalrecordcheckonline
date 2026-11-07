# Setup: criminalrecordcheckonline.com on Cloudflare Pages

Folder contents:
- index.html, assets/logo.png : the Home page
- functions/api/click.js      : emails info@surreyfingerprint.com on each button click
- _headers                    : security and caching headers

## 1. Move the domain's DNS to Cloudflare (domain stays registered at Hostinger)
1. Cloudflare dashboard > Add a domain > enter criminalrecordcheckonline.com > choose the Free plan.
2. Cloudflare shows two nameservers (for example xxx.ns.cloudflare.com).
3. Hostinger > Domains > criminalrecordcheckonline.com > DNS / Nameservers > Change nameservers > enter the two Cloudflare ones > save.
4. Wait until Cloudflare shows the domain as Active (minutes to a few hours).

## 2. Deploy the site
The Functions folder is not built by dashboard drag-and-drop, so use one of these:

Option A (recommended): GitHub
1. Put the contents of this folder in a GitHub repository.
2. Cloudflare > Workers & Pages > Create > Pages > Connect to Git > pick the repo.
3. Framework preset: None. Build command: leave empty. Build output directory: /

Option B: Wrangler (command line, needs Node.js)
   npx wrangler pages deploy . --project-name criminal-record-check

## 3. Set up Resend (sends the alert emails)
1. Create a free account at resend.com.
2. Domains > Add Domain > criminalrecordcheckonline.com. Resend lists DNS records (SPF, DKIM).
3. Add those records in Cloudflare > DNS, then click Verify in Resend.
4. API Keys > Create API key (sending access). Copy it.

## 4. Add settings to the Pages project
Pages project > Settings > Variables and Secrets (Production):
- RESEND_API_KEY  (type: Secret)  = the key from step 3
- FROM_EMAIL      = Click Alerts <alerts@criminalrecordcheckonline.com>
- TO_EMAIL        = info@surreyfingerprint.com
Then redeploy so the settings take effect.

Optional but recommended (limits duplicate alerts):
- Cloudflare > Storage & Databases > KV > Create namespace "click-dedupe".
- Pages project > Settings > Bindings > Add > KV namespace > variable name CLICK_KV.

## 5. Connect the domain
Pages project > Custom domains > add criminalrecordcheckonline.com and www.criminalrecordcheckonline.com.

## 6. Test
1. Open the live site and click the button.
2. An email should reach info@surreyfingerprint.com within a minute.
3. If not: Pages project > Functions > Real-time logs, then click again.
Note: the function only accepts clicks from criminalrecordcheckonline.com. To test on a *.pages.dev
address, temporarily add that host to an ALLOWED_HOSTS setting (comma-separated).

## Notes
- Alerts contain no personal data: time, page, approximate city, device type, referrer.
- Disclose this in the privacy policy (we will write it in a later stage).
- Resend's free plan has daily and monthly sending limits. If clicks grow past them, we can switch to a daily summary email.
