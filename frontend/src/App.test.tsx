import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import App from './App'
import { AuthProvider } from './context/AuthContext'
import { BrowserRouter } from 'react-router-dom'

describe('App', () => {
  it('renders without crashing', () => {
    // The App requires AuthProvider and a minimal Router setup
    const { container } = render(
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    )
    expect(container).toBeInTheDocument()
  })
})
