import { ArrowLeftIcon, ChartColumnIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function StatsPage() {
  return (
    <div className="grid gap-4">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="icon-sm">
          <Link to="/">
            <ArrowLeftIcon />
          </Link>
        </Button>
        <h1 className="text-lg font-semibold">Stats</h1>
      </div>

      <Card>
        <CardHeader className="items-center pb-3 text-center">
          <span className="mb-2 flex size-12 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <ChartColumnIcon className="size-6" />
          </span>
          <CardTitle>Coming soon</CardTitle>
          <CardDescription>
            Richer reports — streaks, balance charts, head-to-heads — will land here.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center pb-6">
          <Button asChild variant="secondary">
            <Link to="/history">Browse history for now</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
