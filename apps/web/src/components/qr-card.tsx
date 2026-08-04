import { CheckIcon, CopyIcon } from 'lucide-react'
import * as React from 'react'
import QRCode from 'react-qr-code'
import { Button } from '@/components/ui/button'

interface QrCardProps {
  code: string
}

export function joinUrl(code: string): string {
  return `${window.location.origin}${import.meta.env.BASE_URL}join/${code}`
}

export function QrCard({ code }: QrCardProps) {
  const [copied, setCopied] = React.useState(false)
  const url = joinUrl(code)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // clipboard unavailable (e.g. http on LAN); the code is on screen anyway
    }
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="rounded-2xl bg-white p-4 shadow-lg">
        <QRCode value={url} size={176} bgColor="#ffffff" fgColor="#0c0c0f" />
      </div>
      <div className="text-center">
        <div className="font-mono text-4xl font-bold tracking-[0.3em] text-primary">{code}</div>
        <div className="mt-1 text-xs text-muted-foreground">
          Scan the code or share the link. Friends without the app land in the web app.
        </div>
      </div>
      <Button variant="secondary" size="sm" onClick={copy}>
        {copied ? <CheckIcon /> : <CopyIcon />}
        {copied ? 'Copied' : 'Copy join link'}
      </Button>
    </div>
  )
}
