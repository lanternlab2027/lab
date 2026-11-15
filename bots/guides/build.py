#!/usr/bin/env python3
"""Builds the static how-to guides in docs/guides/ from the content below.

Run: python3 bots/guides/build.py
The visible steps and the HowTo JSON-LD come from the same lists, so they can't drift apart.
Sources and the date each was checked are in bots/guides/NOTES.md.
"""
import html, json, re, pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2] / "docs" / "guides"
BASE = "https://lanternlab2027.github.io/lab/"
CHECKED = "Nov 2026"
CSP = ("default-src 'none'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; "
       "base-uri 'none'; form-action 'none'; object-src 'none'")


def plain(s):
    """HTML fragment -> plain text for JSON-LD."""
    s = re.sub(r"<[^>]+>", "", s)
    return re.sub(r"\s+", " ", html.unescape(s)).strip()


def steps_html(steps):
    out = ['<ol class="steps">']
    for name, body in steps:
        out.append(f'  <li><b class="step">{name}</b>{body}</li>')
    out.append("</ol>")
    return "\n".join(out)


def howto_ld(g):
    ld = {
        "@context": "https://schema.org",
        "@type": "HowTo",
        "name": g["howto_name"],
        "description": g["description"],
        "inLanguage": "en",
        "url": BASE + "guides/" + g["slug"],
    }
    if "tools" in g:
        ld["tool"] = [{"@type": "HowToTool", "name": t} for t in g["tools"]]
    if "sections" in g:  # HowToSection per platform
        ld["step"] = [{
            "@type": "HowToSection", "name": sec_name,
            "itemListElement": [{"@type": "HowToStep", "position": i + 1, "name": plain(n), "text": plain(b),
                                 "url": BASE + "guides/" + g["slug"] + "#" + anchor}
                                for i, (n, b) in enumerate(steps)],
        } for sec_name, anchor, steps in g["sections"]]
    else:
        ld["step"] = [{"@type": "HowToStep", "position": i + 1, "name": plain(n), "text": plain(b),
                       "url": BASE + "guides/" + g["slug"] + "#steps"}
                      for i, (n, b) in enumerate(g["steps"])]
    return json.dumps(ld, indent=1, ensure_ascii=False).replace("</", "<\\/")


def more_guides(g):
    """Links to the other guides, same app first (SEO audit Nov 15: guides linked
    to no other guide)."""
    others = [x for x in GUIDES if x is not g]
    others.sort(key=lambda x: x["app"] != g["app"])
    items = "\n".join(f'    <li><a href="{x["slug"]}"><b>{x["h1"]}</b></a></li>' for x in others)
    return f"""
  <h2 id="more">More guides</h2>
  <ul class="guide-list">
{items}
  </ul>"""


def page(g):
    canonical = BASE + "guides/" + g["slug"]
    e = html.escape
    ld = f'<script type="application/ld+json">\n{howto_ld(g)}\n</script>\n' if g.get("howto", True) else ""
    srcs = "\n".join(f'  <li><a href="{e(u)}" rel="noopener">{t}</a>{(" " + n) if n else ""}</li>'
                     for t, u, n in g["sources"])
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta http-equiv="Content-Security-Policy" content="{CSP}">
<meta name="referrer" content="no-referrer">
<title>{e(g["title"])}</title>
<meta name="description" content="{e(g["description"])}">
<link rel="canonical" href="{canonical}">
<meta name="theme-color" content="{g["theme_color"]}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Lantern Lab">
<meta property="og:title" content="{e(g["og_title"])}">
<meta property="og:description" content="{e(g["description"])}">
<meta property="og:url" content="{canonical}">
<meta property="og:image" content="{BASE}{g["app"]}/og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{e(g["og_title"])}">
<meta name="twitter:description" content="{e(g["description"])}">
<meta name="twitter:image" content="{BASE}{g["app"]}/og.png">
{ld}<link rel="stylesheet" href="guides.css">
</head>
<body class="t-{g["app"]}">
<div class="wrap">
  <nav class="crumbs" aria-label="Breadcrumb"><a href="../">Lantern Lab</a> &rsaquo; <a href="./">Guides</a></nav>
  <header class="top">
    <div class="brand">A Lantern Lab guide</div>
    <h1>{g["h1"]}</h1>
    <p class="lede">{g["lede"]}</p>
    <p class="meta">Last checked: {CHECKED} against the official help pages listed under <a href="#sources">Sources</a>.</p>
  </header>
  <main>
{g["body"]}
  <section class="cta" aria-labelledby="cta-h">
    <h2 id="cta-h">{g["cta_h"]}</h2>
    <p>{g["cta_p"]}</p>
    <a class="btn" href="../{g["app"]}/">{g["cta_btn"]}</a>
  </section>

  <h2 id="sources">Sources</h2>
  <p class="meta">Checked {CHECKED}. Apps change their menus; if a label here doesn't match what you see, the official page wins.</p>
  <ul class="sources">
{srcs}
  </ul>
{more_guides(g)}
  </main>
  <footer>
    <p><b>{g["disclaimer"]}</b> This is an independent guide written by Lantern Lab. Product names are trademarks of their owners and are used only to describe how to use their own features.</p>
    <p><a href="./">All guides</a> &middot; <a href="../{g["app"]}/">{g["app_name"]}</a> &middot; <a href="../">More free tools from Lantern Lab</a></p>
  </footer>
