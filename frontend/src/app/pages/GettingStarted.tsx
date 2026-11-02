import { useState, type ReactNode } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { Button } from '@/ui'
import { CodeBlock } from '../CodeBlock'
import { KeyReveal } from '../KeyReveal'
import { useShell } from '../layout/AppShell'
import { CreateKeyDialog } from './ApiKeysPage'
import './gettingstarted.css'

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <li className="gs-step">
      <span className="gs-step__number" aria-hidden>{n}</span>
      <div className="gs-step__body">
        <h2 className="gs-step__title">{title}</h2>
        {children}
      </div>
    </li>
  )
}

const SETTINGS = `// settings.gradle.kts
dependencyResolutionManagement {
    repositories {
        google()
        mavenCentral()
        maven { url = uri("https://jitpack.io") }
    }
}`

const DEPENDENCY = `// app/build.gradle.kts  (minSdk 21+)
dependencies {
    implementation("com.github.solkin:bananalytics-android:1.0.0")
}`

const initSnippet = (key: string) => `import android.app.Application
import android.os.Build
import com.tomclaw.bananalytics.*
import com.tomclaw.bananalytics.api.Environment
import java.util.Locale

class App : Application() {

    lateinit var bananalytics: Bananalytics

    override fun onCreate() {
        super.onCreate()

        bananalytics = BananalyticsImpl(
            filesDir = filesDir,
            config = BananalyticsConfig(
                baseUrl = "https://banana.appteka.store",
                apiKey = "${key}",
            ),
            environmentProvider = object : EnvironmentProvider {
                override fun environment() = Environment(
                    packageName = packageName,
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
        bananalytics.install()
    }
}`

const EVENTS = `bananalytics.trackEvent("app_open")
bananalytics.trackEvent("tab_selected", key = "tab", value = "store")
bananalytics.trackEvent(
    name = "purchase",
    fields = mapOf("price" to 9.99),
)`

const CRASH = `try {
    risky()
} catch (e: Exception) {
    bananalytics.trackException(e, context = mapOf("screen" to "checkout"))
}`

const PUBLISH = `# one step after the build, with an upload-scoped key in CI secrets
gzip -9 -c app/build/outputs/mapping/release/mapping.txt > mapping.txt.gz

curl --fail-with-body -X POST https://banana.appteka.store/api/v1/releases \\
  -H "X-API-Key: $BANANALYTICS_KEY" \\
  -F apk=@app/build/outputs/apk/release/app-release.apk \\
  -F mapping=@mapping.txt.gz \\
  -F release_notes="$(git log -1 --pretty=%s)" \\
  -F notify=true`

export default function GettingStarted() {
  const { appId } = useParams()
  const { role, app } = useShell()
  const location = useLocation()
  /* Keys are stored hashed, so the value only exists here right after it was
     created: with the app (handed over by the create dialog) or from the button. */
  const [created, setCreated] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const key = created ?? (location.state as { apiKey?: string } | null)?.apiKey ?? null

  return (
    <div className="gs">
      <h1 className="gs__title">Set up the Bananalytics Android SDK</h1>
      <p className="gs__intro">
        Send crashes and analytics from {app?.name ?? 'your app'}. Full guide: <Link to="/docs">Documentation</Link>.
      </p>

      <ol className="gs__steps">
        <Step n={1} title="Add the JitPack repository">
          <p className="gs-text">In <code className="bnn-mono">settings.gradle.kts</code>:</p>
          <CodeBlock label="Repository settings" code={SETTINGS} />
        </Step>

        <Step n={2} title="Add the dependency">
          <p className="gs-text">In your module <code className="bnn-mono">build.gradle.kts</code>:</p>
          <CodeBlock label="Dependency" code={DEPENDENCY} />
        </Step>

        <Step n={3} title="Initialize in Application.onCreate()">
          {key ? (
            <div className="gs-key">
              <p className="gs-text">Copy your API key now. It is stored hashed, so this is the only time it can be read. It is already in the snippet below.</p>
              <KeyReveal value={key} />
            </div>
          ) : (
            <div className="gs-key gs-key--action">
              <p className="gs-text">
                API keys are shown only once, so paste in a key you saved or {role === 'admin' ? 'create a new one.' : 'ask an app admin for one.'}
              </p>
              {role === 'admin' && <Button onClick={() => setCreateOpen(true)}>Create API key</Button>}
            </div>
          )}
          <CodeBlock label="Initialization" code={initSnippet(key ?? 'bnn_xxxxx')} />
        </Step>

        <Step n={4} title="Track an event">
          <CodeBlock label="Event tracking" code={EVENTS} />
        </Step>

        <Step n={5} title="Crash reporting">
          <p className="gs-text">Fatal crashes are captured automatically and uploaded on the next launch. Report handled exceptions explicitly:</p>
          <CodeBlock label="Exception reporting" code={CRASH} />
          <p className="gs-note">
            Upload <code className="bnn-mono">mapping.txt</code> under <Link to={`/apps/${appId}/diagnostics/mappings`}>Mappings</Link> for readable stack traces.
          </p>
        </Step>

        <Step n={6} title="Publish builds from CI">
          <p className="gs-text">One request uploads the APK, reads its version, publishes it for testers and returns a download link:</p>
          <CodeBlock label="Publishing from CI" code={PUBLISH} />
          <p className="gs-note">
            Needs a key of type CI upload, which you create under <Link to={`/apps/${appId}/settings/api-keys`}>API keys</Link>. Full reference: <Link to="/docs#publish">Publish from CI</Link>.
          </p>
        </Step>
      </ol>

      {createOpen && (
        <CreateKeyDialog
          appId={appId!}
          defaultName="Default"
          scope="sdk"
          onClose={() => setCreateOpen(false)}
          onCreated={setCreated}
        />
      )}
    </div>
  )
}
