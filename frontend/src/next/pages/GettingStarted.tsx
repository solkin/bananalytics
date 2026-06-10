import type { ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Icons, Text, Title } from '@/ui'
import { getApp } from '@/api/apps'
import { useAsync } from '../async'
import { CodeBlock } from '../CodeBlock'
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
  const state = useAsync(() => getApp(appId!), [appId])
  const name = state.data?.name ?? 'your app'
  const key = state.data?.api_key ?? 'bnn_xxxxx'

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
              <Text size="sm" type="secondary">Your app key is filled in below — keep it private.</Text>
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
    </div>
  )
}