</div>
</body>
</html>
"""


# ---------------------------------------------------------------- WhatsApp
WA_FAQ = "https://faq.whatsapp.com/1180414079177245"
WA_FAQ_OLD = "https://whatsapp.com/faq/en/android/23756533"
WA_ACP = "https://blog.whatsapp.com/introducing-advanced-chat-privacy"

wa_iphone = [
    ("Open the chat.", "Go into the one-to-one or group chat you want to export."),
    ("Tap the contact or group name.", "It's at the top of the chat screen and opens the chat info page."),
    ("Tap <b>Export chat</b>.", "Scroll down the chat info page to find it, near the bottom."),
    ("Choose <b>Without media</b> or the option that includes media.",
     "Without media is smaller and faster. Including media adds recent photos and videos as separate files (see the limits below)."),
    ("Pick where the file goes.",
     "WhatsApp opens the share sheet. WhatsApp's own examples are Message, Mail and Add to Notes; <b>Save to Files</b> keeps it on your phone. On iPhone the export arrives as a <code>.zip</code> with a <code>_chat.txt</code> inside."),
]
wa_android = [
    ("Open the chat.", "Go into the one-to-one or group chat you want to export."),
    ("Tap <b>More options</b> &#8942;, then <b>More</b>, then <b>Export chat</b>.",
     "The three-dot menu is in the top-right corner. These are the exact menu names in WhatsApp's help article."),
    ("Tap <b>Without media</b> or <b>Include media</b>.", "Without media is smaller and faster."),
    ("Choose how to send or save it.",
     "Pick an app from the list, for example email, Google Drive or a Files app. The chat is a <code>.txt</code> file named like <code>WhatsApp Chat with &hellip;</code>, sometimes inside a <code>.zip</code>."),
]

WA_BODY = f"""
  <div class="panel quick">
    <b class="label">Quick answer</b>
    <p><b>iPhone:</b> open the chat &rarr; tap the contact or group name &rarr; <b>Export chat</b> &rarr; <b>Without media</b> &rarr; save or share.<br>
    <b>Android:</b> open the chat &rarr; &#8942; <b>More options</b> &rarr; <b>More</b> &rarr; <b>Export chat</b> &rarr; <b>Without media</b> &rarr; save or share.<br>
    <b>WhatsApp Web / Desktop:</b> no official export steps; export from your phone (see below).</p>
  </div>

  <h2 id="iphone">Export a WhatsApp chat on iPhone</h2>
{steps_html(wa_iphone)}
  <p class="meta">About our check: WhatsApp's article has Android and iOS tabs, but the text our checker could read was the Android version. The iPhone route above (chat name &rarr; Export chat) is how the iPhone app is laid out; the media option may be labelled <b>Attach Media</b> or <b>Include media</b> depending on version. If a label differs, follow WhatsApp's article.</p>

  <h2 id="android">Export a WhatsApp chat on Android</h2>
{steps_html(wa_android)}

  <h2 id="web-desktop">WhatsApp Web and WhatsApp Desktop</h2>
  <p>WhatsApp's "How to export your chat history" article only gives instructions for the <b>Android</b> and <b>iOS</b> apps. We found no official instructions for exporting a chat from WhatsApp Web or the Windows or Mac desktop apps, so we won't guess at a menu that may not exist.</p>
  <p>If you need the file on a computer, export it on your phone using the steps above, then send it to yourself: email it, save it to iCloud Drive or Google Drive, or AirDrop it.</p>

  <h2 id="limits">Limits: what an export does and doesn't include</h2>
  <ul>
    <li><b>Media is partial.</b> WhatsApp says that if you include media, <em>the most recent</em> media is attached, not every photo and video ever sent.</li>
    <li><b>It's not a backup.</b> WhatsApp says the export is a text file and <b>can't be re-imported</b> into WhatsApp. To move or restore chats, use WhatsApp's chat backup instead.</li>
    <li><b>Message count limits.</b> The current official article gives <b>no number</b>. Older versions of WhatsApp's FAQ, still widely quoted, said about <b>10,000 recent messages with media</b> and <b>40,000 without media</b>, blamed on maximum email sizes. We couldn't confirm those numbers on WhatsApp's current page, so treat them as unconfirmed. If a long chat seems cut short, export <b>Without media</b>.</li>
    <li><b>One phone's history.</b> The export can only contain messages that are on the phone you export from.</li>
  </ul>

  <h2 id="troubleshooting">Troubleshooting</h2>
  <details><summary>"Export chat" is missing or greyed out in one chat</summary><div>
    <p>Someone in the chat may have turned on <b>Advanced Chat Privacy</b>. WhatsApp introduced it in April 2025, and when it's on, participants can't export the chat. Tap the chat name, then <b>Advanced Chat Privacy</b>, to see whether it's on. Only ask the person who turned it on; it exists so people can keep a chat from being exported.</p>
  </div></details>
  <details><summary>"Export chat" is missing in every chat</summary><div>
    <p>Update WhatsApp from the App Store or Google Play first. Some users report that the option isn't offered in certain countries (press reports in 2019 said it was removed in Germany); WhatsApp's help center doesn't document this, so we can't confirm which countries are affected.</p>
  </div></details>
  <details><summary>The export is huge or won't send</summary><div>
    <p>Export again and choose <b>Without media</b>. Email apps often reject large attachments; saving to Files or Drive avoids that.</p>
  </div></details>
  <details><summary>Can I put the exported chat back into WhatsApp?</summary><div>
    <p>No. WhatsApp says chat history exported this way can't be re-imported, because it's a text file and not a backup file.</p>
  </div></details>

  <h2 id="privacy">Privacy: what's in a WhatsApp export file</h2>
  <div class="panel note">
    <p>The export is a plain-text file. Anyone who has the file can read it; WhatsApp's end-to-end encryption doesn't cover a copy that has left the app. It contains:</p>
    <ul>
      <li>every message's <b>date and time</b> and the <b>sender</b>, shown as the name saved in your contacts, or as a <b>phone number</b> for people you haven't saved;</li>
      <li>the full <b>text of every message</b>, including links, from everyone in the chat, not just you;</li>
      <li>system lines such as people joining or leaving, and placeholders like <code>&lt;Media omitted&gt;</code> when you export without media;</li>
      <li>if you include media, recent <b>photos, videos, voice notes and documents</b> as separate files.</li>
    </ul>
    <p>Other people's messages and phone numbers are in there, so think before you share the file, and delete copies from email or cloud storage once you're done.</p>
  </div>
