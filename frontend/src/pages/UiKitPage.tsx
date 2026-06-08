import { useState, type ReactNode } from 'react'
import './UiKitPage.css'
import {
  AreaChart,
  Alert,
  Avatar,
  BarChart,
  Badge,
  Breadcrumb,
  Button,
  Card,
  Checkbox,
  DatePicker,
  Descriptions,
  Divider,
  Drawer,
  Dropdown,
  Empty,
  Form,
  FormItem,
  Icons,
  Input,
  LineChart,
  Modal,
  NavMenu,
  Password,
  Popconfirm,
  RadioGroup,
  Segmented,
  Select,
  Skeleton,
  Spinner,
  Statistic,
  Switch,
  Table,
  Tabs,
  Tag,
  Text,
  Textarea,
  Title,
  ToastViewport,
  Tooltip,
  UploadDragger,
  toast,
  type ChartPoint,
  type Column,
} from '@/ui'

/* ------------------------------------------------------------- helpers */
function Section({
  id,
  title,
  description,
  children,
}: {
  id: string
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <section id={id} className="kit-section">
      <div className="kit-section__head">
        <Title level={3}>{title}</Title>
        {description && <Text type="secondary">{description}</Text>}
      </div>
      {children}
    </section>
  )
}

function Row({ children }: { children: ReactNode }) {
  return <div className="kit-row">{children}</div>
}

/* ------------------------------------------------------------ demo data */
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct']
const areaData: ChartPoint[] = months.map((m, i) => ({
  label: m,
  value: Math.round(1200 + Math.sin(i / 1.5) * 600 + i * 180),
}))
const barData: ChartPoint[] = months.slice(0, 8).map((m, i) => ({
  label: m,
  value: Math.round(40 + Math.abs(Math.sin(i)) * 80),
}))
const deviceData: ChartPoint[] = [
  { label: 'Xiaomi 14 Pro', value: 3500 },
  { label: 'Redmi Note 13', value: 2600 },
  { label: 'POCO X6', value: 1700 },
  { label: 'Galaxy S24', value: 1400 },
  { label: 'OnePlus 12', value: 900 },
]

interface EventRow {
  name: string
  count: number
  trend: number
  users: number
  perUser: number
}
const eventRows: EventRow[] = [
  { name: 'click-tab-store', count: 128160, trend: 126200, users: 5710, perUser: 22.44 },
  { name: 'open-details-screen', count: 104400, trend: 104400, users: 6700, perUser: 15.64 },
  { name: 'details-download-app', count: 40100, trend: 40100, users: 5900, perUser: 6.79 },
  { name: 'open-search-screen', count: 34000, trend: 34000, users: 10800, perUser: 3.15 },
  { name: 'open-store-fragment', count: 30500, trend: 30500, users: 8200, perUser: 3.74 },
  { name: 'open-home-screen', count: 23200, trend: 22200, users: 8100, perUser: 2.86 },
  { name: 'open-chat-screen', count: 21000, trend: 2100, users: 2660, perUser: 7.88 },
  { name: 'details-install-app', count: 15400, trend: 15400, users: 3900, perUser: 4 },
]

