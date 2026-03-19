import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import App from './App'
import './styles/globals.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <App />
    <Toaster position="bottom-right" toastOptions={{
      style: { background:'#1e293b', color:'#f8fafc', borderRadius:'10px', fontSize:'13px' },
      success: { iconTheme: { primary:'#10b981', secondary:'#fff' } },
      error:   { iconTheme: { primary:'#ef4444', secondary:'#fff' } },
    }} />
  </BrowserRouter>
)