"""

WHATSAPP = dict(
    slug="how-to-export-whatsapp-chat.html", app="wrapped", app_name="Group Chat Wrapped", theme_color="#1b0b4d",
    title="How to Export a WhatsApp Chat on iPhone & Android (2026 Guide)",
    og_title="How to export a WhatsApp chat (iPhone, Android, Web)",
    description="Export a WhatsApp chat on iPhone or Android in under a minute, with or without media, plus what Web and Desktop can do, limits, fixes and privacy tips.",
    h1="How to export a WhatsApp chat",
    lede="Step-by-step for iPhone and Android, what to do on WhatsApp Web or Desktop, and what the export file actually contains.",
    howto_name="How to export a WhatsApp chat",
    tools=["WhatsApp on an iPhone or Android phone"],
    sections=[("Export a WhatsApp chat on iPhone", "iphone", wa_iphone),
              ("Export a WhatsApp chat on Android", "android", wa_android)],
    body=WA_BODY,
    cta_h="Turn your export into shareable cards, on your device",
    cta_p="Group Chat Wrapped reads your WhatsApp <code>.txt</code> or <code>.zip</code> and makes cards for the top yapper, night owl, ghost and emoji royalty. Free, and the chat never leaves your browser.",
    cta_btn="Make your Group Chat Wrapped",
    sources=[
        ("WhatsApp Help Center: How to export your chat history", WA_FAQ, "(Android steps; media and re-import notes)"),
        ("Same article at its older whatsapp.com address", WA_FAQ_OLD, ""),
        ("WhatsApp Blog: Introducing Advanced Chat Privacy (Apr 23, 2025)", WA_ACP, "(blocking exports)"),
    ],
    disclaimer="Not affiliated with WhatsApp or Meta.",
)

# ---------------------------------------------------------------- Telegram
TG_BLOG = "https://telegram.org/blog/export-and-more"
TG_SCHEMA = "https://core.telegram.org/import-export"
TG_DESKTOP = "https://desktop.telegram.org/"
TG_SUGGEST = "https://bugs.telegram.org/c/86"

tg_steps = [
    ("Install Telegram Desktop and sign in.",
     f"Download it from <a href='{TG_DESKTOP}' rel='noopener'>desktop.telegram.org</a> (Windows, macOS or Linux). Telegram's phone apps don't have chat export."),
    ("Open the chat or group.", "Click it in the chat list on the left."),
    ("Click the &#8942; menu, then <b>Export chat history</b>.", "The menu is in the top-right corner of the chat."),
    ("Untick the media you don't need.", "For text only, untick photos, videos, voice messages and files. The export is much faster without them."),
    ("Set <b>Format</b> to <b>Machine-readable JSON</b>.", "Choose HTML instead if you just want to read the chat in a browser. JSON is what other tools (including ours) can read."),
    ("Click <b>Export</b>.",
     "When it finishes, open the folder Telegram shows you. The JSON file is called <code>result.json</code>. An HTML export opens from <code>messages.html</code>."),
]

TG_BODY = f"""
  <div class="panel quick">
    <b class="label">Quick answer</b>
    <p>On a computer, open <b>Telegram Desktop</b> &rarr; open the chat &rarr; &#8942; &rarr; <b>Export chat history</b> &rarr; untick media &rarr; Format: <b>Machine-readable JSON</b> &rarr; <b>Export</b>. You get a <code>result.json</code> file.</p>
  </div>

  <h2 id="which-apps">Which Telegram apps can export?</h2>
  <p>Telegram added its export tool to <b>Telegram Desktop</b> in 2018. Telegram's own suggestion tracker still lists "Chat Export in mobile apps" as an open request, and its workaround is to use Telegram Desktop. So:</p>
  <ul>
    <li><b>iPhone and Android:</b> no export. Use Telegram Desktop on a computer and sign in to the same account.</li>
    <li><b>Mac:</b> there are two Telegram apps for Mac. Official docs only describe export in <b>Telegram Desktop</b> from desktop.telegram.org, not the separate "Telegram for macOS" app, so install Telegram Desktop if you don't see the option.</li>
    <li><b>Web versions:</b> not covered by any official export docs we found.</li>
  </ul>

  <h2 id="steps">Export one chat as JSON in Telegram Desktop</h2>
{steps_html(tg_steps)}

  <h3>Exporting everything instead of one chat</h3>
  <p>To export your whole account (all chats, contacts and more), Telegram's docs say to go to <b>Settings &rarr; Advanced &rarr; Export Telegram data</b>. For a single group, the per-chat export above is smaller and simpler.</p>

  <h2 id="troubleshooting">Troubleshooting</h2>
  <details><summary>I can't find "Export chat history"</summary><div>
    <p>You're probably in a phone app or the separate "Telegram for macOS" app. Install Telegram Desktop from desktop.telegram.org, sign in, and look in the chat's &#8942; menu. Update the app if it's old.</p>
  </div></details>
  <details><summary>My export only has my own messages</summary><div>
    <p>That's expected for public groups and channels: Telegram's export docs say exports of those only contain the messages sent by the person exporting. Private groups and one-to-one chats include everyone's messages.</p>
  </div></details>
  <details><summary>I got HTML files but need JSON</summary><div>
    <p>Run the export again and change <b>Format</b> to <b>Machine-readable JSON</b>. The JSON file is <code>result.json</code>.</p>
  </div></details>
  <details><summary>Some photos or files are missing</summary><div>
    <p>Telegram's docs say media larger than your chosen size limit is replaced with a note instead of the file. Raise the size limit and export again if you need it.</p>
  </div></details>
  <details><summary>Telegram asks me to wait before exporting</summary><div>
    <p>Some people see a security message asking them to come back later, usually on a newly signed-in computer. Telegram's docs that we checked don't describe this, so follow the time shown in the app. If you didn't start an export yourself, check <b>Settings &rarr; Devices</b> for sessions you don't recognize.</p>
  </div></details>

  <h2 id="privacy">Privacy: what's in a Telegram export file</h2>
  <div class="panel note">
    <p>Telegram's published schema says <code>result.json</code> holds the chat's <b>name, type and ID</b>, then every message with:</p>
    <ul>
      <li>its <b>date</b>, the sender's <b>name</b> and their numeric <b>Telegram user ID</b>;</li>
      <li>the full <b>text</b>, including links, mentions and formatting;</li>
      <li>replies, edits, forwards (with who it was forwarded from) and service events such as people joining or pinned messages;</li>
      <li>if you included media, the <b>file paths</b> of photos, videos, voice messages and files saved next to it.</li>
    </ul>
    <p>It's a plain file on your computer. It isn't protected by Telegram's encryption once exported, and it includes other people's messages, so share it carefully and delete it when you're done.</p>
  </div>
