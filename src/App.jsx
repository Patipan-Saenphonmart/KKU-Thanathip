import { useEffect, useMemo, useState, useCallback } from 'react'
import { BarChart3, BookOpen, CalendarDays, Check, CheckSquare, ChevronDown, Clock3, Cloud, Info, Pencil, Plus, Save, Target, Trash2, LogIn, LogOut, RefreshCw, AlertTriangle } from 'lucide-react'
import './App.css'
import { supabase, signOutUser, fetchTasksByWeek, saveTaskToDb, deleteTaskFromDb, fetchScheduleFromDb, saveScheduleToDb } from './lib/supabase'
import AuthModal from './components/AuthModal'

const SUBJECTS = ['คณิตศาสตร์', 'ฟิสิกส์', 'เคมี', 'ชีวะ', 'ภาษาอังกฤษ', 'ภาษาไทย', 'สังคมศึกษา', 'TPAT1 (กสพท)', 'TGAT', 'NETSAT (รวม)', 'อื่นๆ']
const DAYS = ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์', 'อาทิตย์']
const DURATIONS = [0, .5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5]
const task = (id) => ({ id, text: '', subject: '', duration: 0, completed: false })
const blankWeek = () => Object.fromEntries(DAYS.map((day) => [day, [task(1), task(2)]]))
const scheduleSeed = [
  ['17:30 - 18:30', 'คณิต (ทำโจทย์)', 'ฟิสิกส์ (เรียน/ทวน)', 'คณิต (ทำโจทย์)', 'เคมี (ทำโจทย์)', 'อังกฤษ (Reading)', 'ชีวะ (เรียนคอร์ส)', 'ฟิสิกส์ (ทำโจทย์)'],
  ['18:30 - 19:30', 'คณิต (ทำโจทย์)', 'ฟิสิกส์ (เรียน/ทวน)', 'คณิต (ทำโจทย์)', 'เคมี (ทำโจทย์)', 'อังกฤษ (ตะลุยโจทย์)', 'ชีวะ (เรียนคอร์ส)', 'ฟิสิกส์ (ทำโจทย์)'],
  ['19:30 - 20:30', 'พักผ่อน / กินข้าว', 'พักผ่อน / กินข้าว', 'พักผ่อน / กินข้าว', 'พักผ่อน / กินข้าว', 'พักผ่อน / กินข้าว', 'พักผ่อน / กินข้าว', 'พักผ่อน / กินข้าว'],
  ['20:30 - 21:30', 'เคมี (ทวนเนื้อหา)', 'ชีวะ (เรียนคอร์ส)', 'อังกฤษ (Reading)', 'ชีวะ (เรียนคอร์ส)', 'คณิต (ทำโจทย์)', 'คณิต (ทำโจทย์รวม)', 'เคมี (ทำโจทย์)'],
  ['21:30 - 22:30', 'อังกฤษ (ท่องศัพท์)', 'ชีวะ (เรียนคอร์ส)', 'ฟิสิกส์ (ทำโจทย์)', 'ชีวะ (เรียนคอร์ส)', 'ทบทวนรวม', 'อังกฤษ (TGAT)', 'จัดตารางสัปดาห์หน้า'],
]

