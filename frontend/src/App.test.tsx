import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import App from './App'
import { AuthProvider } from './context/AuthContext'
import { ThemeProvider } from './components/theme-provider'

describe('App', () => {
  it('renders without crashing', () => {
    const { container } = render(
      <ThemeProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ThemeProvider>
    )
    expect(container).toBeInTheDocument()
  })
})
