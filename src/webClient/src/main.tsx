import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
import { bootstrapAuthFromUrl } from './api/auth'
import './styles/globals.css'

// Capture ?token=… from the URL (set by the QR code) and stash it before any
// component mounts and tries to fetch.
bootstrapAuthFromUrl()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
