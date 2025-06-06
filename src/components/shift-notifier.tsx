"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Clock,
  Play,
  SquareX,
  Bell,
  Smartphone,
  Settings,
  Moon,
  Sun,
  ChevronDown,
  History,
  Activity,
  Volume2,
} from "lucide-react"
import { useTheme } from "./theme-provider"
interface ShiftLog {
  id: string
  startTime: Date
  endTime: Date
  duration: number
  alerts: string[]
  shiftDuration: number
  alertInterval: number
}

const ALERT_SOUNDS = [
  {
    id: "alarm_clock",
    name: "Alarm Clock",
    url: "https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg",
  },
  {
    id: "beep_short",
    name: "Short Beep",
    url: "https://actions.google.com/sounds/v1/alarms/beep_short.ogg",
  },
  {
    id: "digital_watch_alarm",
    name: "Digital Watch",
    url: "https://actions.google.com/sounds/v1/alarms/digital_watch_alarm_long.ogg",
  },
  {
    id: "medium_bell",
    name: "Medium Bell",
    url: "https://actions.google.com/sounds/v1/alarms/medium_bell.ogg",
  },
  {
    id: "spaceship_alarm",
    name: "Spaceship Alarm",
    url: "https://actions.google.com/sounds/v1/alarms/spaceship_alarm.ogg",
  },
  {
    id: "warning_tone",
    name: "Warning Tone",
    url: "https://actions.google.com/sounds/v1/alarms/warning_tone.ogg",
  },
]

const saveShiftLog = (
  endTime: Date,
  startTime: Date | null,
  notifications: string[],
  shiftDuration: number,
  alertInterval: number,
) => {
  if (!startTime) return

  const duration = (endTime.getTime() - startTime.getTime()) / (60 * 1000) // duration in minutes
  const log: ShiftLog = {
    id: Date.now().toString(),
    startTime,
    endTime,
    duration,
    alerts: notifications,
    shiftDuration,
    alertInterval,
  }

  const shiftLogs = JSON.parse(localStorage.getItem("shift-notifier-logs") || "[]")
  const updatedShiftLogs = [...shiftLogs, log]
  localStorage.setItem("shift-notifier-logs", JSON.stringify(updatedShiftLogs))
}

