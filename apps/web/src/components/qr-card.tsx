import { CheckIcon, CopyIcon } from 'lucide-react'
import * as React from 'react'
import QRCode from 'react-qr-code'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface QrCardProps {
  code: string
}

export function joinUrl(code: string): string {
  return `${window.location.origin}${import.meta.env.BASE_URL}join/${code}`
}

export function QrCard({ code }: QrCardProps) {
  const [copiedCode, setCopiedCode] = React.useState(false)
  const [copiedLink, setCopiedLink] = React.useState(false)
  const url = joinUrl(code)

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopiedCode(true)
      window.setTimeout(() => setCopiedCode(false), 1500)
    } catch {
      // clipboard unavailable (e.g. http on LAN); the code is on screen anyway
    }
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopiedLink(true)
      window.setTimeout(() => setCopiedLink(false), 1500)
    } catch {
      // clipboard unavailable
    }
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="rounded-2xl bg-white p-4 shadow-lg">
        <QRCode value={url} size={176} bgColor="#ffffff" fgColor="#0c0c0f" />
      </div>
      <div className="text-center">
        <div className="flex items-center justify-center gap-1.5">
          <div className="font-mono text-4xl font-bold tracking-[0.3em] text-primary">{code}</div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={copiedCode ? 'Code copied' : 'Copy game code'}
            onClick={copyCode}
            className="shrink-0 text-muted-foreground hover:text-primary"
          >
            <span
              className={cn(
                'inline-flex transition-transform duration-200 ease-out',
                copiedCode ? 'scale-125' : 'scale-100',
              )}
            >
              {copiedCode ? (
                <CheckIcon className="size-4 text-emerald-400" />
              ) : (
                <CopyIcon className="size-4" />
              )}
            </span>
          </Button>
        </div>
        <div className="mt-1 text-xs text-muted-foreground">
          Scan the code or share the link. Friends without the app land in the web app.
        </div>
      </div>
      <Button variant="secondary" size="sm" onClick={copyLink}>
        {copiedLink ? <CheckIcon /> : <CopyIcon />}
        {copiedLink ? 'Copied' : 'Copy join link'}
      </Button>
    </div>
  )
}
