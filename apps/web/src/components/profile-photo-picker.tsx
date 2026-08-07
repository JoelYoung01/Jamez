import * as React from 'react'
import { ImagePlus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { downscaleImageFile } from '@/lib/avatar-image'
import { cn } from '@/lib/utils'

interface ProfilePhotoPickerProps {
  emoji: string
  photo: string | undefined
  onChange: (photo: string | undefined) => void
  className?: string
}

export function ProfilePhotoPicker({ emoji, photo, onChange, className }: ProfilePhotoPickerProps) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [busy, setBusy] = React.useState(false)

  const onFile = async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    try {
      onChange(await downscaleImageFile(file))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not use that photo')
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div className="flex size-14 items-center justify-center overflow-hidden rounded-full bg-secondary text-2xl ring-2 ring-border">
        {photo ? (
          <img src={photo} alt="" className="size-full object-cover" draggable={false} />
        ) : (
          <span aria-hidden>{emoji}</span>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => void onFile(e.target.files?.[0])}
        />
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          <ImagePlus className="size-4" />
          {photo ? 'Change photo' : 'Add photo'}
        </Button>
        {photo && (
          <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => onChange(undefined)}>
            <Trash2 className="size-4" />
            Remove
          </Button>
        )}
      </div>
    </div>
  )
}
