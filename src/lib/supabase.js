import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY')
}

export const supabase = createClient(supabaseUrl, supabasePublishableKey)

// Auth Helpers
export async function signUpUser(email, password) {
  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) throw error
  return data
}

export async function signInUser(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export async function signOutUser() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

// Database Helpers - Study Tasks
export async function fetchTasksByWeek(userId, weekNumber) {
  const { data, error } = await supabase
    .from('study_tasks')
    .select('*')
    .eq('user_id', userId)
    .eq('week_number', weekNumber)

  if (error) throw error
  return data
}

export async function saveTaskToDb(userId, weekNumber, dayName, task) {
  const taskPayload = {
    user_id: userId,
    week_number: weekNumber,
    day_name: dayName,
    title: task.text || '',
    subject: task.subject || '',
    duration_hours: Number(task.duration) || 0,
    completed: Boolean(task.completed)
  }

  // If task has a numeric DB primary key (bigint ID from Supabase)
  if (typeof task.dbId === 'number') {
    const { data, error } = await supabase
      .from('study_tasks')
      .update(taskPayload)
      .eq('id', task.dbId)
      .select()
      .single()
    if (error) throw error
    return data
  } else {
    // Insert new task
    const { data, error } = await supabase
      .from('study_tasks')
      .insert([taskPayload])
      .select()
      .single()
    if (error) throw error
    return data
  }
}

export async function deleteTaskFromDb(dbId) {
  if (typeof dbId === 'number') {
    const { error } = await supabase
      .from('study_tasks')
      .delete()
      .eq('id', dbId)
    if (error) throw error
  }
}

// Database Helpers - Schedule Templates
export async function fetchScheduleFromDb(userId) {
  const { data, error } = await supabase
    .from('schedule_templates')
    .select('*')
    .eq('user_id', userId)
    .order('row_number', { ascending: true })

  if (error) throw error
  return data
}

export async function saveScheduleToDb(userId, scheduleMatrix) {
  const rows = scheduleMatrix.map((row, index) => ({
    user_id: userId,
    row_number: index + 1,
    time_label: row[0] || '',
    monday: row[1] || '',
    tuesday: row[2] || '',
    wednesday: row[3] || '',
    thursday: row[4] || '',
    friday: row[5] || '',
    saturday: row[6] || '',
    sunday: row[7] || '',
    updated_at: new Date().toISOString()
  }))

  const { data, error } = await supabase
    .from('schedule_templates')
    .upsert(rows, { onConflict: 'user_id, row_number' })

  if (error) throw error
  return data
}