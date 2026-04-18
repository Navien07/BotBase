import { notFound } from 'next/navigation'
import { DR_AIMAN_BOT_ID } from '@/lib/tenants/dr-aiman/media-triggers/config'
import { MediaTriggersView } from '@/components/tenants/dr-aiman/MediaTriggersView'

export default async function MediaTriggersPage({
  params,
}: {
  params: Promise<{ botId: string }>
}) {
  const { botId } = await params
  if (botId !== DR_AIMAN_BOT_ID) notFound()
  return <MediaTriggersView botId={botId} />
}
