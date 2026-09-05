import { useState } from 'react'
import { X, Mail, Lock, LogIn, UserPlus, AlertCircle, CheckCircle2 } from 'lucide-react'
import { signInUser, signUpUser } from '../lib/supabase'

export default function AuthModal({ isOpen, onClose, onAuthSuccess }) {
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  if (!isOpen) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setMessage('')
    setLoading(true)

    try {
      if (isSignUp) {
        await signUpUser(email, password)
        setMessage('สมัครสมาชิกสำเร็จ! โปรดตรวจสอบอีเมลเพื่อยืนยันตัวตน หรือทดลองเข้าสู่ระบบ')
        setIsSignUp(false)
      } else {
        const data = await signInUser(email, password)
        if (data?.user) {
          onAuthSuccess(data.user)
          onClose()
        }
      }
    } catch (err) {
      let errMsg = err.message || 'เกิดข้อผิดพลาด โปรดลองอีกครั้ง'
      if (errMsg.includes('rate limit') || err.status === 429 || errMsg.includes('over_email_send_rate_limit')) {
        errMsg = 'ส่งอีเมลเกินขีดจำกัดชั่วคราว (Rate limit exceeded) โปรดลองกด "เข้าสู่ระบบ" โดยตรง หรือปิด "Confirm email" ใน Supabase Dashboard'
      } else if (errMsg.includes('Invalid login credentials')) {
        errMsg = 'อีเมลหรือรหัสผ่านไม่ถูกต้อง'
      } else if (errMsg.includes('User already registered')) {
        errMsg = 'อีเมลนี้ถูกลงทะเบียนไว้แล้ว โปรดกดเข้าสู่ระบบ'
      }
      setError(errMsg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content fade-in" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="ปิด">
          <X size={20} />
        </button>

        <div className="modal-header">
          <div className="modal-badge">
            <Lock size={22} />
          </div>
          <h2>{isSignUp ? 'สมัครสมาชิก Supabase' : 'เข้าสู่ระบบ Cloud Sync'}</h2>
          <p>{isSignUp ? 'สร้างบัญชีเพื่อบันทึกข้อมูลอ่านหนังสือออนไลน์' : 'เชื่อมต่อบัญชีเพื่อใช้งานและซิงค์ข้อมูลบน Cloud'}</p>
        </div>

        {error && (
          <div className="auth-alert error">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        {message && (
          <div className="auth-alert success">
            <CheckCircle2 size={18} />
            <span>{message}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="input-group">
            <label htmlFor="auth-email">อีเมล</label>
            <div className="input-wrapper">
              <Mail size={18} />
              <input
                id="auth-email"
                type="email"
                required
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="input-group">
            <label htmlFor="auth-password">รหัสผ่าน</label>
            <div className="input-wrapper">
              <Lock size={18} />
              <input
                id="auth-password"
                type="password"
                required
                minLength={6}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <button type="submit" className="primary-button full-width" disabled={loading}>
            {loading ? (
              'กำลังดำเนินการ...'
            ) : isSignUp ? (
              <>
                <UserPlus size={18} /> สมัครสมาชิก
              </>
            ) : (
              <>
                <LogIn size={18} /> เข้าสู่ระบบ
              </>
            )}
          </button>
        </form>

        <div className="modal-footer">
          <p>
            {isSignUp ? 'มีบัญชีอยู่แล้ว?' : 'ยังไม่มีบัญชี?'}
            <button
              type="button"
              className="link-button"
              onClick={() => {
                setIsSignUp(!isSignUp)
                setError('')
                setMessage('')
              }}
            >
              {isSignUp ? 'เข้าสู่ระบบ' : 'สมัครสมาชิกใหม่'}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
