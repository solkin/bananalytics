import { useEffect, useState } from 'react'
import { cn } from '@/ui'
import { CodeBlock } from '../CodeBlock'
import { TopHeader } from '../layout/TopHeader'
import './docs.css'

const SECTIONS: [string, string][] = [
  ['overview', 'Overview'],
  ['install', 'Install the SDK'],
  ['initialize', 'Initialize'],
  ['events', 'Track events'],
  ['exceptions', 'Report exceptions'],
  ['breadcrumbs', 'Breadcrumbs'],
  ['how', 'How it works'],
  ['deobfuscation', 'Deobfuscate crashes'],
  ['publish', 'Publish from CI'],
  ['key', 'Get your app key'],
]

/** How far below the top of the window a heading counts as the current section. */
const ACTIVE_LINE = 96

const SETTINGS = `// settings.gradle.kts
dependencyResolutionManagement {
    repositories {
        google()
        mavenCentral()
        maven { url = uri("https://jitpack.io") }
    }
}`

const DEP = `// app/build.gradle.kts  (minSdk 21+)
dependencies {
    implementation("com.github.solkin:bananalytics-android:1.0.0")
}`

const INIT = `import com.tomclaw.bananalytics.*
import com.tomclaw.bananalytics.api.Environment

val config = BananalyticsConfig(
    baseUrl = "https://bnn.appteka.store",
    apiKey = "bnn_xxxxx",
)

val bananalytics = BananalyticsImpl(
    filesDir = context.filesDir,
    config = config,
    environmentProvider = object : EnvironmentProvider {
        override fun environment() = Environment(
            packageName = context.packageName,
            appVersion = BuildConfig.VERSION_CODE.toLong(),
            appVersionName = BuildConfig.VERSION_NAME,
            deviceId = installId,            // stable per-install UUID you persist
            osVersion = Build.VERSION.SDK_INT,
            manufacturer = Build.MANUFACTURER,
            model = Build.MODEL,
            country = Locale.getDefault().country,
            language = Locale.getDefault().language,
        )
    },
    isDebug = BuildConfig.DEBUG,
)

// Call early in Application.onCreate()
bananalytics.install()`

const EVENTS = `bananalytics.trackEvent("app_open")
bananalytics.trackEvent("tab_selected", key = "tab", value = "store")
bananalytics.trackEvent(
    name = "purchase",
    tags = mapOf("sku" to "pro"),
    fields = mapOf("price" to 9.99),
)

// Send buffered events immediately (optional)
bananalytics.flushEvents()`

const EXCEPTIONS = `// Fatal crashes are captured automatically and uploaded on the next launch.

// Report a handled (non-fatal) exception explicitly:
try {
    risky()
} catch (e: Exception) {
    bananalytics.trackException(e, context = mapOf("screen" to "checkout"))
}`

const BREADCRUMBS = `import com.tomclaw.bananalytics.api.BreadcrumbCategory

bananalytics.leaveBreadcrumb("Opened HomeActivity", BreadcrumbCategory.NAVIGATION)
bananalytics.leaveBreadcrumb("Tapped Buy", BreadcrumbCategory.USER_ACTION)
// Categories: NAVIGATION, USER_ACTION, NETWORK, ERROR, CUSTOM`

const PUBLISH = `# one step after the build, with an upload-scoped key in CI secrets
gzip -9 -c app/build/outputs/mapping/release/mapping.txt > mapping.txt.gz

curl --fail-with-body -X POST https://bnn.appteka.store/api/v1/releases \\
  -H "X-API-Key: $BANANALYTICS_KEY" \\
  -F apk=@app/build/outputs/apk/release/app-release.apk \\
  -F mapping=@mapping.txt.gz \\
  -F release_notes="$(git log -1 --pretty=%s)" \\
  -F notify=true`