"""

TELEGRAM = dict(
    slug="how-to-export-telegram-chat-history.html", app="wrapped", app_name="Group Chat Wrapped", theme_color="#1b0b4d",
    title="How to Export Telegram Chat History to JSON (Telegram Desktop)",
    og_title="How to export Telegram chat history (JSON)",
    description="Export a Telegram chat or group to JSON with Telegram Desktop: step-by-step, which apps can export, troubleshooting, and what result.json contains.",
    h1="How to export Telegram chat history",
    lede="Telegram exports chats from its desktop app only. Here's how to get a single chat as a <code>result.json</code> file, and what's inside it.",
    howto_name="How to export Telegram chat history as JSON with Telegram Desktop",
    tools=["Telegram Desktop on Windows, macOS or Linux"],
    steps=tg_steps,
    body=TG_BODY,
    cta_h="Turn your export into shareable cards, on your device",
    cta_p="Group Chat Wrapped reads Telegram's <code>result.json</code> and makes cards for the top yapper, night owl, ghost and more. Free, and the chat never leaves your browser.",
    cta_btn="Make your Group Chat Wrapped",
    sources=[
        ("Telegram Blog: Chat Export Tool, Better Notifications and More (Aug 27, 2018)", TG_BLOG, "(Telegram Desktop, JSON or HTML, Export chat history)"),
        ("Telegram: Data Export Schema", TG_SCHEMA, "(Settings > Advanced > Export Telegram data, result.json contents, public-group and media-size notes)"),
        ("Telegram Bugs and Suggestions: Chat Export in mobile apps", TG_SUGGEST, "(open request; workaround is Telegram Desktop)"),
        ("Telegram Desktop download", TG_DESKTOP, ""),
    ],
    disclaimer="Not affiliated with Telegram.",
)

# ---------------------------------------------------------------- Goodreads
GR_HELP = "https://help.goodreads.com/s/article/000001100"
GR_PAGE = "https://www.goodreads.com/review/import"
GR_THIRD = "https://pickupreader.com/blog/how-to-export-goodreads-library-2026"

gr_steps = [
    ("Sign in at goodreads.com in a web browser.",
     "Use a computer, or on a phone open your browser's menu and choose <b>Request desktop site</b> (Safari: <b>aA &rarr; Request Desktop Website</b>). The Goodreads app has no export button."),
    ("Click <b>My Books</b>.", "It's in the top menu."),
    ("Click <b>Import and export</b>.",
     f"It's under <b>Tools</b> in the left sidebar. You can also go straight to <a href='{GR_PAGE}' rel='noopener'>goodreads.com/review/import</a>."),
    ("Click <b>Export Library</b>.", "Goodreads starts preparing the file. Big libraries can take a while."),
    ("Download the file.",
     "When it's ready, a link to the export appears on the same page (refresh if it doesn't). The file is <code>goodreads_library_export.csv</code>."),
]

GR_BODY = f"""
  <div class="panel quick">
    <b class="label">Quick answer</b>
    <p>On the Goodreads <b>website</b>: <b>My Books</b> &rarr; <b>Import and export</b> (left sidebar, under Tools) &rarr; <b>Export Library</b> &rarr; download <code>goodreads_library_export.csv</code>.</p>
  </div>

  <h2 id="steps">Export your Goodreads library</h2>
{steps_html(gr_steps)}

  <div class="panel warn">
    <p><b>About our check:</b> Goodreads' official help article, "Import or export your books", loads with JavaScript, and our checker couldn't read its text in {CHECKED}. The steps above match the labels on Goodreads' Import and Export page as described in a guide dated August 2026 and in our own app's instructions. If anything differs, follow the official article (linked below).</p>
  </div>

  <h2 id="troubleshooting">Troubleshooting</h2>
  <details><summary>I can't find the export in the Goodreads app</summary><div>
    <p>It isn't there. Open goodreads.com in your phone's browser, switch to the desktop site, and follow the steps above.</p>
  </div></details>
  <details><summary>I clicked Export Library and nothing appeared</summary><div>
    <p>Large libraries take longer to prepare. Wait a few minutes and refresh the Import and Export page; the download link appears there when it's ready.</p>
  </div></details>
  <details><summary>The ISBNs or dates look wrong in Excel</summary><div>
    <p>Spreadsheet apps can reformat ISBNs and dates when they open a CSV. Keep the original download untouched, and upload that file to other tools rather than a re-saved copy.</p>
  </div></details>
  <details><summary>Re-reads only show one date</summary><div>
    <p>The <b>Date Read</b> column only holds one date per book. The <b>Read Count</b> column tells you how many times you've read it.</p>
  </div></details>

  <h2 id="privacy">Privacy: what's in a Goodreads export file</h2>
  <div class="panel note">
    <p>The CSV is one row per book on your shelves, with columns like:</p>
    <ul>
      <li>title, author, ISBN, publisher, binding and page count;</li>
      <li><b>your star rating</b> and the Goodreads average rating;</li>
      <li>your <b>shelves</b>, the <b>date added</b> and <b>date read</b>, read count and owned copies;</li>
      <li><b>your reviews</b> and your <b>private notes</b>.</li>
    </ul>
    <p>Private notes are hidden on Goodreads but <b>are</b> in this file, so check before you send it to anyone.</p>
  </div>
