# Deploying on Cloudflare

The site runs on Cloudflare Workers as static files. Cloudflare watches the GitHub repository: every time you push to the `main` branch, it builds the site, runs the check, and publishes the result. If the check fails, nothing is published and the last good version stays online.

It's free for a site this size. Setup takes about 20 minutes.

Cloudflare's dashboard changes from time to time. If a button has moved, the matching Cloudflare guides are linked at the end.

## 1. Get the code onto `main`

Cloudflare publishes from `main`. On GitHub, open a pull request from `claude/salt-light-electrical-build-by6trs` into `main` and merge it.

Keep the repository **private**. Cloudflare can build from a private repository.

## 2. Create a Cloudflare account

Sign up at https://dash.cloudflare.com/sign-up. The free plan is enough.

## 3. Connect the repository

1. In the Cloudflare dashboard, open **Workers & Pages** and select **Create application**.
2. Choose **Import a repository**, then connect your GitHub account. When GitHub asks which repositories Cloudflare can see, choose **Only select repositories** and pick `Saltandlightelectrical`.
3. Select the repository and fill in the settings:

   | Setting | Value |
   |---|---|
   | Project name | `salt-and-light-electrical` (it must match `name` in `wrangler.jsonc`) |
   | Production branch | `main` |
   | Build command | leave empty (see below) |
   | Deploy command | `npx wrangler deploy` |
   | Root directory | leave empty |

   The build command can stay empty because `wrangler.jsonc` tells wrangler to build and check the site itself before every deploy. If you'd rather see it in the dashboard too, `node tools/build.mjs && node tools/check.mjs` works there as well; the site then builds twice, which does no harm.

4. Select **Deploy**. The first build takes a minute or two. In the build log you should see `[custom build] Check passed`, then the upload.

When it finishes, Cloudflare shows the address, something like `https://salt-and-light-electrical.<your-name>.workers.dev`. That address is public: anyone you send it to can open it.

The project uses Node 22, set by the `.node-version` file. If a build ever complains about the Node version, add a build variable `NODE_VERSION` with the value `22` under the project's **Settings > Build**.

## 4. Tell the site its address

The site needs its own address for links in search results, the RSS feed and link previews.

1. On GitHub, open `site.config.json` and select the pencil to edit it.
2. Change `"url": null` to your address in quotes, for example `"url": "https://salt-and-light-electrical.your-name.workers.dev"`.
3. Commit. Cloudflare rebuilds on its own.

## 5. Quiet or public: choose the mode

The site starts in **quiet** mode. Anyone with the link can see it, but search engines are told to stay away. That's the right mode while you're still reading the copy aloud and setting up the forms.

When you want it found in Google, switch to **prelaunch**:

1. Set a way for people to reach you in `site.config.json`: your `person.email`, or the form `endpoint` values with their `provider` names (see step 7).
2. Add your LinkedIn address to `person.linkedin` if you want it linked.
3. Change `"mode": "quiet"` to `"mode": "prelaunch"` and commit.

If anything is missing, the check fails and the build log lists exactly what to fix. The quiet version stays online until the check passes.

If you plan to use your own domain, set it up (step 6) before prelaunch, so search engines learn the right address from the start.

## 6. Your own domain (optional)

1. Buy a domain from any registrar, or through Cloudflare's own registrar. Australian `.au` domains need an Australian connection, so check the current rules when you buy.
2. If you bought it elsewhere, add it to Cloudflare (**Add a domain**) and change its nameservers at your registrar to the two Cloudflare gives you.
3. Open your Worker, then **Settings > Domains & Routes > Add > Custom domain**, and enter the domain.
4. Update `site.url` in `site.config.json` to the new address and commit.
5. Once the domain works, turn off the `workers.dev` address in **Settings > Domains & Routes**, so the site has one address.

## 7. The forms

The newsletter and contact forms work with any service that accepts a normal HTML form post. For each one:

1. Create the form in the service and copy its form address (the "endpoint").
2. In `site.config.json`, set `forms.newsletter.endpoint` (or `forms.contact.endpoint`) to that address, and `provider` to the service's name. The privacy page names the provider.
3. If the service has its own honeypot field name, put it in `honeypotField`.
4. In the service's settings, set the page it sends people to after a successful submit: `/following/` for the newsletter and `/contact/sent/` for the contact form, on your site's address.
5. If the service supports sending without leaving the page, set `ajax` to `true`.

Until an endpoint is set, the site shows your email address if `person.email` is set, and otherwise says the form opens soon.

## 8. Optional extras

- **Cloudflare Web Analytics:** find Web Analytics in the Cloudflare dashboard, add the site, copy its token into `analytics.cloudflareWebAnalyticsToken`, and replace the `[[VERIFY]]` line the privacy page then shows with Cloudflare's own description of what it collects.
- **Search engines:** after going to prelaunch, verify the site in Google Search Console and Bing Webmaster Tools. Put their verification codes in `analytics.googleSiteVerification` and `analytics.bingSiteVerification`.
- **Locking quiet mode:** if you'd rather only invited people see the site while it's quiet, Cloudflare Access can put a login in front of it.

## Cloudflare's automatic analytics

When a domain runs through Cloudflare on the free plan, Cloudflare switches on real user monitoring (Web Analytics and Observatory both call it RUM) and adds its own script to every page a browser loads. This site's security policy blocks that script, so nothing is collected, but the blocked script shows as an error in the browser console and costs points on Lighthouse's best practices score. The privacy page says there's no analytics, so remove it:

1. In the Cloudflare dashboard, open the **Web Analytics** page (https://dash.cloudflare.com/?to=/:account/web-analytics).
2. For each entry for this site (`saltandlightelectrical.com`, and `www.saltandlightelectrical.com` if it's listed), select **Manage site**, then **Delete**.
3. Wait a few minutes. Choosing **Disable** instead of **Delete** may leave the script in place.

To check, open the site in a browser, then open the developer tools console. There should be no error mentioning `cloudflareinsights`.

If you ever want analytics, use the setup in step 8 instead, so the privacy page and the security policy are updated to match.

## When a build fails

Open the project in **Workers & Pages** and look at the latest build's log. The check prints each failure (lines starting `[custom build]`) with the rule it broke, the page and what to change. Fix it, commit, and Cloudflare tries again. Running `node tools/build.mjs && node tools/check.mjs` on your computer shows the same thing before you push.

**"The directory specified by the assets.directory field does not exist"** means `dist/` was never built. Check that `wrangler.jsonc` still has its `build` section, and that the deploy command is `npx wrangler deploy` run from the top of the repository (root directory empty).

## Cloudflare guides

- Workers Builds and connecting GitHub: https://developers.cloudflare.com/workers/ci-cd/builds/
- Static assets: https://developers.cloudflare.com/workers/static-assets/
- Custom domains: https://developers.cloudflare.com/workers/configuration/routing/custom-domains/
- The workers.dev address: https://developers.cloudflare.com/workers/configuration/routing/workers-dev/
- Build image and Node versions: https://developers.cloudflare.com/workers/ci-cd/builds/build-image/