export default function ShiftNotifier() {
  const { theme, setTheme } = useTheme()
  const [startTime, setStartTime] = useState<Date | null>(null)
  const [nextAlert, setNextAlert] = useState<Date | null>(null)
  const [notifications, setNotifications] = useState<string[]>([])
  const [showModal, setShowModal] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [enableVibration, setEnableVibration] = useState(true)
  const [enableNotification, setEnableNotification] = useState(true)
  const [shiftDuration, setShiftDuration] = useState(5) // hours
  const [alertInterval, setAlertInterval] = useState(0.5) // minutes
  const [alertSound, setAlertSound] = useState("alarm_clock")
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [shiftLogs, setShiftLogs] = useState<ShiftLog[]>([])

  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const modalTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const vibrationIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const previewAudioRef = useRef<HTMLAudioElement | null>(null)
  const alertScheduledRef = useRef(false)

  // Load settings and logs from localStorage
  useEffect(() => {
    const savedSettings = localStorage.getItem("shift-notifier-settings")
    if (savedSettings) {
      const settings = JSON.parse(savedSettings)
      setEnableVibration(settings.enableVibration ?? true)
      setEnableNotification(settings.enableNotification ?? true)
      setShiftDuration(settings.shiftDuration ?? 5)
      setAlertInterval(settings.alertInterval ?? 0.5)
      setAlertSound(settings.alertSound ?? "alarm_clock")
    }

    const savedLogs = localStorage.getItem("shift-notifier-logs")
    if (savedLogs) {
      const logs = JSON.parse(savedLogs).map((log: any) => ({
        ...log,
        startTime: new Date(log.startTime),
        endTime: new Date(log.endTime),
      }))
      setShiftLogs(logs)
    }
  }, [])

  // Save settings to localStorage
  useEffect(() => {
    const settings = {
      enableVibration,
      enableNotification,
      shiftDuration,
      alertInterval,
      alertSound,
    }
    localStorage.setItem("shift-notifier-settings", JSON.stringify(settings))
  }, [enableVibration, enableNotification, shiftDuration, alertInterval, alertSound])

  // Update audio source when alert sound changes
  useEffect(() => {
    const selectedSound = ALERT_SOUNDS.find((sound) => sound.id === alertSound)
    if (audioRef.current && selectedSound) {
      audioRef.current.src = selectedSound.url
      audioRef.current.load()
    }
  }, [alertSound])

  useEffect(() => {
    if (startTime) {
      scheduleNextAlert()
    }
    return () => {
      if (intervalRef.current) clearTimeout(intervalRef.current)
      if (modalTimeoutRef.current) clearTimeout(modalTimeoutRef.current)
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current)
      if (vibrationIntervalRef.current) clearInterval(vibrationIntervalRef.current)
    }
  }, [startTime, alertInterval])

  useEffect(() => {
    if ("Notification" in window && Notification.permission !== "granted") {
      Notification.requestPermission()
    }
  }, [])

  const sendNotification = () => {
    if (enableNotification && "Notification" in window && Notification.permission === "granted") {
      new Notification("⏰ Shift Alert", {
        body: `${alertInterval} minutes have passed. Time check!`,
        icon: "https://cdn-icons-png.flaticon.com/512/1827/1827392.png",
      })
    }
  }

  const vibrateDevice = () => {
    if (enableVibration && navigator.vibrate) {
      stopVibration()
      vibrationIntervalRef.current = setInterval(() => {
        navigator.vibrate([500, 500])
      }, 1000)
    }
  }

  const stopVibration = () => {
    if (vibrationIntervalRef.current) {
      clearInterval(vibrationIntervalRef.current)
      vibrationIntervalRef.current = null
    }
    if (navigator.vibrate) {
      navigator.vibrate(0)
    }
  }

  const stopAlertSound = () => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
    }
  }

  const previewSound = () => {
    const selectedSound = ALERT_SOUNDS.find((sound) => sound.id === alertSound)
    if (selectedSound) {
      // Stop any currently playing preview
      if (previewAudioRef.current) {
        previewAudioRef.current.pause()
        previewAudioRef.current.currentTime = 0
      }

      // Create new audio element for preview
      previewAudioRef.current = new Audio(selectedSound.url)
      previewAudioRef.current.volume = 0.5 // Lower volume for preview
      previewAudioRef.current.play().catch((e) => console.log("Preview audio play failed:", e))

      // Stop preview after 3 seconds
      setTimeout(() => {
        if (previewAudioRef.current) {
          previewAudioRef.current.pause()
          previewAudioRef.current.currentTime = 0
        }
      }, 3000)
    }
  }

  const updateCountdown = (targetTime: Date) => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current)
    }
    countdownIntervalRef.current = setInterval(() => {
      const now = new Date()
      const diff = Math.max(0, Math.floor((targetTime.getTime() - now.getTime()) / 1000))
      setCountdown(diff)
      if (diff <= 0 && !alertScheduledRef.current) {
        alertScheduledRef.current = true
        triggerAlert()
      }
    }, 1000)
  }

  const triggerAlert = () => {
    playAlertSound()
    setShowModal(true)
    if (enableNotification) {
      sendNotification()
    }
    if (enableVibration) {
      vibrateDevice()
    }
    setNotifications((prev) => [...prev, new Date().toLocaleTimeString()])

    modalTimeoutRef.current = setTimeout(() => {
      handleCloseModal()
    }, 60000) // Auto-close modal after 60 seconds
  }

  const scheduleNextAlert = () => {
    const now = new Date()
    if (!startTime) return

    const endTime = new Date(startTime.getTime() + shiftDuration * 60 * 60 * 1000)

    if (now >= endTime) {
      endShift()
      return
    }

    const next = new Date(now.getTime() + alertInterval * 60 * 1000)
    setNextAlert(next)
    alertScheduledRef.current = false
    updateCountdown(next)
  }

  const startShift = () => {
    setStartTime(new Date())
    setNotifications([])
    setShowModal(false)
  }

  const endShift = () => {
    const endTime = new Date()
    if (startTime) {
      saveShiftLog(endTime, startTime, notifications, shiftDuration, alertInterval)
    }

    // Clean up all intervals and timeouts
    if (intervalRef.current) clearTimeout(intervalRef.current)
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current)
    if (modalTimeoutRef.current) clearTimeout(modalTimeoutRef.current)

    // Stop vibration and sound
    stopVibration()
    stopAlertSound()

    setStartTime(null)
    setNextAlert(null)
    setShowModal(false)
    alertScheduledRef.current = false
    setCountdown(0)
  }

  const handleCloseModal = () => {
    setShowModal(false)

    // Stop all alerts
    stopVibration()
    stopAlertSound()

    // Clear the modal timeout
    if (modalTimeoutRef.current) {
      clearTimeout(modalTimeoutRef.current)
      modalTimeoutRef.current = null
    }

    scheduleNextAlert()
  }

  const playAlertSound = () => {
    if (audioRef.current) {
      audioRef.current.play().catch((e) => console.log("Audio play failed:", e))
    }
  }

  const handleVibrationToggle = (checked: boolean) => {
    setEnableVibration(checked)
    if (!checked) {
      stopVibration()
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return `${hours}h ${mins}m`
  }

  const clearLogs = () => {
    setShiftLogs([])
    localStorage.removeItem("shift-notifier-logs")
  }

  const selectedSoundName = ALERT_SOUNDS.find((sound) => sound.id === alertSound)?.name || "Alarm Clock"

  return (
    <div className="min-h-screen bg-background p-4 flex items-center justify-center">
      <div className="max-w-md mx-auto space-y-6">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center gap-2">
              <Clock className="h-5 w-5" />
              Shift Notifier
            </CardTitle>
            <CardDescription>Track your work shift with periodic alerts</CardDescription>
          </CardHeader>
          <CardContent>
            <audio
              ref={audioRef}
              src={ALERT_SOUNDS.find((sound) => sound.id === alertSound)?.url}
              preload="auto"
              loop
            />

            <Tabs defaultValue="main" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="main" className="flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  Main
                </TabsTrigger>
                <TabsTrigger value="logs" className="flex items-center gap-2">
                  <History className="h-4 w-4" />
                  Logs
                </TabsTrigger>
              </TabsList>

              <TabsContent value="main" className="space-y-6 mt-6">
                {/* Quick Settings */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Bell className="h-4 w-4" />
                      <Label htmlFor="notifications" className="text-sm font-medium">
                        Notifications
                      </Label>
                    </div>
                    <Switch id="notifications" checked={enableNotification} onCheckedChange={setEnableNotification} />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Smartphone className="h-4 w-4" />
                      <Label htmlFor="vibration" className="text-sm font-medium">
                        Vibration
                      </Label>
                    </div>
                    <Switch id="vibration" checked={enableVibration} onCheckedChange={handleVibrationToggle} />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      {theme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
                      <Label htmlFor="darkmode" className="text-sm font-medium">
                        Dark Mode
                      </Label>
                    </div>
                    <Switch
                      id="darkmode"
                      checked={theme === "dark"}
                      onCheckedChange={(checked) => {
                        setTheme(checked ? "dark" : "light")
                      }}
                    />
                  </div>
                </div>

                {/* Advanced Settings */}
                <Collapsible open={settingsOpen} onOpenChange={setSettingsOpen}>
                  <CollapsibleTrigger asChild>
                    <Button variant="outline" className="w-full justify-between">
                      <div className="flex items-center gap-2">
                        <Settings className="h-4 w-4" />
                        Advanced Settings
                      </div>
                      <ChevronDown className={`h-4 w-4 transition-transform ${settingsOpen ? "rotate-180" : ""}`} />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label htmlFor="shift-duration" className="text-sm font-medium">
                        Shift Duration (hours)
                      </Label>
                      <Select
                        value={shiftDuration.toString()}
                        onValueChange={(value) => setShiftDuration(Number(value))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="4">4 hours</SelectItem>
                          <SelectItem value="5">5 hours</SelectItem>
                          <SelectItem value="6">6 hours</SelectItem>
                          <SelectItem value="8">8 hours</SelectItem>
                          <SelectItem value="10">10 hours</SelectItem>
                          <SelectItem value="12">12 hours</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="alert-interval" className="text-sm font-medium">
                        Alert Interval (minutes)
                      </Label>
                      <Input
                        id="alert-interval"
                        type="number"
                        min="0.5"
                        max="60"
                        step="0.5"
                        value={alertInterval}
                        onChange={(e) => setAlertInterval(Number(e.target.value))}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="alert-sound" className="text-sm font-medium">
                        Alert Sound
                      </Label>
                      <div className="flex gap-2">
                        <Select value={alertSound} onValueChange={setAlertSound}>
                          <SelectTrigger className="flex-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ALERT_SOUNDS.map((sound) => (
                              <SelectItem key={sound.id} value={sound.id}>
                                {sound.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button variant="outline" size="icon" onClick={previewSound} title="Preview sound">
                          <Volume2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">Current: {selectedSoundName}</p>
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                <Separator />

                {/* Shift Controls */}
                <div className="space-y-4">
                  {!startTime ? (
                    <Button onClick={startShift} className="w-full" size="lg">
                      <Play className="h-4 w-4 mr-2" />
                      Start Shift
                    </Button>
                  ) : (
                    <Button onClick={endShift} variant="destructive" className="w-full" size="lg">
                      <SquareX className="h-4 w-4 mr-2" />
                      End Shift
                    </Button>
                  )}
                </div>

                {/* Shift Information */}
                {startTime && (
                  <div className="space-y-4">
                    <Separator />
                    <div className="grid grid-cols-1 gap-3 text-sm">
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Shift started:</span>
                        <Badge variant="outline">{startTime.toLocaleTimeString()}</Badge>
                      </div>

                      {nextAlert && (
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Next alert:</span>
                          <Badge variant="outline">{nextAlert.toLocaleTimeString()}</Badge>
                        </div>
                      )}

                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Countdown:</span>
                        <Badge variant={countdown <= 10 ? "destructive" : "secondary"}>{formatTime(countdown)}</Badge>
                      </div>
                    </div>

                    {/* Current Shift Alert Log */}
                    {notifications.length > 0 && (
                      <>
                        <Separator />
                        <Collapsible>
                          <CollapsibleTrigger asChild>
                            <Button variant="outline" className="w-full justify-between">
                              <div className="flex items-center gap-2">
                                <Bell className="h-4 w-4" />
                                <span className="text-sm font-medium">
                                  Current Shift Alerts ({notifications.length})
                                </span>
                              </div>
                              <ChevronDown className="h-4 w-4 transition-transform data-[state=open]:rotate-180" />
                            </Button>
                          </CollapsibleTrigger>
                          <CollapsibleContent className="mt-2">
                            <ScrollArea className="h-32 w-full rounded-md border p-2">
                              <div className="space-y-1">
                                {notifications.map((note, index) => (
                                  <div key={index} className="text-xs text-muted-foreground">
                                    Alert #{index + 1}: {note}
                                  </div>
                                ))}
                              </div>
                            </ScrollArea>
                          </CollapsibleContent>
                        </Collapsible>
                      </>
                    )}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="logs" className="space-y-4 mt-6">
                {/* Shift History */}
                {shiftLogs.length > 0 ? (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <Label className="text-sm font-medium">Shift History ({shiftLogs.length})</Label>
                      <Button variant="outline" size="sm" onClick={clearLogs}>
                        Clear All
                      </Button>
                    </div>
                    <ScrollArea className="h-96 w-full rounded-md border p-2">
                      <div className="space-y-3">
                        {shiftLogs.map((log) => (
                          <div key={log.id} className="border rounded-lg p-3 space-y-2">
                            <div className="flex justify-between items-start">
                              <div className="font-medium text-sm">{log.startTime.toLocaleDateString()}</div>
                              <Badge variant="secondary" className="text-xs">
                                {formatDuration(log.duration)}
                              </Badge>
                            </div>
                            <div className="text-xs text-muted-foreground space-y-1">
                              <div>
                                Start: {log.startTime.toLocaleTimeString()} • End: {log.endTime.toLocaleTimeString()}
                              </div>
                              <div>
                                {log.alerts.length} alerts • {log.alertInterval}s intervals • {log.shiftDuration}h shift
                              </div>
                            </div>
                            {log.alerts.length > 0 && (
                              <div className="mt-2">
                                <div className="text-xs font-medium mb-1">Alert Times:</div>
                                <div className="text-xs text-muted-foreground">{log.alerts.join(", ")}</div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No shift logs yet</p>
                    <p className="text-sm">Start your first shift to see logs here</p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Alert Modal */}
        <Dialog open={showModal} onOpenChange={handleCloseModal}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Time Check
              </DialogTitle>
              <DialogDescription>{alertInterval} minutes have passed. Time for a quick check!</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">This alert will auto-close in 60 seconds</p>
              </div>
              <Button onClick={handleCloseModal} className="w-full">
                Close and Set Next Alert
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