"""

GOODREADS = dict(
    slug="how-to-export-goodreads-library.html", app="reading", app_name="Reading Wrapped", theme_color="#123524",
    title="How to Export Your Goodreads Library to CSV (Step by Step, 2026)",
    og_title="How to export your Goodreads library",
    description="Download your Goodreads library as a CSV: My Books, Import and export, Export Library. Works on a phone via the desktop site. Troubleshooting and privacy notes.",
    h1="How to export your Goodreads library",
    lede="Get every book, rating, shelf and read date out of Goodreads as one <code>.csv</code> file, from the Goodreads website.",
    howto_name="How to export your Goodreads library as a CSV file",
    tools=["A web browser (desktop site)"],
    steps=gr_steps,
    body=GR_BODY,
    cta_h="Turn your export into shareable cards, on your device",
    cta_p="Reading Wrapped turns <code>goodreads_library_export.csv</code> into year-in-books cards: books and pages read, top-rated read, favorite author and your reader personality. Free, and your library never leaves your browser.",
    cta_btn="Make your Reading Wrapped",
    sources=[
        ("Goodreads Help: Import or export your books", GR_HELP, "(official; its text didn't load for our checker, see note above)"),
        ("Goodreads: Import and Export page", GR_PAGE, "(requires sign-in)"),
        ("Pick Up: How to export your Goodreads library in 2026 (Aug 16, 2026)", GR_THIRD, "(third-party guide used to cross-check labels)"),
    ],
    disclaimer="Not affiliated with Goodreads or Amazon.",
)

# ---------------------------------------------------------------- StoryGraph
SG_ROADMAP = "https://roadmap.thestorygraph.com/requests-ideas/posts/export-csv"
SG_EXPORT = "https://app.thestorygraph.com/user-export"
SG_MANAGE = "https://app.thestorygraph.com/manage-account"
SG_START = "https://thestorygraph.freshdesk.com/support/solutions/articles/79000142013-getting-started-with-storygraph"
SG_ISBN = "https://roadmap.thestorygraph.com/bugs/posts/export-errors-on-isbn-column-data"
SG_GENRES = "https://roadmap.thestorygraph.com/requests-ideas/posts/add-genres-to-tsg-library-export"

sg_steps = [
    ("Sign in to The StoryGraph in a web browser.", "Go to app.thestorygraph.com on a computer or your phone's browser."),
    ("Open the menu in the top-right corner and choose <b>Manage Account</b>.",
     f'Or go straight to <a href="{SG_MANAGE}" rel="noopener">app.thestorygraph.com/manage-account</a>.'),
    ("Open the export page.",
     f'From Manage Account, follow the link to export your data. It goes to the User Export page, <a href="{SG_EXPORT}" rel="noopener">app.thestorygraph.com/user-export</a>.'),
    ("Start the export.", "Use the button on that page to generate your StoryGraph library export."),
    ("Download the <code>.csv</code> file when it's ready.",
     "Depending on the size of your library this can take a little while. Some guides say StoryGraph emails a download link; StoryGraph's help center doesn't say, so check both the page and your inbox."),
]

SG_BODY = f"""
  <div class="panel quick">
    <b class="label">Quick answer</b>
    <p>On the StoryGraph <b>website</b>: top-right menu &rarr; <b>Manage Account</b> &rarr; export your data (the <b>User Export</b> page) &rarr; generate the export &rarr; download the <code>.csv</code>.</p>
  </div>

  <h2 id="steps">Export your StoryGraph library</h2>
{steps_html(sg_steps)}

  <div class="panel warn">
    <p><b>What's official and what isn't:</b> StoryGraph's help center doesn't have an export article. The route above comes from a StoryGraph team reply on its official roadmap board ("export your data on the User Export page, which can be accessed from the Manage Account one"), and its Getting Started article, which puts Manage Account in the top-right menu. StoryGraph doesn't document the exact button label, whether the file is emailed, or whether the phone app has the same page, so we don't state those as fact. If you don't see the option in the app, use a browser.</p>
  </div>

  <h2 id="troubleshooting">Troubleshooting</h2>
  <details><summary>The ISBN column shows errors in Excel</summary><div>
    <p>This is a known issue on StoryGraph's roadmap (open since January 2024): Excel can mangle the ISBN column. The file itself is usually fine. Keep the original download and upload that to other tools instead of a re-saved copy.</p>
  </div></details>
  <details><summary>My genres aren't in the export</summary><div>
    <p>The export includes your own tags, moods and pace, but not StoryGraph's genre tags. Users have asked for genres on StoryGraph's roadmap; it isn't there yet.</p>
  </div></details>
  <details><summary>I want to move my Goodreads books into StoryGraph instead</summary><div>
    <p>That's the import, not the export. StoryGraph's Getting Started article says to go to <b>Manage Account</b> in the top-right menu and use the Goodreads import. You'll need your <a href="how-to-export-goodreads-library.html">Goodreads export file</a> first.</p>
  </div></details>
  <details><summary>Page counts are missing</summary><div>
    <p>StoryGraph's library export doesn't include page counts or community ratings, only your own data. If you need those, a Goodreads export has them.</p>
  </div></details>

  <h2 id="privacy">Privacy: what's in a StoryGraph export file</h2>
  <div class="panel note">
    <p>The CSV is one row per book, with columns including:</p>
    <ul>
      <li>title, authors, contributors, ISBN and format;</li>
      <li><b>read status</b> (read, currently reading, to-read, did not finish), <b>dates added and read</b>, and read count;</li>
      <li>your <b>star rating</b>, <b>review</b>, moods, pace and character answers;</li>
      <li>your <b>content warnings</b>, <b>tags</b> and whether you own the book.</li>
    </ul>
    <p>Your reviews and tags are in the file even if they're private on StoryGraph, so check before you share it.</p>
  </div>
