import { useState, type ReactNode } from 'react'
import {
  Avatar,
  Breakdown,
  Button,
  Checkbox,
  ConfirmDialog,
  DataList,
  DayBars,
  Dialog,
  Dropzone,
  EmptyState,
  Field,
  Form,
  IconButton,
  Icons,
  Input,
  IssueStatusIcon,
  Kbd,
  LineChart,
  Loading,
  Notice,
  Password,
  Properties,
  RadioCards,
  Segmented,
  Select,
  Skeleton,
  Status,
  Switch,
  Tabs,
  Textarea,
  Tooltip,
  toast,
  type DataListColumn,
} from '@/ui'
import './UiKitPage.css'

const COLORS = [
  ['Canvas', 'canvas'],
  ['Surface', 'surface'],
  ['Hover', 'hover'],
  ['Selected', 'selected'],
  ['Border', 'border'],
  ['Divider', 'divider'],
  ['Control', 'border-control'],
  ['Text', 'text'],
  ['Text strong', 'text-strong'],
  ['Text muted', 'text-muted'],
  ['Text faint', 'text-faint'],
  ['Primary', 'primary'],
  ['Danger', 'danger'],
  ['Open', 'status-open'],
  ['Resolved', 'status-resolved'],
  ['Brand', 'brand'],
]

const TYPE = [
  ['Title', '18 / 600', 'kit-type--title'],
  ['Dialog title', '15 / 600', 'kit-type--large'],
  ['Section heading', '13 / 600', 'kit-type--strong'],
  ['Label and action', '13 / 500', 'kit-type--medium'],
  ['Body', '13 / 400', ''],
  ['Caption', '12 / 400', 'kit-type--caption'],
  ['com.appteka.store', 'Mono 11.5 / 400', 'bnn-mono'],
]

const CHART_DAYS = ['Oct 6', 'Oct 7', 'Oct 8', 'Oct 9', 'Oct 10', 'Oct 11', 'Oct 12', 'Oct 13']
const SPACES = [2, 4, 6, 8, 12, 16, 20, 24, 32]
const RADII = [4, 5, 6, 8, 10]

interface Issue {
  id: number
  status: 'open' | 'resolved' | 'ignored'
  name: string
  reports: number
  devices: number
  last: string
}

const ISSUES: Issue[] = [
  { id: 1, status: 'open', name: 'TransactionTooLargeException', reports: 1284, devices: 612, last: '12m ago' },
  { id: 2, status: 'open', name: 'NullPointerException', reports: 836, devices: 402, last: '1h ago' },
  { id: 3, status: 'resolved', name: 'ClassCastException', reports: 64, devices: 41, last: '6d ago' },
  { id: 4, status: 'ignored', name: 'DeadObjectException', reports: 130, devices: 88, last: '2h ago' },
  { id: 5, status: 'open', name: 'SQLiteDatabaseLockedException', reports: 27, devices: 19, last: '3d ago' },
]

const ISSUE_COLUMNS: DataListColumn<Issue>[] = [
  { key: 'status', title: '', width: 44, render: (r) => <IssueStatusIcon status={r.status} label={r.status} /> },
  { key: 'name', title: 'Issue', render: (r) => <strong className="kit-type--medium">{r.name}</strong> },
  { key: 'reports', title: 'Reports', width: 88, align: 'right', sorter: (a, b) => a.reports - b.reports, render: (r) => r.reports.toLocaleString('en-US') },
  { key: 'devices', title: 'Devices', width: 88, align: 'right', optional: true, sorter: (a, b) => a.devices - b.devices, render: (r) => r.devices.toLocaleString('en-US') },
  { key: 'last', title: 'Last report', width: 104, align: 'right', optional: true, render: (r) => r.last },
]

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="kit-section">
      <h2 className="kit-section__title">{title}</h2>
      {children}
    </section>
  )
}

