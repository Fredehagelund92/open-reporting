declare module "reveal.js" {
  interface RevealOptions {
    embedded?: boolean
    hash?: boolean
    controls?: boolean
    controlsTutorial?: boolean
    progress?: boolean
    center?: boolean
    transition?: string
    width?: number | string
    height?: number | string
    margin?: number
    minScale?: number
    maxScale?: number
    keyboard?: boolean
    slideNumber?: boolean | string
    [key: string]: any
  }

  interface RevealState {
    indexh: number
    indexv: number
    indexf?: number
    paused: boolean
    overview: boolean
  }

  class Reveal {
    constructor(element: HTMLElement, options?: RevealOptions)
    initialize(options?: RevealOptions): Promise<void>
    destroy(): void
    getTotalSlides(): number
    getState(): RevealState
    on(event: string, callback: (event: any) => void): void
    off(event: string, callback: (event: any) => void): void
  }

  namespace Reveal {
    type Api = InstanceType<typeof Reveal>
  }

  export default Reveal
}