const fmtK = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1).replace('.0', '')}k` : String(n))

const NAV = [
  ['foundation', 'Foundation'],
  ['buttons', 'Buttons'],
  ['data', 'Data display'],
  ['tables', 'Tables'],
  ['forms', 'Forms'],
  ['feedback', 'Feedback'],
  ['overlays', 'Overlays'],
  ['charts', 'Charts'],
]

/* ============================================================== page */
export default function UiKitPage() {
  const [modalOpen, setModalOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [select, setSelect] = useState<string | number>('crashes')
  const [checked, setChecked] = useState(true)
  const [sw, setSw] = useState(true)
  const [radio, setRadio] = useState<string | number>('all')
  const [seg, setSeg] = useState<string>('28d')
  const [date, setDate] = useState('')
  const [tab, setTab] = useState('overview')
  const [topNav, setTopNav] = useState('analytics')
  const [loading, setLoading] = useState(true)

  const columns: Column<EventRow>[] = [
    { key: 'name', title: 'Name', dataIndex: 'name', render: (r) => <Text mono>{r.name}</Text> },
    {
      key: 'count',
      title: 'Count',
      align: 'right',
      sorter: (a, b) => a.count - b.count,
      render: (r) => <Text strong>{fmtK(r.count)}</Text>,
    },
    {
      key: 'trend',
      title: 'Trend',
      align: 'right',
      render: (r) => <Text type="success">+{fmtK(r.trend)}</Text>,
    },
    { key: 'users', title: 'Users', align: 'right', sorter: (a, b) => a.users - b.users, render: (r) => fmtK(r.users) },
    { key: 'perUser', title: 'Per user', align: 'right', render: (r) => r.perUser },
  ]

  return (
    <div className="kit">
      <ToastViewport />

      {/* Top bar */}
      <header className="kit-topbar">
        <div className="kit-topbar__left">
          <div className="kit-topbar__brand">
            <span className="kit-logo">🍌</span>
            <span className="kit-topbar__name">Bananalytics</span>
          </div>
          <NavMenu
            activeKey={topNav}
            onChange={setTopNav}
            items={[
              { key: 'overview', label: 'Overview', icon: <Icons.IconApps size={15} /> },
              { key: 'diagnostics', label: 'Diagnostics', icon: <Icons.IconBug size={15} /> },
              { key: 'analytics', label: 'Analytics', icon: <Icons.IconChart size={15} /> },
              { key: 'settings', label: 'Settings', icon: <Icons.IconSettings size={15} /> },
            ]}
          />
        </div>
        <div className="kit-topbar__right">
          <Tag tone="warning">Preview</Tag>
          <Dropdown
            items={[
              { key: 'profile', label: 'Profile', icon: <Icons.IconUser size={15} /> },
              { key: 'logout', label: 'Sign out', icon: <Icons.IconLogout size={15} />, danger: true },
            ]}
          >
            <span className="kit-user">
              <Avatar size={26}><Icons.IconUser size={14} /></Avatar>
              <Text size="sm" className="kit-username">Igor Sulkin</Text>
              <Icons.IconChevronDown size={14} />
            </span>
          </Dropdown>
        </div>
      </header>

      <div className="kit-body">
        {/* Sidebar nav */}
        <aside className="kit-nav">
          {NAV.map(([id, label]) => (
            <a key={id} href={`#${id}`} className="kit-nav__link">
              {label}
            </a>
          ))}
        </aside>

        <main className="kit-main">
          <div className="kit-intro">
            <Breadcrumb
              items={[{ label: 'Appteka' }, { label: 'Analytics' }, { label: 'UI Kit' }]}
            />
            <Title level={1}>Bananalytics UI Kit</Title>
            <Text type="secondary">
              Lightweight, dependency-free components styled after App Center. Zero AntD.
            </Text>
          </div>

          {/* Foundation */}
          <Section id="foundation" title="Foundation" description="Colors, typography & tags.">
            <Row>
              <Card title="Palette" style={{ flex: 1, minWidth: 320 }}>
                <div className="kit-swatches">
                  {[
                    ['Primary', 'var(--bnn-primary)'],
                    ['Success', 'var(--bnn-success)'],
                    ['Warning', 'var(--bnn-warning)'],
                    ['Danger', 'var(--bnn-danger)'],
                    ['Chart 2', 'var(--bnn-chart-2)'],
                    ['Chart 4', 'var(--bnn-chart-4)'],
                  ].map(([name, c]) => (
                    <div key={name} className="kit-swatch">
                      <span className="kit-swatch__box" style={{ background: c }} />
                      <Text size="sm">{name}</Text>
                    </div>
                  ))}
                </div>
              </Card>
              <Card title="Typography" style={{ flex: 1, minWidth: 320 }}>
                <Title level={1}>Heading 1</Title>
                <Title level={3}>Heading 3</Title>
                <Title level={5}>Heading 5</Title>
                <div style={{ marginTop: 10 }}>
                  <Text>Body text</Text> · <Text type="secondary">secondary</Text> ·{' '}
                  <Text type="tertiary">tertiary</Text> · <Text mono>mono_value</Text>
                </div>
              </Card>
            </Row>
            <Card title="Tags & badges">
              <Row>
                <Tag tone="neutral">neutral</Tag>
                <Tag tone="primary">primary</Tag>
                <Tag tone="success">success</Tag>
                <Tag tone="warning">warning</Tag>
                <Tag tone="danger">danger</Tag>
                <Tag tone="purple">purple</Tag>
                <Divider vertical />
                <Badge count={12} />
                <Badge count={3} tone="primary" />
                <Badge count={99} tone="success" />
              </Row>
            </Card>
          </Section>

          {/* Buttons */}
          <Section id="buttons" title="Buttons" description="Variants, sizes, states & icons.">
            <Card>
              <Row>
                <Button variant="primary">Primary</Button>
                <Button>Default</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="text">Text</Button>
                <Button variant="danger">Danger</Button>
                <Button variant="primary" disabled>Disabled</Button>
                <Button variant="primary" loading>Loading</Button>
              </Row>
              <Divider />
              <Row>
                <Button size="sm" variant="primary" icon={<Icons.IconPlus size={14} />}>Small</Button>
                <Button size="md" icon={<Icons.IconReload size={15} />}>Medium</Button>
                <Button size="lg" variant="primary">Large</Button>
                <Button variant="default" icon={<Icons.IconDownload size={15} />} />
              </Row>
            </Card>
          </Section>

          {/* Data display */}
          <Section id="data" title="Data display" description="Stats, descriptions, avatars, skeletons.">
            <Row>
              {[
                { title: 'Active users', value: '25k', trend: '+5.7k', tone: 'up' as const },
                { title: 'Sessions', value: '106.9k', trend: '2.65 / user', tone: undefined },
                { title: 'Crashes', value: '1.2k', trend: '-3.1%', tone: 'down' as const },
                { title: 'Crash-free', value: '99.4%', trend: '+0.2%', tone: 'up' as const },
              ].map((s) => (
                <Card key={s.title} style={{ flex: 1, minWidth: 200 }}>
                  <Statistic title={s.title} value={s.value} trend={s.trend} trendTone={s.tone} />
                </Card>
              ))}
            </Row>
            <Row>
              <Card title="Crash details" style={{ flex: 2, minWidth: 360 }}>
                <Descriptions
                  column={2}
                  items={[
                    { label: 'Version', value: '16.0 (820)' },
                    { label: 'Device', value: 'Xiaomi 14 Pro' },
                    { label: 'OS', value: 'Android 15' },
                    { label: 'Country', value: 'China' },
                    { label: 'Exception', value: <Text mono>IllegalStateException</Text>, span: 2 },
                  ]}
                />
              </Card>
              <Card title="Loading state" style={{ flex: 1, minWidth: 260 }}>
                <Skeleton rows={4} />
              </Card>
            </Row>
            <Card title="Empty state">
              <Empty description="No crashes reported in this period">
                <Button variant="primary" size="sm" icon={<Icons.IconReload size={14} />}>Refresh</Button>
              </Empty>
            </Card>
          </Section>

          {/* Tables */}
          <Section id="tables" title="Tables" description="Dense, sortable, paginated — App Center events.">
            <Card title="Events" extra={<Segmented size="sm" value={seg} onChange={setSeg} options={[{ label: '7d', value: '7d' }, { label: '28d', value: '28d' }, { label: 'All', value: 'all' }]} />} padded={false}>
              <Table<EventRow>
                columns={columns}
                data={eventRows}
                rowKey={(r) => r.name}
                pageSize={5}
                size="md"
                onRowClick={(r) => toast.info(`Open ${r.name}`)}
              />
            </Card>
          </Section>

          {/* Forms */}
          <Section id="forms" title="Forms" description="Inputs, selects, toggles, upload.">
            <Row>
              <Card title="Fields" style={{ flex: 1, minWidth: 320 }}>
                <Form>
                  <FormItem label="App name" required>
                    <Input placeholder="My Android app" prefix={<Icons.IconApps size={15} />} allowClear value="Appteka" onChange={() => {}} />
                  </FormItem>
                  <FormItem label="API base URL" help="Used by the SDK to submit events.">
                    <Input placeholder="https://your-server.com" />
                  </FormItem>
                  <FormItem label="Password">
                    <Password placeholder="••••••••" prefix={<Icons.IconLock size={15} />} />
                  </FormItem>
                  <FormItem label="Email" error="Please enter a valid email">
                    <Input status="error" placeholder="name@company.com" prefix={<Icons.IconMail size={15} />} />
                  </FormItem>
                  <FormItem label="Release notes">
                    <Textarea placeholder="What's new…" rows={3} />
                  </FormItem>
                </Form>
              </Card>
              <Card title="Controls" style={{ flex: 1, minWidth: 320 }}>
                <Form>
                  <FormItem label="Default tab">
                    <Select
                      value={select}
                      onChange={setSelect}
                      options={[
                        { label: 'Crashes', value: 'crashes' },
                        { label: 'Events', value: 'events' },
                        { label: 'Versions', value: 'versions' },
                        { label: 'Devices (disabled)', value: 'devices', disabled: true },
                      ]}
                    />
                  </FormItem>
                  <FormItem label="Date">
                    <DatePicker value={date} onChange={setDate} />
                  </FormItem>
                  <FormItem label="Visibility">
                    <RadioGroup
                      value={radio}
                      onChange={setRadio}
                      options={[
                        { label: 'All versions', value: 'all' },
                        { label: 'Latest only', value: 'latest' },
                        { label: 'Muted', value: 'muted', disabled: true },
                      ]}
                    />
                  </FormItem>
                  <FormItem label="Options">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <Checkbox checked={checked} onChange={setChecked}>Enable crash collection</Checkbox>
                      <div className="bnn-row" style={{ gap: 10 }}>
                        <Switch checked={sw} onChange={setSw} />
                        <Text size="sm" type="secondary">Email notifications</Text>
                      </div>
                    </div>
                  </FormItem>
                </Form>
              </Card>
            </Row>
            <Card title="Upload">
              <UploadDragger
                hint="APK or mapping.txt up to 500MB"
                onFiles={(f) => toast.success(`Selected ${f.length} file(s)`)}
              />
            </Card>
          </Section>

          {/* Feedback */}
          <Section id="feedback" title="Feedback" description="Alerts, toasts, spinners.">
            <Card title="Alerts">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <Alert type="info" message="App Center analytics will be supported until June 2026." />
                <Alert type="success" message="Mapping file uploaded" description="Stacktraces will be deobfuscated automatically." />
                <Alert type="warning" message="Collection muted for version 16.0 (820)" />
                <Alert type="error" message="Failed to load crashes" description="Network error — please retry." action={<Button size="sm">Retry</Button>} />
              </div>
            </Card>
            <Row>
              <Card title="Toasts" style={{ flex: 1, minWidth: 280 }}>
                <Row>
                  <Button onClick={() => toast.success('Saved successfully')}>Success</Button>
                  <Button onClick={() => toast.error('Something went wrong')}>Error</Button>
                  <Button onClick={() => toast.info('Heads up')}>Info</Button>
                  <Button onClick={() => toast.warning('Be careful')}>Warning</Button>
                </Row>
              </Card>
              <Card title="Spinners" style={{ flex: 1, minWidth: 280 }}>
                <Row>
                  <Spinner size="sm" />
                  <Spinner size="md" />
                  <Spinner size="lg" />
                </Row>
              </Card>
            </Row>
          </Section>

          {/* Overlays */}
          <Section id="overlays" title="Overlays" description="Modal, drawer, tooltip, popconfirm, tabs.">
            <Card>
              <Row>
                <Button variant="primary" onClick={() => setModalOpen(true)}>Open modal</Button>
                <Button onClick={() => setDrawerOpen(true)}>Open drawer</Button>
                <Tooltip title="Deobfuscate stacktrace">
                  <Button icon={<Icons.IconInfo size={15} />}>Hover me</Button>
                </Tooltip>
                <Popconfirm
                  title="Delete this app?"
                  description="This action cannot be undone."
                  okDanger
                  okText="Delete"
                  onConfirm={() => toast.success('Deleted')}
                >
                  <Button variant="danger" icon={<Icons.IconTrash size={15} />}>Delete</Button>
                </Popconfirm>
              </Row>
              <Divider />
              <Tabs
                activeKey={tab}
                onChange={setTab}
                items={[
                  { key: 'overview', label: 'Overview', children: <Text type="secondary">Overview panel content.</Text> },
                  { key: 'threads', label: 'Threads', children: <Text type="secondary">Thread stacktraces here.</Text> },
                  { key: 'events', label: 'Events', children: <Text type="secondary">Breadcrumb events here.</Text> },
                ]}
              />
            </Card>
          </Section>

          {/* Charts */}
          <Section id="charts" title="Charts" description="Lightweight SVG — no chart library.">
            <Card
              title="Active users"
              extra={<Tag tone="primary">Last 28 days</Tag>}
            >
              <AreaChart data={areaData} height={240} />
            </Card>
            <Row>
              <Card title="Crashes per day" style={{ flex: 1, minWidth: 320 }}>
                <BarChart data={barData} color="var(--bnn-chart-3)" height={220} />
              </Card>
              <Card title="Sessions" style={{ flex: 1, minWidth: 320 }}>
                <LineChart data={areaData} color="var(--bnn-chart-2)" height={220} />
              </Card>
            </Row>
            <Card title="Top devices">
              <BarChart data={deviceData} horizontal height={200} />
            </Card>
          </Section>

          <div className="kit-footer">
            <Button size="sm" onClick={() => setLoading((l) => !l)}>
              Toggle table loading demo: {String(loading)}
            </Button>
            <Card title="Loading table" padded={false} style={{ marginTop: 12 }}>
              <Table<EventRow>
                columns={columns}
                data={eventRows}
                rowKey={(r) => r.name}
                loading={loading}
              />
            </Card>
          </div>
        </main>
      </div>

      {/* Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Create application"
        okText="Create"
        onOk={() => {
          setModalOpen(false)
          toast.success('Application created')
        }}
      >
        <Form>
          <FormItem label="Name" required>
            <Input placeholder="My app" />
          </FormItem>
          <FormItem label="Platform">
            <Select
              value="android"
              onChange={() => {}}
              options={[{ label: 'Android', value: 'android' }, { label: 'iOS', value: 'ios' }]}
            />
          </FormItem>
        </Form>
      </Modal>

      {/* Drawer */}
      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Filters"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => setDrawerOpen(false)}>Reset</Button>
            <Button variant="primary" onClick={() => setDrawerOpen(false)}>Apply</Button>
          </div>
        }
      >
        <Form>
          <FormItem label="Version">
            <Select value="all" onChange={() => {}} options={[{ label: 'All', value: 'all' }, { label: '16.0 (820)', value: '820' }]} />
          </FormItem>
          <FormItem label="Status">
            <RadioGroup value="open" onChange={() => {}} options={[{ label: 'Open', value: 'open' }, { label: 'Closed', value: 'closed' }]} />
          </FormItem>
        </Form>
      </Drawer>
    </div>
  )
}
