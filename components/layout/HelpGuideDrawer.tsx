'use client'

import { X, BookOpen } from 'lucide-react'

interface GuideSection {
  heading: string
  body: string
}

interface PageGuide {
  title: string
  summary: string
  sections: GuideSection[]
}

const GUIDES: Record<string, PageGuide> = {
  overview: {
    title: 'Overview',
    summary: 'A real-time snapshot of your bot\'s performance — conversations, leads, bookings, and channel activity.',
    sections: [
      {
        heading: 'Performance Snapshot',
        body: 'The top cards show key metrics for Today, 7 days, or 30 days: total conversations started, leads captured, WhatsApp messages, Telegram messages, confirmed bookings, pending bookings, follow-ups sent, and response rate.',
      },
      {
        heading: 'Summary Cards',
        body: 'Below the snapshot: Total Contacts (all unique users who have ever chatted), Messages Today, active Conversations, and Confirmed Bookings at a glance.',
      },
      {
        heading: 'Conversation Trend',
        body: 'A line/bar chart showing conversations by channel over time. Switch between Today, 7d, and 30d using the buttons top-right.',
      },
    ],
  },
  analytics: {
    title: 'Analytics',
    summary: 'Deep-dive metrics: message volume, channel breakdown, booking funnel, and follow-up performance.',
    sections: [
      {
        heading: 'Message Volume',
        body: 'Shows the number of messages your bot handled over the selected period. Useful for spotting peak days or low-engagement periods.',
      },
      {
        heading: 'Channel Breakdown',
        body: 'Donut chart showing the share of conversations from WhatsApp, Telegram, and Web Widget. Helps you understand where your audience is.',
      },
      {
        heading: 'Booking Funnel',
        body: 'Tracks how many users initiated a booking vs confirmed vs cancelled. If drop-off is high, review your booking flow in Flow Builder.',
      },
      {
        heading: 'Follow-up Gauge',
        body: 'Shows the percentage of conversations that received an automated follow-up and the open/response rate.',
      },
    ],
  },
  conversations: {
    title: 'Conversations',
    summary: 'View and manage all incoming conversations across every channel in one inbox.',
    sections: [
      {
        heading: 'Inbox & Filters',
        body: 'Use the All / Open / Closed tabs to filter conversations by status. Filter by channel (WA, TG, Web) using the icons above the list. Search contacts by name or number.',
      },
      {
        heading: 'Reading a Conversation',
        body: 'Click any conversation to open the full message thread. The AI summary (if enabled) appears at the top. You can see which language was detected and the channel used.',
      },
      {
        heading: 'Taking Over',
        body: 'Click "Take Over" to pause the AI and reply manually. The bot will not respond while you are in control. Click "Resolve" when done — the bot resumes for future messages from that contact.',
      },
      {
        heading: 'Summarise',
        body: 'Click "Summarise" to generate an AI summary of the conversation thread. Useful for quickly understanding long exchanges before responding.',
      },
    ],
  },
  contacts: {
    title: 'Contacts',
    summary: 'Your CRM — every user who has ever messaged your bot, with notes, tags, and history.',
    sections: [
      {
        heading: 'Contact List',
        body: 'All contacts are listed with name, phone/channel, last seen, and status. Click any row to open the contact profile sheet.',
      },
      {
        heading: 'Contact Profile',
        body: 'Shows the full conversation history, booking history, notes, and any custom fields captured. You can edit the contact\'s name, phone, and add internal notes.',
      },
      {
        heading: 'Import',
        body: 'Use the Import button to upload a CSV of existing contacts. Map columns to fields: name, phone, email, and custom tags.',
      },
      {
        heading: 'Kanban View',
        body: 'Switch to Kanban to see contacts by stage (new, qualified, booked, closed). Drag cards between stages to update their status.',
      },
    ],
  },
  broadcasts: {
    title: 'Broadcasts',
    summary: 'Send bulk messages to all contacts or a filtered segment via WhatsApp or Telegram.',
    sections: [
      {
        heading: 'Creating a Broadcast',
        body: 'Click "+ New Broadcast", write your message, select the target channel, and optionally filter by contact tag or date range. Preview the message before sending.',
      },
      {
        heading: 'Scheduling',
        body: 'You can send immediately or schedule for a future date/time. Scheduled broadcasts appear in the list with a "Scheduled" status badge.',
      },
      {
        heading: 'Delivery Report',
        body: 'After sending, click a broadcast to see per-contact delivery status: Sent, Delivered, Read, Failed. Failed contacts can be retried.',
      },
    ],
  },
  followups: {
    title: 'Follow-ups',
    summary: 'Automated reminder messages sent to contacts who haven\'t responded or have pending bookings.',
    sections: [
      {
        heading: 'What triggers a follow-up?',
        body: 'Follow-ups fire when a contact has an open conversation with no reply for a configured duration, or when a booking is approaching and a reminder is due.',
      },
      {
        heading: 'Follow-up Log',
        body: 'The list shows every follow-up sent: contact, trigger reason, message preview, sent time, and whether the contact responded.',
      },
      {
        heading: 'Configuration',
        body: 'To configure follow-up timing and messages, go to Personality > Follow-ups settings. You can set the delay (e.g. 24 hours) and customise the message template.',
      },
    ],
  },
  scripts: {
    title: 'Flow Builder',
    summary: 'Build automated conversation flows using a visual drag-and-drop canvas.',
    sections: [
      {
        heading: 'Canvas',
        body: 'Each flow is a directed graph. Drag nodes from the left panel onto the canvas. Connect nodes by dragging from an output handle to an input handle.',
      },
      {
        heading: 'Node Types',
        body: 'Message (send text), Question (collect input), Condition (branch by answer), AI Response (let the bot answer freely), API Call (fetch live data), Booking (start booking flow), Lead Capture (save contact info), Delay (wait before next step), Handoff (transfer to human).',
      },
      {
        heading: 'AI Generate',
        body: 'Click "AI Generate" and describe the flow you want in plain text. The AI will scaffold a starter flow that you can then edit.',
      },
      {
        heading: 'Preview',
        body: 'Use the Preview panel to simulate a conversation through the flow before activating it.',
      },
    ],
  },
  knowledge: {
    title: 'Knowledge Base',
    summary: 'Upload documents and web pages that your bot uses to answer questions accurately.',
    sections: [
      {
        heading: 'Uploading Documents',
        body: 'Click "+ Add Document" to upload PDF, DOCX, TXT, or CSV files. The system extracts the text, splits it into chunks, and embeds them for semantic search. Large files may take a minute to process.',
      },
      {
        heading: 'Adding URLs',
        body: 'Click "+ Add URL" to scrape a web page. The bot will use the scraped content to answer questions. Only publicly accessible pages work.',
      },
      {
        heading: 'Document Status',
        body: 'Each document shows a status: Processing, Ready, or Error. The bot only uses Ready documents. Click a document to preview its extracted text.',
      },
      {
        heading: 'How it works',
        body: 'When a user asks a question, the bot searches your knowledge base for the most relevant chunks and uses them to generate an accurate answer. It will not make up information that isn\'t in the knowledge base (if Fact Grounding is on).',
      },
    ],
  },
  faqs: {
    title: 'FAQs',
    summary: 'Pre-written question-and-answer pairs the bot uses for fast, exact responses.',
    sections: [
      {
        heading: 'Adding FAQs',
        body: 'Click "+ Add FAQ". Enter a question and the exact answer you want the bot to give. Add alternative phrasings (variations) so the bot matches more user inputs.',
      },
      {
        heading: 'FAQ vs Knowledge Base',
        body: 'FAQs are for predictable, exact questions (opening hours, pricing, address). The Knowledge Base is for unstructured questions that require searching through documents.',
      },
      {
        heading: 'Priority',
        body: 'If a user\'s message closely matches an FAQ, the FAQ answer is used directly without calling the AI. This is faster and more consistent.',
      },
    ],
  },
  personality: {
    title: 'Personality',
    summary: 'Define who your bot is — its name, role, tone, language, and how it introduces itself.',
    sections: [
      {
        heading: 'System Prompt',
        body: 'The core instruction given to the AI. Write in plain English: describe the bot\'s role, what it knows, how it should behave, and any important rules. Example: "You are Ethan, a wellness consultant for Elken Malaysia. You help users learn about GenQi products and book sessions."',
      },
      {
        heading: 'Tone Settings',
        body: 'Toggle Formal (professional language), Verbose (detailed answers), and Emoji (allow emoji in responses). These modify the system prompt automatically.',
      },
      {
        heading: 'Language',
        body: 'Set the default language (EN/BM/ZH). Enable Language Lock to force the bot to always reply in the default language regardless of what language the user writes in.',
      },
      {
        heading: 'Response Length',
        body: 'Set minimum and maximum word counts for responses. Short answers (20–80 words) feel more conversational. Longer (80–200) are better for detailed product info.',
      },
    ],
  },
  guardrails: {
    title: 'Guardrails',
    summary: 'Control what topics the bot will and won\'t discuss, and add safety disclaimers.',
    sections: [
      {
        heading: 'In-Scope Topics',
        body: 'List the topics your bot should help with. Example: "product information, booking appointments, operating hours". The bot will politely decline questions outside this scope.',
      },
      {
        heading: 'Important Rules',
        body: 'Add hard rules the bot must always follow. Example: "Never give medical advice", "Always recommend consulting a doctor for health concerns".',
      },
      {
        heading: 'Fact Grounding',
        body: 'When enabled, the bot will only state facts found in the knowledge base or conversation. It will say "I\'m not sure" rather than guessing.',
      },
      {
        heading: 'Hallucination Guard',
        body: 'Prevents the bot from making up URLs, phone numbers, prices, or dates. Always keep this on for business bots.',
      },
    ],
  },
  templates: {
    title: 'Templates',
    summary: 'Pre-built message templates for broadcasts, follow-ups, and booking notifications.',
    sections: [
      {
        heading: 'Using Templates',
        body: 'Templates appear as options when creating broadcasts or configuring follow-up messages. Select a template to pre-fill the message editor.',
      },
      {
        heading: 'Creating Templates',
        body: 'Click "+ New Template". Give it a name, category (Broadcast, Follow-up, Booking), and write the message. Use {{name}}, {{date}}, {{service}} as placeholders — they are replaced automatically.',
      },
      {
        heading: 'WhatsApp Templates',
        body: 'For WhatsApp, message templates must be pre-approved by Meta. Submit them through your WhatsApp Business Account. Once approved, import them here.',
      },
    ],
  },
  booking: {
    title: 'Booking',
    summary: 'Manage appointments, view bookings, configure services and availability.',
    sections: [
      {
        heading: 'Bookings List',
        body: 'All bookings captured through the bot appear here with status: Pending, Confirmed, Cancelled, or Trial Pending. Filter by date range or status.',
      },
      {
        heading: 'Services',
        body: 'Go to the Services tab to define what can be booked — name, duration, price, and availability. The bot uses these to offer options during the booking flow.',
      },
      {
        heading: 'Settings',
        body: 'Configure booking type (Appointment / Table / Property Viewing), operating hours, advance booking window, and cancellation policy.',
      },
      {
        heading: 'Manual Booking',
        body: 'Click "+ New Booking" to create a booking manually on behalf of a customer — useful when bookings come through a phone call or walk-in.',
      },
    ],
  },
  channels: {
    title: 'Channels',
    summary: 'Connect your bot to WhatsApp, Telegram, and other messaging platforms.',
    sections: [
      {
        heading: 'WhatsApp',
        body: 'Click "Connect WhatsApp". Enter your WhatsApp Business API access token and phone number ID from Meta Business Manager. Once connected, all messages to that number route through this bot.',
      },
      {
        heading: 'Telegram',
        body: 'Click "Connect Telegram". Paste your Telegram Bot Token (from @BotFather). The webhook is registered automatically. Test by messaging your Telegram bot directly.',
      },
      {
        heading: 'Channel Status',
        body: 'Each channel shows Live (receiving messages), Disconnected, or Error. If a channel shows Error, check the token is still valid — WhatsApp tokens expire periodically.',
      },
    ],
  },
  widget: {
    title: 'Web Widget',
    summary: 'Embed a chat widget on your website so visitors can chat with your bot directly.',
    sections: [
      {
        heading: 'Getting the Embed Code',
        body: 'Copy the script tag shown on this page and paste it before the </body> tag of your website. The widget appears immediately.',
      },
      {
        heading: 'Customisation',
        body: 'Set the widget colour, greeting message, bot avatar, and position (bottom-left or bottom-right). Changes apply in real time — no code change needed.',
      },
      {
        heading: 'Allowed Domains',
        body: 'Add your website domain(s) to the allowlist to prevent the widget being used on unauthorised sites.',
      },
    ],
  },
  integrations: {
    title: 'Integrations',
    summary: 'Connect IceBot to third-party tools: CRMs, calendars, payment gateways, and more.',
    sections: [
      {
        heading: 'Available Integrations',
        body: 'Browse the integration catalogue. Each integration shows what data it syncs and what permissions it needs.',
      },
      {
        heading: 'Connecting',
        body: 'Click an integration card and follow the OAuth flow or paste your API credentials. Once connected, data syncs automatically based on triggers (new contact, new booking, etc.).',
      },
      {
        heading: 'Webhooks',
        body: 'Use the Webhook integration to send events to any custom endpoint. Configure which events to send (message received, booking created, lead captured).',
      },
    ],
  },
  testing: {
    title: 'Testing Console',
    summary: 'Chat with your bot in a sandbox environment and inspect every step of the AI pipeline.',
    sections: [
      {
        heading: 'Chat Interface',
        body: 'Type messages in the chat panel on the left. The bot responds exactly as it would on a live channel — same knowledge base, same personality, same guardrails.',
      },
      {
        heading: 'Pipeline Inspector',
        body: 'The right panel shows every step the AI took: intent detection, guardrails check, FAQ match, knowledge retrieval, prompt construction, and the final LLM response. Each step shows pass/skip/block and duration.',
      },
      {
        heading: 'Debugging',
        body: 'If the bot gives an unexpected answer, check which step produced it. A "block" in Guardrails means the topic was out of scope. A "skip" in FAQ means no match was found. A low-confidence RAG chunk may indicate a knowledge gap.',
      },
    ],
  },
  'api-keys': {
    title: 'API Keys',
    summary: 'Create and manage API keys to integrate IceBot into your own applications.',
    sections: [
      {
        heading: 'Creating a Key',
        body: 'Click "+ New API Key". Give it a descriptive name (e.g. "Mobile App", "Zapier"). The key is shown once — copy it immediately and store it securely.',
      },
      {
        heading: 'Using the API',
        body: 'Pass the key in the Authorization header: Authorization: Bearer <your-key>. Use it to send messages to the bot, retrieve conversations, and access contact data programmatically.',
      },
      {
        heading: 'Revoking Keys',
        body: 'Click the revoke button next to any key to invalidate it immediately. Revoked keys cannot be recovered — create a new key if needed.',
      },
    ],
  },
  settings: {
    title: 'Settings',
    summary: 'Bot-level configuration: name, description, status, and danger zone.',
    sections: [
      {
        heading: 'Bot Details',
        body: 'Update your bot\'s display name, description, and avatar. These appear in the dashboard and in the Web Widget header.',
      },
      {
        heading: 'Bot Status',
        body: 'Toggle the bot between Active and Paused. When paused, the bot stops responding to all incoming messages across all channels.',
      },
      {
        heading: 'Danger Zone',
        body: 'Permanently delete this bot and all its data (conversations, contacts, knowledge, bookings). This cannot be undone. You will be asked to type the bot name to confirm.',
      },
    ],
  },
  dashboard: {
    title: 'Dashboard',
    summary: 'Your tenant-level home — a summary across all your bots.',
    sections: [
      {
        heading: 'Summary Cards',
        body: 'Total Contacts, Messages Today, This Week activity, and Active Bots across your entire account — not scoped to a single bot.',
      },
      {
        heading: 'Recent Conversations',
        body: 'The latest conversations across all bots, so you can jump quickly to anything that needs attention.',
      },
      {
        heading: 'Quick Actions',
        body: 'Shortcuts to the most common tasks: Add Knowledge, Build Flow, Connect Channel, and New Bot.',
      },
    ],
  },
}

