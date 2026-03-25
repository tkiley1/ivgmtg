'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function ProfileSettingsPage() {
  const supabase = createClient()
  const router = useRouter()
  const fileInput = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [username, setUsername] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [bio, setBio] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      setUserId(user.id)

      const { data: profile } = await supabase
        .from('profiles')
        .select('username, first_name, last_name, bio, avatar_url')
        .eq('id', user.id)
        .single()

      if (profile) {
        setUsername(profile.username)
        setFirstName(profile.first_name ?? '')
        setLastName(profile.last_name ?? '')
        setBio(profile.bio ?? '')
        setAvatarUrl(profile.avatar_url)
      }
      setLoading(false)
    }
    load()
  }, [])

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0] || !userId) return
    setUploading(true)
    setError('')

    const file = e.target.files[0]
    const ext = file.name.split('.').pop()
    const path = `${userId}/avatar.${ext}`

    const { error: uploadErr } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true })

    if (uploadErr) {
      setError(uploadErr.message)
      setUploading(false)
      return
    }

    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(path)

    // Append cache-buster so browser shows updated image
    const url = `${publicUrl}?t=${Date.now()}`

    await supabase
      .from('profiles')
      .update({ avatar_url: url })
      .eq('id', userId)

    setAvatarUrl(url)
    setUploading(false)
    setSuccess('Avatar updated!')
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSuccess('')

    const { error: err } = await supabase
      .from('profiles')
      .update({ first_name: firstName.trim() || null, last_name: lastName.trim() || null, bio })
      .eq('id', userId!)

    if (err) {
      setError(err.message)
    } else {
      setSuccess('Profile saved!')
    }
    setSaving(false)
  }

  if (loading) return <div className="max-w-2xl mx-auto px-4 py-8 text-muted">Loading...</div>

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Profile Settings</h1>

      {error && <div className="bg-danger/10 border border-danger/30 text-danger rounded-lg p-3 text-sm mb-4">{error}</div>}
      {success && <div className="bg-success/10 border border-success/30 text-success rounded-lg p-3 text-sm mb-4">{success}</div>}

      {/* Avatar */}
      <div className="card mb-6">
        <h2 className="text-lg font-bold mb-4">Profile Picture</h2>
        <div className="flex items-center gap-6">
          <div
            className="w-24 h-24 rounded-full bg-card-hover flex items-center justify-center overflow-hidden border-2 border-border cursor-pointer"
            onClick={() => fileInput.current?.click()}
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <span className="text-3xl font-bold text-accent">
                {username[0]?.toUpperCase() ?? '?'}
              </span>
            )}
          </div>
          <div>
            <button
              onClick={() => fileInput.current?.click()}
              disabled={uploading}
              className="btn-secondary text-sm"
            >
              {uploading ? 'Uploading...' : 'Upload Photo'}
            </button>
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              onChange={handleUpload}
              className="hidden"
            />
            <p className="text-xs text-muted mt-2">JPG, PNG, or GIF. Max 2MB.</p>
          </div>
        </div>
      </div>

      {/* Bio */}
      <form onSubmit={handleSave} className="card">
        <h2 className="text-lg font-bold mb-4">About You</h2>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm text-muted mb-1">First Name</label>
            <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} className="input" placeholder="John" />
          </div>
          <div>
            <label className="block text-sm text-muted mb-1">Last Name</label>
            <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} className="input" placeholder="Doe" />
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-sm text-muted mb-1">Username</label>
          <input type="text" value={username} className="input opacity-60" disabled />
          <p className="text-xs text-muted mt-1">Username cannot be changed.</p>
        </div>

        <div className="mb-4">
          <label className="block text-sm text-muted mb-1">Bio</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            className="input"
            rows={4}
            maxLength={500}
            placeholder="Tell other players about yourself..."
          />
          <p className="text-xs text-muted mt-1">{bio.length}/500</p>
        </div>

        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? 'Saving...' : 'Save Profile'}
        </button>
      </form>
    </div>
  )
}
