import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/globals.css'

/**
 * React entry point — mounts the app into the #root div defined in index.html.
 * StrictMode is enabled to surface potential issues during development;
 * it has no effect on production builds.
 */
ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
