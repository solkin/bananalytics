import type { ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { Icons, Text, Title, toast } from '@/ui'
import { getApp } from '@/api/apps'
import { useAsync } from '../async'
import './gettingstarted.css'

function CodeBlock({ code }: { code: string }) {
  const copy = () => {
    navigator.clipboard?.writeText(code)
    toast.success('Copied to clipboard')
  }
  return (
    <div className="gs-code">
      <button className="gs-code__copy" type="button" onClick={copy}>
        <Icons.IconCopy size={13} />
        <span>Copy</span>
      </button>
      <pre className="stacktrace">{code}</pre>
    </div>
  )
}

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
  const key = state.data?.api_key ?? 'YOUR_APP_KEY'

  const gradle = `repositories {
    maven { url "https://maven.bananalytics.app" }
}

dependencies {
    implementation "app.bananalytics:sdk-android:1.4.2"
}`

  const init = `import app.bananalytics.Bananalytics

class App : Application() {
    override fun onCreate() {
        super.onCreate()
        Bananalytics.start(this, "${key}")
    }
}`

  const event = `Bananalytics.event("click-tab-store")`

  const crash = `// Crashes are captured automatically once the SDK is started.
// Force a test crash to verify your setup:
throw RuntimeException("Test crash from ${name}")`

  return (
    <div className="gs">
      <div className="bnn-card">
        <div className="bnn-card__body">
          <div className="gs-intro">
            <Title level={3}>Set up the Bananalytics SDK</Title>
            <Text type="secondary">
              Send crashes and analytics from {name} (Android). Full guide:{' '}
              <a className="gs-link" href="#" onClick={(e) => e.preventDefault()}>
                Android SDK docs
                <Icons.IconExternalLink size={12} />
              </a>
              .
            </Text>
          </div>

          <div className="gs-steps">
            <Step n={1} title="Add the SDK to your project">
              <Text size="sm" type="secondary">Add our Maven repository and the dependency to your module <span className="bnn-mono">build.gradle</span>:</Text>
              <CodeBlock code={gradle} />
            </Step>

            <Step n={2} title="Initialize in your Application class">
              <Text size="sm" type="secondary">Start the SDK with your app key (kept on your server — no third parties):</Text>
              <CodeBlock code={init} />
            </Step>

            <Step n={3} title="Track an event">
              <Text size="sm" type="secondary">Log a custom analytics event anywhere in your app:</Text>
              <CodeBlock code={event} />
            </Step>

            <Step n={4} title="Verify crash reporting">
              <Text size="sm" type="secondary">Trigger a test crash, then relaunch — it appears under Diagnostics within a minute:</Text>
              <CodeBlock code={crash} />
            </Step>

            <Step n={5} title="Explore your data">
              <Text size="sm" type="secondary">
                Once the SDK is live, crashes show up under Diagnostics → Issues and analytics under Analytics → Overview.
              </Text>
            </Step>
          </div>
        </div>
      </div>
    </div>
  )
}