"""

STORYGRAPH = dict(
    slug="how-to-export-storygraph-data.html", app="reading", app_name="Reading Wrapped", theme_color="#123524",
    title="How to Export Your StoryGraph Data (Library CSV), Step by Step",
    og_title="How to export your StoryGraph library",
    description="Download your StoryGraph library as a CSV from Manage Account and the User Export page. What's official, what's in the file, and fixes for common problems.",
    h1="How to export your StoryGraph data",
    lede="Download your StoryGraph library (books, ratings, reviews, moods and read dates) as a single <code>.csv</code> file.",
    howto_name="How to export your StoryGraph library as a CSV file",
    tools=["A web browser"],
    steps=sg_steps,
    body=SG_BODY,
    cta_h="Turn your export into shareable cards, on your device",
    cta_p="Reading Wrapped turns your StoryGraph CSV into year-in-books cards: books read, top-rated read, mood mix, favorite author and your reader personality. Free, and your library never leaves your browser.",
    cta_btn="Make your Reading Wrapped",
    sources=[
        ("The StoryGraph Roadmap: Export CSV (team reply Jul 7, 2022; marked Shipped)", SG_ROADMAP, "(User Export page, reached from Manage Account)"),
        ("The StoryGraph Help: Getting Started with StoryGraph", SG_START, "(Manage Account in the top-right menu; Goodreads import)"),
        ("The StoryGraph Roadmap: Export errors on ISBN column data", SG_ISBN, "(open bug)"),
        ("The StoryGraph Roadmap: Add genres to library export", SG_GENRES, ""),
        ("StoryGraph User Export page", SG_EXPORT, "(requires sign-in)"),
    ],
    disclaimer="Not affiliated with The StoryGraph.",
)

# ---------------------------------------------------------------- Libby
LB_HELP = "https://help.libbyapp.com/en-us/6207.htm"
LB_JOURNEY = "https://help.libbyapp.com/6151.htm"
LB_LIBANSWERS = "https://carlsbadca.libanswers.com/faq/332573"
LB_PARSER = "https://github.com/clockworkcoding/LibbyGraph"
LB_PARSER2 = "https://github.com/drmowinckels/storywell"
LB_JSON = "https://github.com/jwmccay/libby-bracket"

lb_steps = [
    ("Open Libby and tap <b>Shelf</b>.", "It's in the navigation bar at the bottom of the app (or the bottom of libbyapp.com in a browser)."),
    ("Tap <b>Timeline</b>.", "It's at the top of the Shelf screen. Your timeline lists the titles you've borrowed, returned and placed on hold."),
    ("Clear any filters you don't want.",
     "Libby's help says any active filters are applied when you export. For a whole year in books, export everything; you can pick the year later."),
    ("Tap <b>Actions</b>, then <b>Export Timeline</b>.", "Libby asks which format you want."),
    ("Choose <b>Spreadsheet</b>.",
     "Libby saves the timeline to your device as a file you can open in a spreadsheet app. Tools we checked find it named <code>libbytimeline-activities.csv</code>. <b>Table</b> makes a shareable web page instead of a file."),
]

LB_BODY = f"""
  <div class="panel quick">
    <b class="label">Quick answer</b>
    <p>In Libby: <b>Shelf</b> &rarr; <b>Timeline</b> &rarr; <b>Actions</b> &rarr; <b>Export Timeline</b> &rarr; <b>Spreadsheet</b>. You get a <code>.csv</code> file of every borrow, return and hold.</p>
  </div>

  <h2 id="steps">Export your Libby timeline</h2>
{steps_html(lb_steps)}

  <h2 id="formats">Table or Spreadsheet: which to pick</h2>
  <ul>
    <li><b>Spreadsheet</b> saves a file to your device so you can review or edit it. Pick this one for other tools, including Reading Wrapped.</li>
    <li><b>Table</b> shows your timeline on a web page you can bookmark or share with friends. Anyone with that link can see the page, so share it with care.</li>
  </ul>
  <div class="panel warn">
    <p><b>About our check:</b> Libby's help article (last updated September 2026) lists exactly two formats, <b>Table</b> and <b>Spreadsheet</b>. Older open-source tools describe a <b>Data</b> (JSON) option and links ending in <code>libbytimeline-&hellip;.json</code>; we couldn't find that option in Libby's current help, so it may have been removed or renamed. Libby doesn't publish the spreadsheet's columns. The ones below come from open-source tools that read real exports, not from OverDrive.</p>
  </div>

  <h2 id="whats-inside">What's in the spreadsheet</h2>
  <p>One row per event, newest first. Open-source tools that read real exports find these columns: <code>Cover</code>, <code>Title</code>, <code>Author</code>, <code>Publisher</code>, <code>ISBN</code>, <code>Timestamp</code>, <code>Activity</code>, <code>Details</code>, <code>Library</code>. <b>Activity</b> is the event, such as <b>Borrowed</b>, <b>Returned</b> or <b>Placed on hold</b>; for a loan, <b>Details</b> holds the loan length (for example "21 days").</p>
  <p>A book you borrowed and returned shows up on two rows (more if you held it or borrowed it again). There's no rating, page count or "finished" flag: Libby records loans, not reading.</p>

  <h2 id="troubleshooting">Troubleshooting</h2>
  <details><summary>My timeline is missing older loans</summary><div>
    <p>First check that no filter is on (see the next answer). Beyond that, Libby's help pages we checked don't say how far back the timeline goes or how it moves to a new phone, so we can't promise older loans are recoverable. If you've switched devices, make sure you're using the same Libby setup and library cards, and ask your library if something is still missing.</p>
  </div></details>
  <details><summary>The export only has some of my books</summary><div>
    <p>A filter was probably on. Go back to <b>Timeline</b>, clear the filters, and export again: Libby applies active filters to the export.</p>
  </div></details>
  <details><summary>I tapped Table and got a link, not a file</summary><div>
    <p>That's the shareable web page. Go back to <b>Actions &rarr; Export Timeline</b> and choose <b>Spreadsheet</b> to save a file instead.</p>
  </div></details>
  <details><summary>Can I import this into Goodreads or StoryGraph?</summary><div>
    <p>Some library help pages say the spreadsheet can be imported into Goodreads, and community tools convert it for StoryGraph. The columns don't match Goodreads' own export, so expect to tidy it up. Reading Wrapped reads the Libby file directly, no conversion needed.</p>
  </div></details>

  <h2 id="privacy">Privacy: what's in a Libby timeline export</h2>
  <div class="panel note">
    <p>The file is your library borrowing history. It contains:</p>
    <ul>
      <li>the <b>title, author, publisher and ISBN</b> of every book, audiobook and magazine you borrowed or held;</li>
      <li>the <b>date and time</b> of each borrow, return and hold;</li>
      <li>the <b>name of the library</b> each loan came from, which can hint at where you live.</li>
    </ul>
    <p>Libraries treat borrowing records as private for good reason. Keep the file to yourself, and delete copies from email or cloud storage when you're done. A <b>Table</b> link shows the same history to anyone who opens it.</p>
  </div>
