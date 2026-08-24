/* Bananalytics UI Kit — single entry point.
   Import components from '@/ui'. Styles are bundled here once. */

import './theme.css'
import './styles/primitives.css'
import './styles/layout.css'
import './styles/forms.css'
import './styles/overlays.css'

export {
  cn,
  Button,
  IconButton,
  Tag,
  Badge,
  Divider,
  Avatar,
  Spinner,
  Spin,
  Skeleton,
  SkeletonBlock,
  Statistic,
  Empty,
  Alert,
  Timeline,
  Title,
  Text,
} from './primitives'
export type { ButtonProps, TagTone, TimelineItem } from './primitives'

export { Card, Breadcrumb, TopBar, TopBarSeparator } from './Card'
export type { CardProps, BreadcrumbItem } from './Card'

export { NavMenu } from './nav'
export type { NavItem } from './nav'

export {
  Input,
  Password,
  Textarea,
  Select,
  Checkbox,
  Switch,
  RadioGroup,
  DatePicker,
  Form,
  FormItem,
  UploadDragger,
} from './forms'
export type {
  InputProps,
  SelectOption,
  SelectProps,
  RadioOption,
} from './forms'

export { Table, Descriptions } from './Table'
export type { Column, TableProps, TablePagination, DescItem } from './Table'

export {
  Modal,
  Drawer,
  Tooltip,
  Dropdown,
  Popconfirm,
  Tabs,
  Segmented,
} from './overlays'
export type { MenuItem, TabItem } from './overlays'

export { toast, message, ToastViewport } from './toast'

export { AreaChart, MultiAreaChart, LineChart, BarChart } from './charts'
export type { ChartPoint, ChartSeries } from './charts'

export { BarList } from './barlist'
export type { BarListItem } from './barlist'

export { WorldMap } from './geomap'
export type { WorldMapProps } from './geomap'

export * as Icons from './Icon'
