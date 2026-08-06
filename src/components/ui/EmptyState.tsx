export function EmptyState({ message }: { message: string }) {
  return (
    <div data-testid="empty-state" className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center text-sm text-gray-500">
      {message}
    </div>
  )
}