export default function App() {
  const [user, setUser] = useState(null)
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [dbError, setDbError] = useState(null)

  const [tab, setTab] = useState('overview')
  const [week, setWeek] = useState(1)
  const [tracker, setTracker] = useState(() => JSON.parse(localStorage.getItem('tracker-1') || 'null') || blankWeek())
  const [schedule, setSchedule] = useState(() => JSON.parse(localStorage.getItem('schedule') || 'null') || scheduleSeed)
  const [editing, setEditing] = useState(false)

  // Listen to Supabase Auth State Change
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Load tracker tasks for current week from Supabase or LocalStorage
  const loadWeekData = useCallback(async (targetWeek, currentUser) => {
    if (currentUser) {
      setSyncing(true)
      try {
        const dbTasks = await fetchTasksByWeek(currentUser.id, targetWeek)
        setDbError(null)
        if (dbTasks && dbTasks.length > 0) {
          const newTracker = Object.fromEntries(DAYS.map(day => [day, []]))
          dbTasks.forEach(item => {
            if (newTracker[item.day_name]) {
              newTracker[item.day_name].push({
                id: item.id,
                dbId: item.id,
                text: item.title || '',
                subject: item.subject || '',
                duration: Number(item.duration_hours) || 0,
                completed: Boolean(item.completed)
              })
            }
          })
          // Fill empty days with blank tasks if needed
          DAYS.forEach(day => {
            if (!newTracker[day] || newTracker[day].length === 0) {
              newTracker[day] = [task(1), task(2)]
            }
          })
          setTracker(newTracker)
          localStorage.setItem(`tracker-${targetWeek}`, JSON.stringify(newTracker))
        } else {
          // If no tasks in DB, load local or blank
          const local = JSON.parse(localStorage.getItem(`tracker-${targetWeek}`) || 'null') || blankWeek()
          setTracker(local)
        }
      } catch (err) {
        console.error('Failed to fetch tasks from Supabase:', err)
        if (err.code === '42P01' || err.message?.includes('relation') || err.message?.includes('does not exist')) {
          setDbError('ยังไม่ได้รันไฟล์ schema.sql ใน Supabase SQL Editor (ไม่พบตาราง study_tasks)')
        } else {
          setDbError(err.message || 'เกิดข้อผิดพลาดในการดึงข้อมูลจาก Supabase')
        }
        const local = JSON.parse(localStorage.getItem(`tracker-${targetWeek}`) || 'null') || blankWeek()
        setTracker(local)
      } finally {
        setSyncing(false)
      }
    } else {
      const local = JSON.parse(localStorage.getItem(`tracker-${targetWeek}`) || 'null') || blankWeek()
      setTracker(local)
      setDbError(null)
    }
  }, [])

  // Load schedule from Supabase or LocalStorage
  const loadScheduleData = useCallback(async (currentUser) => {
    if (currentUser) {
      try {
        const dbRows = await fetchScheduleFromDb(currentUser.id)
        if (dbRows && dbRows.length > 0) {
          const matrix = dbRows.map(r => [
            r.time_label,
            r.monday,
            r.tuesday,
            r.wednesday,
            r.thursday,
            r.friday,
            r.saturday,
            r.sunday
          ])
          setSchedule(matrix)
          localStorage.setItem('schedule', JSON.stringify(matrix))
        }
      } catch (err) {
        console.error('Failed to fetch schedule from Supabase:', err)
      }
    }
  }, [])

  // Effect to load data when user or week changes
  useEffect(() => {
    loadWeekData(week, user)
  }, [week, user, loadWeekData])

  useEffect(() => {
    if (user) {
      loadScheduleData(user)
    }
  }, [user, loadScheduleData])

  // Supabase Realtime Subscription across devices
  useEffect(() => {
    if (!user) return

    const channel = supabase
      .channel(`realtime-sync:${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', filter: `user_id=eq.${user.id}` },
        () => {
          loadWeekData(week, user)
          loadScheduleData(user)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user, week, loadWeekData, loadScheduleData])

  // Window Focus / Tab Switch Auto Sync
  useEffect(() => {
    const handleFocus = () => {
      if (user) {
        loadWeekData(week, user)
        loadScheduleData(user)
      }
    }

    window.addEventListener('focus', handleFocus)
    return () => {
      window.removeEventListener('focus', handleFocus)
    }
  }, [user, week, loadWeekData, loadScheduleData])

  // Local storage backup effect
  useEffect(() => {
    localStorage.setItem(`tracker-${week}`, JSON.stringify(tracker))
  }, [tracker, week])

  // Manual refresh / force sync
  const handleManualSync = () => {
    if (user) {
      loadWeekData(week, user)
      loadScheduleData(user)
    }
  }

  // Save schedule to LocalStorage & Supabase
  const handleSaveSchedule = async () => {
    if (editing) {
      localStorage.setItem('schedule', JSON.stringify(schedule))
      if (user) {
        setSyncing(true)
        try {
          await saveScheduleToDb(user.id, schedule)
        } catch (err) {
          console.error('Failed to save schedule to Supabase:', err)
          setDbError('ไม่สามารถบันทึกตารางลง Supabase ได้ โปรดตรวจสอบโครงสร้างตาราง')
        } finally {
          setSyncing(false)
        }
      }
    }
    setEditing(!editing)
  }

  // Update task field and sync to Supabase
  const update = async (day, id, field, value) => {
    let updatedTaskItem = null

    setTracker((current) => {
      const updatedDayList = current[day].map((item) => {
        if (item.id === id) {
          updatedTaskItem = { ...item, [field]: value }
          return updatedTaskItem
        }
        return item
      })
      return { ...current, [day]: updatedDayList }
    })

    if (user && updatedTaskItem) {
      try {
        const savedData = await saveTaskToDb(user.id, week, day, updatedTaskItem)
        if (savedData?.id && updatedTaskItem.dbId !== savedData.id) {
          setTracker((current) => ({
            ...current,
            [day]: current[day].map((item) => item.id === id ? { ...item, dbId: savedData.id, id: savedData.id } : item)
          }))
        }
      } catch (err) {
        console.error('Failed to sync updated task to Supabase:', err)
        setDbError('ไม่สามารถบันทึกเป้าหมายลง Supabase ได้ (โปรดตรวจสอบว่าได้รัน schema.sql แล้วหรือยัง)')
      }
    }
  }

  // Add task and sync to Supabase
  const handleAddTask = async (day) => {
    const newTask = task(Date.now())
    setTracker((current) => ({
      ...current,
      [day]: [...current[day], newTask]
    }))

    if (user) {
      try {
        const savedData = await saveTaskToDb(user.id, week, day, newTask)
        if (savedData?.id) {
          setTracker((current) => ({
            ...current,
            [day]: current[day].map((item) => item.id === newTask.id ? { ...item, dbId: savedData.id, id: savedData.id } : item)
          }))
        }
      } catch (err) {
        console.error('Failed to add task to Supabase:', err)
        setDbError('ไม่สามารถเพิ่มเป้าหมายลง Supabase ได้')
      }
    }
  }

  // Delete task and sync to Supabase
  const handleDeleteTask = async (day, targetItem) => {
    setTracker((current) => ({
      ...current,
      [day]: current[day].filter((entry) => entry.id !== targetItem.id)
    }))

    if (user && targetItem.dbId) {
      try {
        await deleteTaskFromDb(targetItem.dbId)
      } catch (err) {
        console.error('Failed to delete task from Supabase:', err)
      }
    }
  }

  const loadWeek = (value) => {
    setWeek(value)
  }

  const stats = useMemo(() => {
    const result = Object.fromEntries(SUBJECTS.map((name) => [name, { hours: 0, count: 0 }]))
    Object.values(tracker).flat().forEach((item) => {
      if (item.completed && item.subject) {
        result[item.subject].hours += Number(item.duration)
        result[item.subject].count += 1
      }
    })
    return result
  }, [tracker])

  const total = Object.values(stats).reduce((sum, item) => sum + item.hours, 0)
  const tabs = [
    ['overview', BarChart3, 'ภาพรวม'],
    ['tracker', CheckSquare, 'บันทึกรายสัปดาห์'],
    ['schedule', CalendarDays, 'ตารางแม่แบบ'],
    ['info', Info, 'ข้อมูล & กลยุทธ์']
  ]

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand">
            <div className="brand-mark"><Target size={25} /></div>
            <div>
              <p className="eyebrow">KKU BOY • PHARMACY PATH</p>
              <h1>Road to Pharmacy KKU</h1>
              <p>ระบบวางแผนและติดตามการอ่านหนังสือสำหรับเด็ก ม.6</p>
            </div>
          </div>

          <div className="sync-group">
            {syncing ? (
              <div className="sync online">
                <RefreshCw size={15} className="spin" />
                <span>กำลังซิงค์...</span>
              </div>
            ) : user ? (
              <button className="sync online" onClick={handleManualSync} title={`ซิงค์คลาวด์แล้ว (${user.email})`}>
                <Cloud size={15} />
                <span>Cloud Sync</span>
                <span className="sync-email">({user.email})</span>
              </button>
            ) : (
              <div className="sync offline">
                <Cloud size={15} />
                <span>บันทึกในเครื่อง</span>
              </div>
            )}

            {user ? (
              <button className="auth-button" onClick={() => signOutUser()}>
                <LogOut size={15} />
                <span>ออกจากระบบ</span>
              </button>
            ) : (
              <button className="auth-button" onClick={() => setAuthModalOpen(true)}>
                <LogIn size={15} />
                <span>เข้าสู่ระบบ / ซิงค์ Cloud</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {dbError && (
        <div className="db-alert-banner">
          <AlertTriangle size={20} />
          <div>
            <b>แจ้งเตือนการเชื่อมต่อ Supabase Database:</b>
            <p>{dbError}</p>
          </div>
        </div>
      )}

      <nav className="tabs">
        {tabs.map(([key, Icon, label]) => (
          <button className={tab === key ? 'tab active' : 'tab'} key={key} onClick={() => setTab(key)}>
            <Icon size={17} />{label}
          </button>
        ))}
      </nav>

      <main className="main-panel">
        {tab === 'overview' && (
          <section className="fade">
            <div className="overview-hero">
              <div>
                <p className="eyebrow">WEEKLY MOMENTUM</p>
                <h2>เวลาที่เรียนสำเร็จทั้งหมด</h2>
                <p>รวมจากเป้าหมายที่ติ๊กเสร็จแล้วในสัปดาห์นี้</p>
              </div>
              <div className="total">
                <Clock3 size={28} />
                <strong>{total}</strong>
                <span>ชั่วโมง</span>
              </div>
            </div>
            <h3>แยกตามรายวิชา</h3>
            <div className="subject-grid">
              {SUBJECTS.map((name) => (
                <article className="subject-card" key={name}>
                  <div className="subject-card-header">
                    <BookOpen size={16} />
                    <b>{name}</b>
                  </div>
                  <strong>{stats[name].hours}</strong>
                  <small>ชม. · สำเร็จ {stats[name].count} ครั้ง</small>
                </article>
              ))}
            </div>
            <div className="tip">
              <Info size={20} />
              <span><b>Tips วิเคราะห์ตัวเอง:</b> หากวิชาคำนวณมีชั่วโมงน้อย ให้เพิ่มเวลาทำโจทย์และฝึกจับเวลาอย่างสม่ำเสมอ</span>
            </div>
          </section>
        )}

        {tab === 'tracker' && (
          <section className="fade">
            <div className="section-heading">
              <div>
                <p className="eyebrow">DAILY LOG</p>
                <h2>สมุดบันทึกเป้าหมายรายวัน</h2>
                <p>เลือกวิชาและเวลาที่ใช้ แล้วติ๊กเมื่อทำเสร็จ</p>
              </div>
              <label className="week-select">
                <CalendarDays size={16} />
                <select value={week} onChange={(event) => loadWeek(Number(event.target.value))}>
                  {Array.from({ length: 12 }, (_, index) => (
                    <option key={index + 1} value={index + 1}>แผนงานสัปดาห์ที่ {index + 1}</option>
                  ))}
                </select>
                <ChevronDown size={16} />
              </label>
            </div>

            <div className="day-grid">
              {DAYS.map((day) => {
                const items = tracker[day] || []
                const valid = items.filter((item) => item.subject || item.text)
                const progress = valid.length ? Math.round(valid.filter((item) => item.completed).length / valid.length * 100) : 0
                return (
                  <article className="day-card" key={day}>
                    <div className="day-title">
                      <b>วัน{day}</b>
                      <span>{progress}%</span>
                    </div>
                    <div className="progress">
                      <i style={{ width: `${progress}%` }} />
                    </div>
                    <div className="tasks">
                      {items.map((item) => (
                        <div className={item.completed ? 'task done' : 'task'} key={item.id}>
                          <button className="check" onClick={() => update(day, item.id, 'completed', !item.completed)}>
                            {item.completed && <Check size={16} />}
                          </button>
                          <div className="task-fields">
                            <div className="field-row">
                              <select value={item.subject} onChange={(event) => update(day, item.id, 'subject', event.target.value)}>
                                <option value="">เลือกวิชา</option>
                                {SUBJECTS.map((subject) => <option key={subject}>{subject}</option>)}
                              </select>
                              <select value={item.duration} onChange={(event) => update(day, item.id, 'duration', Number(event.target.value))}>
                                {DURATIONS.map((duration) => (
                                  <option key={duration} value={duration}>{duration ? `${duration} ชม.` : 'เวลา'}</option>
                                ))}
                              </select>
                            </div>
                            <input value={item.text} onChange={(event) => update(day, item.id, 'text', event.target.value)} placeholder="รายละเอียดเป้าหมาย" />
                          </div>
                          <button className="icon-button" aria-label="ลบเป้าหมาย" onClick={() => handleDeleteTask(day, item)}>
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
                      <button className="add-task" onClick={() => handleAddTask(day)}>
                        <Plus size={15} />เพิ่มเป้าหมาย
                      </button>
                    </div>
                  </article>
                )
              })}
            </div>
          </section>
        )}

        {tab === 'schedule' && (
          <section className="fade">
            <div className="section-heading">
              <div>
                <p className="eyebrow">YOUR RHYTHM</p>
                <h2>ตารางแม่แบบ 1 สัปดาห์</h2>
                <p>ปรับแต่งตารางหลักของคุณได้ตามจังหวะชีวิต</p>
              </div>
              <button className="primary-button" onClick={handleSaveSchedule}>
                {editing ? <Save size={16} /> : <Pencil size={16} />}
                {editing ? 'บันทึกตาราง' : 'แก้ไขตาราง'}
              </button>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>เวลา</th>
                    {DAYS.map((day) => <th key={day}>{day}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {schedule.map((row, rowIndex) => (
                    <tr key={rowIndex}>
                      {row.map((cell, columnIndex) => (
                        <td key={columnIndex}>
                          {editing ? (
                            <textarea
                              value={cell}
                              onChange={(event) => setSchedule((current) => current.map((line, index) => index === rowIndex ? line.map((value, column) => column === columnIndex ? event.target.value : value) : line))}
                            />
                          ) : cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {tab === 'info' && (
          <section className="fade info-page">
            <p className="eyebrow">THE BIG PICTURE</p>
            <h2>ข้อมูล & กลยุทธ์</h2>
            <p className="lead">เลือกสนามสอบให้ชัด แล้วแบ่งพลังไปกับวิชาที่ส่งผลต่อเป้าหมายมากที่สุด</p>
            <div className="strategy-grid">
              <article>
                <b className="number orange">01</b>
                <h3>รอบโควตาภาคฯ ม.ขอนแก่น</h3>
                <p>ใช้คะแนน NETSAT เป็นแกนหลัก สอบฟิสิกส์ เคมี ชีวะ คณิตศาสตร์ และภาษาอังกฤษ</p>
              </article>
              <article>
                <b className="number blue">02</b>
                <h3>รอบ กสพท. Admission</h3>
                <p><b>TPAT1 30%</b> และ <b>A-Level 70%</b> ครอบคลุมวิทย์ คณิต อังกฤษ ไทย และสังคม</p>
              </article>
            </div>
          </section>
        )}
      </main>

      <footer>วางแผนอย่างมีจังหวะ • ทำให้สม่ำเสมอ • ไปให้ถึง KKU</footer>

      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onAuthSuccess={(userObj) => setUser(userObj)}
      />
    </div>
  )
}
