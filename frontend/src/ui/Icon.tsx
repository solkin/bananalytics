import type { SVGProps } from 'react'

/* Stroke icons on a 16px grid, drawn to match 13px text. Every icon is
   decorative unless the caller labels it. */

export type IconProps = SVGProps<SVGSVGElement> & { size?: number }

function icon(d: string) {
  return function Icon({ size = 16, ...rest }: IconProps) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
        {...rest}
      >
        <path d={d} />
      </svg>
    )
  }
}

export const IconSearch = icon('M7 12A5 5 0 1 0 7 2a5 5 0 0 0 0 10ZM14 14l-3.5-3.5')
export const IconChevronDown = icon('m4 6 4 4 4-4')
export const IconChevronLeft = icon('m10 3-5 5 5 5')
export const IconChevronRight = icon('m6 3 5 5-5 5')
export const IconClose = icon('m3.5 3.5 9 9M12.5 3.5l-9 9')
export const IconCheck = icon('m3 8.5 3.2 3.2L13 4.8')
export const IconPlus = icon('M8 3v10M3 8h10')
export const IconMenu = icon('M2.5 4h11M2.5 8h11M2.5 12h11')
export const IconCopy = icon('M6 5.5h6.5a1 1 0 0 1 1 1V13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6.5a1 1 0 0 1 1-1ZM11 5.5V3a1 1 0 0 0-1-1H3.5a1 1 0 0 0-1 1v6.5a1 1 0 0 0 1 1H5')
export const IconDownload = icon('M8 2.5v8M4.5 7.5 8 11l3.5-3.5M2.5 13.5h11')
export const IconUpload = icon('M8 11V3M4.5 6 8 2.5 11.5 6M2.5 13.5h11')
export const IconTrash = icon('M2.5 4.5h11M6 4.5V3a.75.75 0 0 1 .75-.75h2.5A.75.75 0 0 1 10 3v1.5M4 4.5l.6 8.3a1 1 0 0 0 1 .95h4.8a1 1 0 0 0 1-.95l.6-8.3')
export const IconReload = icon('M13.5 8A5.5 5.5 0 1 1 11.9 4.1M13.5 2.5v3h-3')
export const IconExternal = icon('M9.5 2.5h4v4M13.5 2.5 7.5 8.5M12.5 9.5v3a1 1 0 0 1-1 1h-8a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1h3')
export const IconSend = icon('M14 2 7 9M14 2 9.5 14 7 9 2 6.5 14 2Z')
export const IconLogout = icon('M6 13.5H3.5a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1H6M10.5 11 14 8l-3.5-3M14 8H6')
export const IconWarning = icon('M8 2.5 14 13H2L8 2.5ZM8 6.5v3M8 11.25v.01')
export const IconInfo = icon('M8 14A6 6 0 1 0 8 2a6 6 0 0 0 0 12ZM8 7.5V11M8 5.25v.01')
export const IconHelp = icon('M8 14A6 6 0 1 0 8 2a6 6 0 0 0 0 12ZM6.25 6.25a1.75 1.75 0 1 1 2.6 1.53c-.5.28-.85.67-.85 1.22M8 11.25v.01')
export const IconCircleCheck = icon('M8 14A6 6 0 1 0 8 2a6 6 0 0 0 0 12ZM5.5 8.2l1.8 1.8 3.2-3.6')
export const IconCircleOff = icon('M8 14A6 6 0 1 0 8 2a6 6 0 0 0 0 12ZM3.8 12.2l8.4-8.4')

/* Navigation */
export const IconBook = icon('M3 2.5h8.5A1.5 1.5 0 0 1 13 4v9.5H4.5A1.5 1.5 0 0 1 3 12V2.5ZM3 12a1.5 1.5 0 0 1 1.5-1.5H13')
export const IconOverview = icon('M2.5 13.5h11M4.5 11V8M8 11V4M11.5 11V6.5')
export const IconEvents = icon('M8.8 2 4 9h3.5l-.7 5 5-7.5H8.2L8.8 2Z')
export const IconDevices = icon('M5.5 1.75h5a1.25 1.25 0 0 1 1.25 1.25v10a1.25 1.25 0 0 1-1.25 1.25h-5A1.25 1.25 0 0 1 4.25 13V3A1.25 1.25 0 0 1 5.5 1.75ZM7 12h2')
export const IconIssues = icon('M8 14A6 6 0 1 0 8 2a6 6 0 0 0 0 12ZM8 5v3.5M8 10.9v.1')
export const IconMappings = icon('M2.5 5h9M9 2.5 11.5 5 9 7.5M13.5 11h-9M7 8.5 4.5 11 7 13.5')
export const IconReleases = icon('M8 1.75 13.5 4.5v7L8 14.25 2.5 11.5v-7L8 1.75ZM2.5 4.5 8 7.25l5.5-2.75M8 7.25v7')
export const IconGeneral = icon('M2.5 5h6M11.5 5h2M2.5 11h2M7.5 11h6M10 3.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3ZM6 9.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Z')
export const IconKey = icon('M10.5 2a3.5 3.5 0 1 1-1.2 6.8L8 10H6.5v1.5H5V13H2.5v-2.2l4.2-4.2A3.5 3.5 0 0 1 10.5 2ZM11 4.75v.01')
export const IconPeople = icon('M6 7.5A2.5 2.5 0 1 0 6 2.5a2.5 2.5 0 0 0 0 5ZM1.75 13.5c0-2.2 1.9-3.75 4.25-3.75s4.25 1.55 4.25 3.75M11 2.75a2.5 2.5 0 0 1 0 4.5M12 9.9c1.3.5 2.25 1.75 2.25 3.6')