"""

LIBBY = dict(
    slug="how-to-export-libby-timeline.html", app="reading", app_name="Reading Wrapped", theme_color="#123524",
    title="How to Export Your Libby Timeline to a Spreadsheet (2026)",
    og_title="How to export your Libby timeline",
    description="Export your Libby reading history: Shelf, Timeline, Actions, Export Timeline, then Spreadsheet. What Table and Spreadsheet do, what's in the file, and fixes.",
    h1="How to export your Libby timeline",
    lede="Get every library ebook and audiobook you've borrowed out of Libby as one spreadsheet file, straight from the app.",
    howto_name="How to export your Libby timeline as a spreadsheet",
    tools=["The Libby app (or libbyapp.com)"],
    steps=lb_steps,
    body=LB_BODY,
    cta_h="Turn your Libby history into shareable cards, on your device",
    cta_p="Reading Wrapped reads <code>libbytimeline-activities.csv</code> and makes year-in-books cards: books borrowed and returned, your reading rhythm, favorite author and a Library love card with your loans, favorite library and ebook vs audiobook split. Free, and your history never leaves your browser.",
    cta_btn="Make your Reading Wrapped",
    sources=[
        ("Libby Help: Exporting and sharing your timeline activity (updated Sep 3, 2026)", LB_HELP, "(official; steps, filters, Table and Spreadsheet)"),
        ("Libby Help: Exporting Reading Journey data (updated Sep 3, 2026)", LB_JOURNEY, "(official; the same Table and Spreadsheet choices for one title)"),
        ("Carlsbad City Library: What is my timeline in Libby? (updated Sep 26, 2025)", LB_LIBANSWERS, "(library FAQ; Table and Spreadsheet, Goodreads import)"),
        ("LibbyGraph (open source)", LB_PARSER, "(reads libbytimeline-activities; Borrowed and Returned activities)"),
        ("storywell (open source)", LB_PARSER2, "(spreadsheet columns: Cover, Title, Author, Publisher, ISBN, Timestamp, Activity, Details, Library)"),
        ("libby-bracket (open source)", LB_JSON, "(older JSON data export: timeline, activity, details, library)"),
    ],
    disclaimer="Not affiliated with Libby or OverDrive.",
)

# ---------------------------------------------------------------- Sleeper
SL_HELP = "https://support.sleeper.com/en/articles/4121798-how-to-find-your-league-id"
SL_API = "https://docs.sleeper.com/"

sl_app = [
    ("Open your league in the Sleeper app.", "Tap the league from your home screen."),
    ("Go to <b>League Settings</b>, then <b>General League Settings</b>.", "League settings are reached from inside the league."),
    ("Scroll to the bottom and copy the <b>League ID</b>.", "Sleeper puts a copy option for the League ID at the bottom of General League Settings."),
]
sl_web = [
    ("Log in at sleeper.com and open your league.", "Use any web browser."),
    ("Look at the end of the address bar.",
     "The league ID is the long number at the end of the URL, after <code>/leagues/</code>. Copy all of the digits."),
]

SL_BODY = f"""
  <div class="panel quick">
    <b class="label">Quick answer</b>
    <p><b>App:</b> open the league &rarr; <b>League Settings</b> &rarr; <b>General League Settings</b> &rarr; scroll down &rarr; copy <b>League ID</b>.<br>
    <b>Web:</b> open the league on sleeper.com; the ID is the long number at the end of the address, like <code>sleeper.com/leagues/<b>1180000000000000001</b></code> (example only).</p>
  </div>

  <h2 id="app">Find your league ID in the Sleeper app</h2>
{steps_html(sl_app)}

  <h2 id="web">Find your league ID on sleeper.com</h2>
{steps_html(sl_web)}
  <p>Sleeper's help article describes the ID as an 18-digit number. Copy whatever digits are there, all of them; a shortened ID won't work.</p>

  <h2 id="notes">Good to know</h2>
  <ul>
    <li><b>New season, new ID (probably).</b> Sleeper's API docs show leagues with a <code>previous_league_id</code> field, which suggests a league that renews for a new season gets a new ID that points back to last year's. Sleeper doesn't spell this out, so if an old ID shows last season's data, grab the ID again from the current league.</li>
    <li><b>You may not need the ID at all.</b> Our Fantasy League Awards page also accepts your <b>Sleeper username</b> (it lists your leagues) or a pasted league link.</li>
  </ul>

  <h2 id="troubleshooting">Troubleshooting</h2>
  <details><summary>A tool says "league not found"</summary><div>
    <p>Check you copied the whole number, with no spaces or extra characters. Pasting the full league link is a safe fallback, if the tool accepts links. Make sure it's this season's league (see above).</p>
  </div></details>
  <details><summary>I can't find the League ID in the app</summary><div>
    <p>Update the Sleeper app, then look at the very bottom of <b>General League Settings</b>. If it still isn't there, use the web method: open the league on sleeper.com and copy the number from the address bar.</p>
  </div></details>
  <details><summary>Is the league ID the same as my user ID?</summary><div>
    <p>No. Your user ID belongs to your account; the league ID belongs to one league in one season. Tools that ask for a league ID need the league's number.</p>
  </div></details>

  <h2 id="privacy">Privacy: what a league ID gives access to</h2>
  <div class="panel note">
    <p>Sleeper doesn't have an "export file" for leagues. Instead, its developer API is <b>read-only and needs no login</b> (Sleeper's docs: "No API Token is necessary"). That means anyone who has your league ID can look up:</p>
    <ul>
      <li>the league name, settings and scoring;</li>
      <li>members' <b>usernames, display names and team names</b>;</li>
      <li>rosters, weekly matchups and scores, trades, waivers and other transactions.</li>
    </ul>
    <p>It doesn't expose passwords, emails or payment details. Share the ID with your league and tools you trust; don't post it publicly if your league would rather keep its trash talk private.</p>
  </div>
