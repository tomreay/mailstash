import { AlertCircle, CheckCircle } from 'lucide-react'

interface MessageAlertProps {
  type: 'error' | 'success'
  message: string
  className?: string
}

export function MessageAlert({ type, message, className = '' }: MessageAlertProps) {
  const styles = {
    error: {
      container: 'bg-red-50 border-red-200',
      icon: <AlertCircle className="h-5 w-5 text-red-600" />,
      text: 'text-red-800'
    },
    success: {
      container: 'bg-green-50 border-green-200',
      icon: <CheckCircle className="h-5 w-5 text-green-600" />,
      text: 'text-green-800'
    }
  }

  const style = styles[type]

  return (
    <div className={`p-4 border rounded-lg flex items-center gap-2 ${style.container} ${className}`}>
      {style.icon}
      <p className={style.text}>{message}</p>
    </div>
  )
}