export default function UiKitPage() {
  const [selectValue, setSelectValue] = useState<string | number>(2)
  const [filter, setFilter] = useState<string | number>('8.4.1')
  const [period, setPeriod] = useState('28')
  const [on, setOn] = useState(true)
  const [checked, setChecked] = useState(true)
  const [scope, setScope] = useState<string | number>('sdk')
  const [issue, setIssue] = useState<number | null>(2)
  const [dialog, setDialog] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [name, setName] = useState('Appteka')

  return (
    <main className="kit">
      <h1 className="kit-type--title">UI kit</h1>

      <Section title="Color">
        <div className="kit-colors">
          {COLORS.map(([label, token]) => (
            <div className="kit-color" key={token}>
              <span className="kit-color__swatch" style={{ background: `var(--bnn-${token})` }} />
              <span className="kit-color__meta">
                <span className="kit-type--medium">{label}</span>
                <span className="bnn-mono kit-faint">--bnn-{token}</span>
              </span>
            </div>
          ))}
        </div>
      </Section>

      <div className="kit-grid">
        <Section title="Type">
          <div className="kit-stack">
            {TYPE.map(([sample, spec, cls]) => (
              <div className="kit-row kit-row--between" key={sample}>
                <span className={cls}>{sample}</span>
                <span className="kit-type--caption kit-faint">{spec}</span>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Space and radius">
          <div className="kit-row kit-row--bottom">
            {SPACES.map((s) => (
              <div className="kit-measure" key={s}>
                <span className="kit-measure__space" style={{ width: s, height: s }} />
                {s}
              </div>
            ))}
          </div>
          <div className="kit-row kit-spaced">
            {RADII.map((r) => (
              <div className="kit-measure" key={r}>
                <span className="kit-measure__radius" style={{ borderRadius: r }} />
                {r}
              </div>
            ))}
          </div>
        </Section>
      </div>

      <Section title="Buttons">
        <div className="kit-row">
          <Button variant="primary" onClick={() => toast.success('Saved')}>Primary</Button>
          <Button>Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Delete</Button>
          <Button variant="danger-solid">Delete forever</Button>
          <Button variant="primary" disabled>Disabled</Button>
          <Button variant="primary" loading>Saving</Button>
          <Button icon={<Icons.IconDownload size={14} />}>With icon</Button>
          <Button variant="primary" size="lg">Large</Button>
          <Tooltip title="Delete issue">
            <IconButton aria-label="Delete issue"><Icons.IconTrash size={15} /></IconButton>
          </Tooltip>
        </div>
      </Section>

      <div className="kit-grid">
        <Section title="Fields">
          <Form>
            <Field label="Default" help="Used for the app list and the sidebar.">
              <Input value={name} onChange={(e) => setName(e.target.value)} allowClear onClear={() => setName('')} />
            </Field>
            <Field label="With an affix">
              <Input prefix={<Icons.IconSearch size={14} />} placeholder="Search apps" />
            </Field>
            <Field label="Password">
              <Password defaultValue="example" />
            </Field>
            <Field label="Error" required error="Use a full package name.">
              <Input defaultValue="com.example" />
            </Field>
            <Field label="Disabled">
              <Input value="Android" disabled readOnly />
            </Field>
            <Field label="Long text" aside="Optional">
              <Textarea placeholder="What's new in this version" />
            </Field>
          </Form>
        </Section>

        <Section title="Choices">
          <Form>
            <Field label="Select">
              <Select
                value={selectValue}
                onChange={setSelectValue}
                options={[
                  { label: 'Admin, full access including settings', value: 1 },
                  { label: 'Viewer, can view analytics and crashes', value: 2 },
                  { label: 'Tester, can download builds', value: 3 },
                  { label: 'Unavailable', value: 4, disabled: true },
                ]}
              />
            </Field>
            <Field label="Filter chips">
              <div className="kit-row">
                <Select
                  variant="chip"
                  name="Version"
                  aria-label="Version"
                  allowClear
                  placeholder="All"
                  value={filter}
                  onChange={setFilter}
                  options={['8.4.1', '8.4.0', '8.3.2'].map((v) => ({ label: v, value: v }))}
                />
                <Select
                  variant="chip"
                  aria-label="Period"
                  value="28"
                  options={[{ label: 'Last 28 days', value: '28' }, { label: 'Last 90 days', value: '90' }]}
                />
              </div>
            </Field>
            <Field label="Segmented">
              <Segmented
                label="Period"
                value={period}
                onChange={setPeriod}
                options={[
                  { label: '7d', value: '7' },
                  { label: '28d', value: '28' },
                  { label: '90d', value: '90' },
                  { label: '1y', value: '365' },
                ]}
              />
            </Field>
            <Field label="Radio cards">
              <RadioCards
                value={scope}
                onChange={setScope}
                options={[
                  { label: 'SDK', hint: 'Submits crashes and events.', value: 'sdk' },
                  { label: 'CI upload', hint: 'Publishes releases.', value: 'upload' },
                ]}
              />
            </Field>
            <div className="kit-row">
              <Switch aria-label="Example switch" checked={on} onChange={setOn} />
              <Switch aria-label="Disabled switch" disabled />
              <Checkbox checked={checked} onChange={setChecked}>Checkbox</Checkbox>
              <Checkbox disabled>Disabled</Checkbox>
            </div>
            <Dropzone title="APK file" hint="Optional, up to 200 MB" />
          </Form>
        </Section>
      </div>

      <Section title="Tabs">
        <Tabs
          label="Crash report"
          items={[
            { key: 'stack', label: 'Stack trace', count: 12, children: 'Stack trace panel' },
            { key: 'device', label: 'Device', children: 'Device panel' },
            { key: 'crumbs', label: 'Breadcrumbs', children: 'Breadcrumbs panel' },
          ]}
        />
      </Section>

      <Section title="List">
        <div className="kit-panel">
          <DataList
            label="Issues"
            columns={ISSUE_COLUMNS}
            data={ISSUES}
            rowKey={(r) => r.id}
            pageSize={4}
            selectedKey={issue}
            onRowClick={(r) => setIssue(r.id)}
          />
        </div>
      </Section>

      <div className="kit-grid">
        <Section title="Status">
          <div className="kit-stack">
            <div className="kit-row">
              <span className="kit-row"><IssueStatusIcon status="open" /> Open</span>
              <span className="kit-row"><IssueStatusIcon status="resolved" /> Resolved</span>
              <span className="kit-row"><IssueStatusIcon status="ignored" /> Ignored</span>
            </div>
            <div className="kit-row">
              <Status tone="positive">Published</Status>
              <Status>Draft</Status>
              <Status tone="warning">Mapping missing</Status>
              <Status tone="danger">Revoked</Status>
            </div>
            <div className="kit-row">
              <Avatar name="Igor Solkin" />
              <Avatar name="Igor Solkin" size={28} />
              <Avatar name="Appteka" shape="square" background="var(--bnn-brand)" />
              <Avatar name="Appteka" shape="square" size={32} background="var(--bnn-brand)" />
              <Kbd>⌘K</Kbd>
              <Kbd>R</Kbd>
            </div>
          </div>
        </Section>

        <Section title="Feedback">
          <div className="kit-stack">
            <Notice tone="warning" title="This app has no active SDK API keys.">
              Crashes and events are rejected until you create one.
            </Notice>
            <Notice tone="error" title="Failed to load.">Check the connection and try again.</Notice>
            <Notice>Stack traces of this version stay obfuscated.</Notice>
            <div className="kit-row">
              <Button onClick={() => toast.success('Resolved NullPointerException', { action: { label: 'Undo', onClick: () => {} } })}>Toast</Button>
              <Button onClick={() => toast.error('Failed to delete issue')}>Error toast</Button>
              <Button onClick={() => setDialog(true)}>Dialog</Button>
              <Button variant="danger" onClick={() => setConfirm(true)}>Confirm</Button>
            </div>
          </div>
        </Section>
      </div>

      <Section title="Charts">
        <div className="kit-stack">
          <LineChart
            label="Example chart"
            height={160}
            series={[
              { label: '8.4.1', data: CHART_DAYS.map((d, i) => ({ label: d, value: 400 + i * 90 })) },
              { label: '8.4.0', data: CHART_DAYS.map((d, i) => ({ label: d, value: 800 - i * 40 })) },
              { label: 'Other', dashed: true, data: CHART_DAYS.map((d, i) => ({ label: d, value: 200 + i * 10 })) },
            ]}
          />
          <div className="kit-grid">
            <DayBars label="Example daily bars" data={CHART_DAYS.map((d, i) => ({ label: d, value: 20 + ((i * 37) % 50) }))} />
            <Breakdown title="Android version" items={[{ label: 'Android 15', value: 46, display: '46%' }, { label: 'Android 14', value: 31, display: '31%' }]} />
          </div>
          <Properties layout="columns" items={[{ label: 'Reports', value: '1,284' }, { label: 'Devices', value: '612' }, { label: 'First seen', value: '20 days ago' }]} />
        </div>
      </Section>

      <Section title="States">
        <div className="kit-grid">
          <div className="kit-panel">
            <EmptyState title="No releases yet" description="Create one here or publish it from CI.">
              <Button variant="primary">New release</Button>
            </EmptyState>
          </div>
          <div className="kit-panel">
            <Loading />
            <div className="kit-stack kit-skeletons">
              <Skeleton width="70%" />
              <Skeleton width="45%" />
            </div>
          </div>
        </div>
      </Section>

      <Dialog
        open={dialog}
        onClose={() => setDialog(false)}
        title="Add new app"
        footer={
          <>
            <Button onClick={() => setDialog(false)}>Cancel</Button>
            <Button variant="primary" onClick={() => setDialog(false)}>Add new app</Button>
          </>
        }
      >
        <Form>
          <Field label="App name"><Input placeholder="My Android App" /></Field>
          <Field label="Package name" help="Immutable after creation.">
            <Input placeholder="com.example.app" />
          </Field>
        </Form>
      </Dialog>
      <ConfirmDialog
        open={confirm}
        title="Delete this release?"
        description="Crashes, events, sessions, APK and mapping for this version will be removed."
        confirmLabel="Delete"
        onConfirm={() => setConfirm(false)}
        onClose={() => setConfirm(false)}
      />
    </main>
  )
}
