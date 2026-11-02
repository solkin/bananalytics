import './brand.css'

export const BRAND_NAME = 'Bananalytics'

/** Logo and name. */
export function Brand() {
  return (
    <span className="brand">
      <img src="/banana.svg" alt="" width="20" height="20" />
      {BRAND_NAME}
    </span>
  )
}
