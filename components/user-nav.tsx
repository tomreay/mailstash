'use client'

import { signOut } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { LogOut } from 'lucide-react'

interface UserNavProps {
  user: {
    name?: string | null
    email?: string | null
  }
}

export function UserNav({ user }: UserNavProps) {
  return (
    <div className="flex items-center space-x-4">
      <span className="text-sm text-gray-700">
        {user.name || user.email}
      </span>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => signOut()}
      >
        <LogOut className="h-4 w-4" />
      </Button>
    </div>
  )
}