import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Avatar, Dropdown, Icons, Tag, Text, Title } from '@/ui'
import { useAuth } from '@/context/AuthContext'
import { CodeBlock } from '../CodeBlock'
import './appshome.css'
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
  ['key', 'Get your app key'],
]

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
    baseUrl = "https://banana.appteka.store",
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

export default function DocsPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const accountName = user?.name || user?.email || 'Account'
  const [activeId, setActiveId] = useState(() => {
    const hash = window.location.hash.slice(1)
    return SECTIONS.some(([id]) => id === hash) ? hash : SECTIONS[0][0]
  })

  useEffect(() => {
    const ids = SECTIONS.map(([id]) => id)
    const onScroll = () => {
      // active = the last section whose heading has crossed the line just
      // below the sticky header (the section currently at the top of view)
      let current = ids[0]
      for (const id of ids) {
        const el = document.getElementById(id)
        if (el && el.getBoundingClientRect().top <= 110) current = id
      }
      // at the very bottom the short final sections can't reach the line —
      // pin the last one so it still highlights
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
    <div className="home">
      <header className="home-top">
        <Link to="/next" className="home-brand">
          <img src="/banana.svg" width={22} height={22} alt="" />
          <span>Bananalytics</span>
        </Link>
        <div className="home-top__right">
          <button className="home-iconbtn" type="button" aria-label="Help">
            <Icons.IconHelp size={17} />
          </button>
          <Dropdown
            items={[
              { key: 'profile', label: 'Profile', icon: <Icons.IconUser size={15} />, onClick: () => navigate('/next/account') },
              { key: 'logout', label: 'Sign out', icon: <Icons.IconLogout size={15} />, danger: true, onClick: () => logout().then(() => navigate('/login')) },
            ]}
          >
            <span className="home-user">
              <Avatar size={26}><Icons.IconUser size={14} /></Avatar>
              <Text size="sm">{accountName}</Text>
              <Icons.IconChevronDown size={14} />
            </span>
          </Dropdown>
        </div>
      </header>

      <div className="docs-body">
        <aside className="docs-toc">
          {SECTIONS.map(([id, label]) => (
            <a
              key={id}
              href={`#${id}`}
              className={id === activeId ? 'is-active' : undefined}
              onClick={() => setActiveId(id)}
            >
              {label}
            </a>
          ))}
        </aside>

        <main className="docs-main">
          <div className="docs-intro">
            <Title level={1}>Bananalytics documentation</Title>
            <Text type="secondary">
              Self-hosted analytics & crash reporting for Android. Add the SDK, point it at your server, and your
              events and crashes show up here.
            </Text>
          </div>

          <section id="overview" className="docs-section">
            <h2>Overview</h2>
            <p>
              Bananalytics is a lightweight, self-hosted platform for mobile analytics and crash reporting. The Android
              SDK is offline-first and ships with minimal dependencies (Kotlin, Gson, OkHttp) — you keep full control of
              your data.
            </p>
            <ul>
              <li>Custom <strong>event tracking</strong> with string tags and numeric fields</li>
              <li>Automatic <strong>fatal crash</strong> capture + manual non-fatal exceptions</li>
              <li><strong>Breadcrumbs</strong> — a trail of actions leading up to a crash</li>
              <li>Offline-first delivery with retry; events batched for efficiency</li>
              <li>R8 / ProGuard <strong>deobfuscation</strong> on the server</li>
            </ul>
            <p><Tag tone="neutral">minSdk 21</Tag> <Tag tone="neutral">Java 17</Tag> <Tag tone="neutral">Apache-2.0</Tag></p>
          </section>

          <section id="install" className="docs-section">
            <h2>Install the SDK</h2>
            <p>The SDK is distributed via JitPack. Add the repository to <code>settings.gradle.kts</code>:</p>
            <CodeBlock code={SETTINGS} />
            <p>Then add the dependency to your module:</p>
            <CodeBlock code={DEP} />
            <p><Text type="tertiary" size="sm">Latest version: jitpack.io/#solkin/bananalytics-android</Text></p>
          </section>

          <section id="initialize" className="docs-section">
            <h2>Initialize</h2>
            <p>
              Create a <code>BananalyticsConfig</code> with your server URL and app key, implement
              {' '}<code>EnvironmentProvider</code>, then create and <code>install()</code> the SDK early in
              {' '}<code>Application.onCreate()</code>:
            </p>
            <CodeBlock code={INIT} />
          </section>

          <section id="events" className="docs-section">
            <h2>Track events</h2>
            <p>
              Log custom events with a name, optional string <code>tags</code> and numeric <code>fields</code>. Several
              overloads are available:
            </p>
            <CodeBlock code={EVENTS} />
            <p>Events are stored locally and sent in batches of 20; call <code>flushEvents()</code> to send immediately.</p>
          </section>

          <section id="exceptions" className="docs-section">
            <h2>Report exceptions</h2>
            <p>
              Uncaught (fatal) exceptions are captured automatically and uploaded on the next app launch. Report handled
              (non-fatal) exceptions explicitly with <code>trackException</code>:
            </p>
            <CodeBlock code={EXCEPTIONS} />
          </section>

          <section id="breadcrumbs" className="docs-section">
            <h2>Breadcrumbs</h2>
            <p>
              Leave breadcrumbs to record what happened before a crash. They live in an in-memory ring buffer (max 50)
              and are attached to the next crash report:
            </p>
            <CodeBlock code={BREADCRUMBS} />
          </section>

          <section id="how" className="docs-section">
            <h2>How it works</h2>
            <ul>
              <li><strong>Events:</strong> written to JSON files in <code>files/bananalytics/events/</code>, batched (20), then <code>POST /api/v1/events/submit</code>.</li>
              <li><strong>Crashes:</strong> written synchronously to disk before the app dies, then sent on the next <code>install()</code> via <code>POST /api/v1/crashes/submit</code>.</li>
              <li><strong>Offline-first:</strong> data stays on disk and retries until it's delivered — nothing is lost without a network.</li>
            </ul>
          </section>

          <section id="deobfuscation" className="docs-section">
            <h2>Deobfuscate crashes</h2>
            <p>
              If you ship R8 / ProGuard-minified builds, upload the <code>mapping.txt</code> for each version under
              {' '}<strong>Diagnostics → Mappings</strong>. The server deobfuscates incoming stack traces automatically.
            </p>
          </section>

          <section id="key" className="docs-section">
            <h2>Get your app key</h2>
            <p>
              Open your app, then <strong>Settings → API key</strong>. The key looks like <code>bnn_xxxxx</code> and goes
              into <code>BananalyticsConfig.apiKey</code>. Keep it private — it authorizes data submission for the app.
            </p>
          </section>
        </main>
      </div>
    </div>
  )
}