function getGuideKey(pathname: string): string {
  // Global dashboard
  if (pathname === '/dashboard/overview') return 'dashboard'
  // Bot sub-pages: last segment
  const last = pathname.split('/').filter(Boolean).pop() ?? ''
  return last
}

interface HelpGuideDrawerProps {
  isOpen: boolean
  onClose: () => void
  pathname: string
}

export function HelpGuideDrawer({ isOpen, onClose, pathname }: HelpGuideDrawerProps) {
  const key = getGuideKey(pathname)
  const guide = GUIDES[key]

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          style={{ background: 'rgba(0,0,0,0.4)' }}
          onClick={onClose}
        />
      )}

      {/* Drawer */}
      <aside
        className="fixed top-0 right-0 h-full z-50 flex flex-col overflow-hidden transition-transform duration-200"
        style={{
          width: 360,
          background: 'var(--bb-surface)',
          borderLeft: '1px solid var(--bb-border)',
          transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--bb-border)' }}
        >
          <div className="flex items-center gap-2">
            <BookOpen size={16} style={{ color: 'var(--bb-primary)' }} />
            <span className="text-sm font-semibold" style={{ color: 'var(--bb-text-1)' }}>
              Page Guide
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
            style={{ color: 'var(--bb-text-3)' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bb-surface-3)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
          {guide ? (
            <>
              <div>
                <h2 className="text-base font-semibold mb-1" style={{ color: 'var(--bb-text-1)' }}>
                  {guide.title}
                </h2>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--bb-text-2)' }}>
                  {guide.summary}
                </p>
              </div>

              {guide.sections.map((section) => (
                <div key={section.heading}>
                  <h3
                    className="text-xs font-semibold uppercase tracking-wider mb-2"
                    style={{ color: 'var(--bb-primary)' }}
                  >
                    {section.heading}
                  </h3>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--bb-text-2)' }}>
                    {section.body}
                  </p>
                </div>
              ))}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
              <BookOpen size={32} style={{ color: 'var(--bb-text-3)' }} />
              <p className="text-sm" style={{ color: 'var(--bb-text-3)' }}>
                No guide available for this page yet.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="px-5 py-3 flex-shrink-0"
          style={{ borderTop: '1px solid var(--bb-border)' }}
        >
          <p className="text-xs" style={{ color: 'var(--bb-text-3)' }}>
            Need more help? Contact support at{' '}
            <span style={{ color: 'var(--bb-primary)' }}>support@icebot.ai</span>
          </p>
        </div>
      </aside>
    </>
  )
}
