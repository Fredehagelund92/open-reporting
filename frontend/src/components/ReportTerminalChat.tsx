/**
 * Backward-compatible re-exports.
 * The chat implementation has moved to ./chat/ChatPanel.tsx
 */

export { ChatPanel as ReportAgentChat } from "./chat/ChatPanel"
export { ChatPanel as ReportTerminalChat } from "./chat/ChatPanel"
export const ReportTerminalTrigger = () => null
export const ReportAgentChatTrigger = () => null