export default function DocsPage() {
  const [activeId, setActiveId] = useState(() => {
    const hash = window.location.hash.slice(1)
    return SECTIONS.some(([id]) => id === hash) ? hash : SECTIONS[0][0]
  })

  useEffect(() => {
    const ids = SECTIONS.map(([id]) => id)
    const onScroll = () => {
      let current = ids[0]
      for (const id of ids) {
        const el = document.getElementById(id)
        if (el && el.getBoundingClientRect().top <= ACTIVE_LINE) current = id
      }
      /* The short final sections cannot reach the line, so the very bottom pins the last one. */
      if (window.innerHeight + Math.ceil(window.scrollY) >= document.documentElement.scrollHeight - 2) {
        current = ids[ids.length - 1]
      }
      setActiveId(current)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div className="docs">
      <TopHeader />
      <div className="docs__body">
        <nav className="docs__toc" aria-label="On this page">
          {SECTIONS.map(([id, label]) => (
            <a
              key={id}
              href={`#${id}`}
              className={cn('docs__link', id === activeId && 'is-active')}
              aria-current={id === activeId ? 'location' : undefined}
              onClick={() => setActiveId(id)}
            >
              {label}
            </a>
          ))}
        </nav>

        <main className="docs__main">
          <h1 className="docs__title">Bananalytics documentation</h1>
          <p className="docs__lead">
            Self-hosted analytics and crash reporting for Android. Add the SDK, point it at your server, and your events and crashes show up here.
          </p>

          <section id="overview">
            <h2>Overview</h2>
            <p>
              Bananalytics is a lightweight, self-hosted platform for mobile analytics and crash reporting. The Android SDK is
              offline-first and ships with minimal dependencies (Kotlin, Gson, OkHttp), so you keep full control of your data.
            </p>
            <ul>
              <li>Custom <strong>event tracking</strong> with string tags and numeric fields</li>
              <li>Automatic <strong>fatal crash</strong> capture and manual non-fatal exceptions</li>
              <li><strong>Breadcrumbs</strong>, a trail of actions leading up to a crash</li>
              <li>Offline-first delivery with retry, events batched for efficiency</li>
              <li>R8 and ProGuard <strong>deobfuscation</strong> on the server</li>
            </ul>
            <p className="docs__meta">minSdk 21 · Java 17 · Apache-2.0</p>
          </section>

          <section id="install">
            <h2>Install the SDK</h2>
            <p>The SDK is distributed via JitPack. Add the repository to <code>settings.gradle.kts</code>:</p>
            <CodeBlock label="Repository settings" code={SETTINGS} />
            <p>Then add the dependency to your module:</p>
            <CodeBlock label="Dependency" code={DEP} />
            <p className="docs__meta">Latest version: jitpack.io/#solkin/bananalytics-android</p>
          </section>

          <section id="initialize">
            <h2>Initialize</h2>
            <p>
              Create a <code>BananalyticsConfig</code> with your server URL and app key, implement <code>EnvironmentProvider</code>,
              then create and <code>install()</code> the SDK early in <code>Application.onCreate()</code>:
            </p>
            <CodeBlock label="Initialization" code={INIT} />
          </section>

          <section id="events">
            <h2>Track events</h2>
            <p>Log custom events with a name, optional string <code>tags</code> and numeric <code>fields</code>. Several overloads are available:</p>
            <CodeBlock label="Event tracking" code={EVENTS} />
            <p>Events are stored locally and sent in batches of 20. Call <code>flushEvents()</code> to send immediately.</p>
          </section>

          <section id="exceptions">
            <h2>Report exceptions</h2>
            <p>
              Uncaught (fatal) exceptions are captured automatically and uploaded on the next app launch. Report handled (non-fatal)
              exceptions explicitly with <code>trackException</code>:
            </p>
            <CodeBlock label="Exception reporting" code={EXCEPTIONS} />
          </section>

          <section id="breadcrumbs">
            <h2>Breadcrumbs</h2>
            <p>Leave breadcrumbs to record what happened before a crash. They live in an in-memory ring buffer (max 50) and are attached to the next crash report:</p>
            <CodeBlock label="Breadcrumbs" code={BREADCRUMBS} />
          </section>

          <section id="how">
            <h2>How it works</h2>
            <ul>
              <li><strong>Events:</strong> written to JSON files in <code>files/bananalytics/events/</code>, batched (20), then <code>POST /api/v1/events/submit</code>.</li>
              <li><strong>Crashes:</strong> written synchronously to disk before the app dies, then sent on the next <code>install()</code> via <code>POST /api/v1/crashes/submit</code>.</li>
              <li><strong>Offline-first:</strong> data stays on disk and retries until it is delivered, so nothing is lost without a network.</li>
            </ul>
          </section>

          <section id="deobfuscation">
            <h2>Deobfuscate crashes</h2>
            <p>
              If you ship R8 or ProGuard-minified builds, upload the <code>mapping.txt</code> for each version under <strong>Diagnostics, Mappings</strong>.
              The server deobfuscates incoming stack traces automatically.
            </p>
          </section>

          <section id="publish">
            <h2>Publish from CI</h2>
            <p>One request uploads a build and publishes it for testers. The package name and version are read from the APK, so the pipeline only hands over the file:</p>
            <CodeBlock label="Publishing from CI" code={PUBLISH} />
            <p>
              The response carries a download link (valid 30 days by default) you can post to your team chat. Optional parts: <code>version_code</code> and <code>version_name</code> to
              override what the APK says, <code>publish=false</code> to upload without showing it to testers, <code>notify=true</code> to email admins and testers,
              <code> link_expires_in_hours</code> for a shorter-lived link.
            </p>
            <p>
              Re-running the same build overwrites that version instead of failing, so a retried pipeline is safe. Use an <strong>upload</strong> key here. The SDK key is rejected, because it ships inside your app.
            </p>
          </section>

          <section id="key">
            <h2>Get your app key</h2>
            <p>
              Open your app, then <strong>Settings, API keys</strong>, and create a key. An <strong>SDK</strong> key looks like <code>bnn_xxxxx</code> and goes
              into <code>BananalyticsConfig.apiKey</code>. A <strong>CI upload</strong> key publishes releases and belongs in your CI secrets. Keep both private.
            </p>
            <p>Keys are stored hashed and shown only once, right after creation. Create a separate named key per build or integration, so revoking one leaves the others working.</p>
          </section>
        </main>
      </div>
    </div>
  )
}
