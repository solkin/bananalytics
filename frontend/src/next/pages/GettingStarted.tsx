import { useState, type ReactNode } from 'react'
import { Link, useLocation, useOutletContext, useParams } from 'react-router-dom'
import { Button, Icons, Text, Title } from '@/ui'
import { getApp } from '@/api/apps'
import { useAsync } from '../async'
import { CodeBlock } from '../CodeBlock'
import type { ShellContext } from '../layout/AppShell'
import { CreateKeyModal } from './ApiKeysPage'
import './gettingstarted.css'

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <div className="gs-step">
      <div className="gs-step__num">{n}</div>
      <div className="gs-step__body">
        <div className="gs-step__title">{title}</div>
        {children}
      </div>
    </div>
  )
}

export default function GettingStarted() {
  const { appId } = useParams()
  const { role } = useOutletContext<ShellContext>()
  const location = useLocation()
  const state = useAsync(() => getApp(appId!), [appId])
  const name = state.data?.name ?? 'your app'

  /* Keys are stored hashed, so the value only exists here right after it was
     created — either with the app (handed over by the create dialog) or from
     the button below. */
  const [created, setCreated] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const key = created ?? (location.state as { apiKey?: string } | null)?.apiKey ?? null

  const settings = `// settings.gradle.kts
dependencyResolutionManagement {
    repositories {
        google()
        mavenCentral()
        maven { url = uri("https://jitpack.io") }
    }
}`

  const dep = `// app/build.gradle.kts  (minSdk 21+)
dependencies {
    implementation("com.github.solkin:bananalytics-android:1.0.0")
}`

  const init = `import android.app.Application
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
                apiKey = "${key ?? 'bnn_xxxxx'}",
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

  const events = `bananalytics.trackEvent("app_open")
bananalytics.trackEvent("tab_selected", key = "tab", value = "store")
bananalytics.trackEvent(
    name = "purchase",
    fields = mapOf("price" to 9.99),
)`

  const crash = `try {
    risky()
} catch (e: Exception) {
    bananalytics.trackException(e, context = mapOf("screen" to "checkout"))
}`

  return (
    <div className="gs">
      <div className="bnn-card">
        <div className="bnn-card__body">
          <div className="gs-intro">
            <Title level={3}>Set up the Bananalytics Android SDK</Title>
            <Text type="secondary">
              Send crashes and analytics from {name} (Android). Full guide:{' '}
              <Link className="gs-link" to="/docs">
                Documentation
                <Icons.IconExternalLink size={12} />
              </Link>
              .
            </Text>
          </div>

          <div className="gs-steps">
            <Step n={1} title="Add the JitPack repository">
              <Text size="sm" type="secondary">In <span className="bnn-mono">settings.gradle.kts</span>:</Text>
              <CodeBlock code={settings} />
            </Step>

            <Step n={2} title="Add the dependency">
              <Text size="sm" type="secondary">In your module <span className="bnn-mono">build.gradle.kts</span>:</Text>
              <CodeBlock code={dep} />
            </Step>

            <Step n={3} title="Initialize in Application.onCreate()">
              {key ? (
                <Text size="sm" type="secondary">
                  Your API key is filled in below — copy it now, it is shown only once. Keep it private.
                </Text>
              ) : (
                <div className="gs-key">
                  <Text size="sm" type="secondary">
                    API keys are shown only once, so paste in a key you saved — or{' '}
                    {role === 'admin' ? 'create a new one.' : 'ask an app admin for one.'}
                  </Text>
                  {role === 'admin' && (
                    <Button icon={<Icons.IconLock size={14} />} onClick={() => setCreateOpen(true)}>
                      Create API key
                    </Button>
                  )}
                </div>
              )}
              <CodeBlock code={init} />
            </Step>

            <Step n={4} title="Track an event">
              <CodeBlock code={events} />
            </Step>

            <Step n={5} title="Crash reporting">
              <Text size="sm" type="secondary">Fatal crashes are captured automatically and uploaded on the next launch. Report handled exceptions explicitly:</Text>
              <CodeBlock code={crash} />
              <Text size="sm" type="tertiary">Upload <span className="bnn-mono">mapping.txt</span> under Diagnostics → Mappings for readable stack traces.</Text>
            </Step>
          </div>
        </div>
      </div>

      {createOpen && (
        <CreateKeyModal
          appId={appId!}
          defaultName="Default"
          onClose={() => setCreateOpen(false)}
          onCreated={setCreated}
        />
      )}
    </div>
  )
}
