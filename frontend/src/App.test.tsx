import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import App from './App'
import { AuthProvider } from './context/AuthContext'

describe('App', () => {
  it('renders without crashing', () => {
    const { container } = render(
      <AuthProvider>
        <App />
      </AuthProvider>
    )
    expect(container).toBeInTheDocument()
  })
})
