import { Link } from 'react-router-dom'
import './brand.css'

/** Logo mark in the top bar — same size and markup on every page. */
export function Brand() {
  return (
    <Link to="/" className="app-brand" aria-label="Bananalytics" title="Bananalytics">
      <img src="/banana.svg" width={30} height={30} alt="" />
    </Link>
  )
}