"""

SLEEPER = dict(
    slug="how-to-find-sleeper-league-id.html", app="awards", app_name="Fantasy League Awards", theme_color="#0a1b33",
    title="How to Find Your Sleeper League ID (App & Web, 2026)",
    og_title="How to find your Sleeper league ID",
    description="Find your Sleeper league ID in seconds: in the app under League Settings, General League Settings, or at the end of the league URL on sleeper.com.",
    h1="How to find your Sleeper league ID",
    lede="Fantasy tools ask for it all the time. It's in two places: the bottom of your league settings in the app, and the end of the league's web address.",
    howto_name="How to find your Sleeper league ID",
    sections=[("Find your league ID in the Sleeper app", "app", sl_app),
              ("Find your league ID on sleeper.com", "web", sl_web)],
    body=SL_BODY,
    cta_h="Turn your league into shareable award cards",
    cta_p="Fantasy League Awards reads your Sleeper league and makes weekly award cards: highest scorer, biggest blowout, heartbreak loss, bench warmer and power rankings. Free, no login, and the cards are drawn in your browser.",
    cta_btn="Get your league's awards",
    sources=[
        ("Sleeper Support: How to find your League ID", SL_HELP, "(app and web steps)"),
        ("Sleeper API documentation", SL_API, "(read-only, no token; league objects with previous_league_id)"),
    ],
    disclaimer="Not affiliated with Sleeper.",
)

GUIDES = [WHATSAPP, TELEGRAM, GOODREADS, STORYGRAPH, LIBBY, SLEEPER]


def index_page():
    groups = [
        ("Group chats", "Group Chat Wrapped", "wrapped", [WHATSAPP, TELEGRAM]),
        ("Reading", "Reading Wrapped", "reading", [GOODREADS, STORYGRAPH, LIBBY]),
        ("Fantasy football", "Fantasy League Awards", "awards", [SLEEPER]),
    ]
    blocks = []
    for h, app_name, app, gs in groups:
        items = "\n".join(f'      <li><a href="{g["slug"]}"><b>{g["h1"]}</b><span>{html.escape(g["description"])}</span></a></li>' for g in gs)
        blocks.append(f"""  <h2>{h}</h2>
    <ul class="guide-list">
{items}
    </ul>
    <p>Then use it in <a href="../{app}/">{app_name}</a>.</p>""")
    title = "How-to Guides: Export WhatsApp, Telegram, Goodreads & More"
    desc = "Plain, checked how-to guides: export a WhatsApp or Telegram chat, export your Goodreads, StoryGraph or Libby history, and find your Sleeper league ID."
    ld = json.dumps({"@context": "https://schema.org", "@type": "CollectionPage", "name": title, "description": desc,
                     "url": BASE + "guides/",
                     "hasPart": [{"@type": "HowTo", "name": g["howto_name"], "url": BASE + "guides/" + g["slug"]} for g in GUIDES]},
                    indent=1)
    body = "\n".join(blocks)
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta http-equiv="Content-Security-Policy" content="{CSP}">
<meta name="referrer" content="no-referrer">
<title>{html.escape(title)}</title>
<meta name="description" content="{html.escape(desc)}">
<link rel="canonical" href="{BASE}guides/">
<meta name="theme-color" content="#0a1b33">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Lantern Lab">
<meta property="og:title" content="{html.escape(title)}">
<meta property="og:description" content="{html.escape(desc)}">
<meta property="og:url" content="{BASE}guides/">
<meta name="twitter:card" content="summary">
<script type="application/ld+json">
{ld}
</script>
<link rel="stylesheet" href="guides.css">
</head>
<body class="t-awards">
<div class="wrap">
  <nav class="crumbs" aria-label="Breadcrumb"><a href="../">Lantern Lab</a> &rsaquo; Guides</nav>
  <header class="top">
    <div class="brand">Lantern Lab guides</div>
    <h1>How to get your data out</h1>
    <p class="lede">Short, checked guides for exporting chats and reading libraries, and finding your fantasy league ID. Each one cites the official help pages it was checked against.</p>
    <p class="meta">Last checked: {CHECKED}.</p>
  </header>
  <main>
{body}
  </main>
  <footer>
    <p><b>Not affiliated with WhatsApp, Meta, Telegram, Goodreads, Amazon, The StoryGraph, Libby, OverDrive or Sleeper.</b> These are independent guides; product names are trademarks of their owners.</p>
    <p><a href="../">More free tools from Lantern Lab</a></p>
  </footer>
</div>
</body>
</html>
"""


if __name__ == "__main__":
    ROOT.mkdir(parents=True, exist_ok=True)
    for g in GUIDES:
        (ROOT / g["slug"]).write_text(page(g), encoding="utf-8")
        print("wrote", g["slug"], len(g["title"]), "title chars,", len(g["description"]), "desc chars")
    (ROOT / "index.html").write_text(index_page(), encoding="utf-8")
    print("wrote index.html")
