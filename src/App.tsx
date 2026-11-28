import React, { useState, useEffect, useRef } from "react";
import {
  collection,
  query,
  orderBy,
  where,
  onSnapshot,
  setDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  doc,
} from "firebase/firestore";
import { db, testConnection, OperationType, handleFirestoreError } from "./firebase";
import { Workout, WorkoutLog, WorkoutTimeDetails, UserSettings } from "./types";
import { WORKOUTS, getWorkoutForToday } from "./data";
import RecommendScreen from "./components/RecommendScreen";
import PlaybackScreen from "./components/PlaybackScreen";
import AchievementScreen from "./components/AchievementScreen";
import RecordsScreen from "./components/RecordsScreen";
import SettingsScreen from "./components/SettingsScreen";

const DEFAULT_SETTINGS: UserSettings = {
  alarmTime: "08:30",
  meridiem: "pm",
  alarmHour: "08",
  alarmMin: "30",
  repeatDays: ["mon", "tue", "wed", "fri"],
  motivation: "오늘도 화이팅! 할 수 있다!",
};

type ScreenType =
  | "RECOMMEND"
  | "PLAYBACK"
  | "ACHIEVEMENT"
  | "RECORDS_LIST"
  | "RECORDS_REPORT"
  | "SETTINGS";

function deduplicateLogsByDateAndTitle(logs: WorkoutLog[]): {
  kept: WorkoutLog[];
  duplicates: WorkoutLog[];
} {
  const bestByKey = new Map<string, WorkoutLog>();
  const duplicates: WorkoutLog[] = [];

  for (const log of logs) {
    const key = `${log.dateString}::${log.title.trim()}`;
    const existing = bestByKey.get(key);
    if (!existing) {
      bestByKey.set(key, log);
    } else {
      const logRecency = Math.max(log.timestamp || 0, log.endTimestamp || 0);
      const existingRecency = Math.max(existing.timestamp || 0, existing.endTimestamp || 0);
      if (logRecency > existingRecency) {
        duplicates.push(existing);
        bestByKey.set(key, log);
      } else {
        duplicates.push(log);
      }
    }
  }

  const kept = Array.from(bestByKey.values()).sort(
    (a, b) => b.timestamp - a.timestamp
  );
  return { kept, duplicates };
}

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<ScreenType>("RECOMMEND");
  const deletingIdsRef = useRef<Set<string>>(new Set());
  const [workoutLogs, setWorkoutLogs] = useState<WorkoutLog[]>(() => {
    try {
      const saved = localStorage.getItem("today_workout_logs");
      if (saved) {
        const parsed = JSON.parse(saved) as WorkoutLog[];
        const { kept } = deduplicateLogsByDateAndTitle(parsed);
        localStorage.setItem("today_workout_logs", JSON.stringify(kept));
        return kept;
      }
    } catch (e) {
      console.error("Error parsing local logs", e);
    }
    return [];
  });

  const [settings, setSettings] = useState<UserSettings>(() => {
    const saved = localStorage.getItem("today_workout_settings");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Error parsing settings", e);
      }
    }
    return DEFAULT_SETTINGS;
  });

  const [activeWorkout, setActiveWorkout] = useState<Workout>(() => getWorkoutForToday());
  const [seenWorkoutIds, setSeenWorkoutIds] = useState<string[]>(() => [getWorkoutForToday().id]);
  const [lastCompletedMinutes, setLastCompletedMinutes] = useState<number>(15);
  const [lastCompletedDateText, setLastCompletedDateText] = useState<string>("2026.05.26");
  const [completionToast, setCompletionToast] = useState<string | null>(null);

  const handlePickNewWorkout = () => {
    let candidates = WORKOUTS.filter(
      (w) => w.id !== activeWorkout.id && !seenWorkoutIds.includes(w.id)
    );
    let resetSeen = false;
    if (candidates.length === 0) {
      candidates = WORKOUTS.filter((w) => w.id !== activeWorkout.id);
      resetSeen = true;
    }
    if (candidates.length === 0) return;

    const nextWorkout = candidates[Math.floor(Math.random() * candidates.length)];
    setActiveWorkout(nextWorkout);
    setSeenWorkoutIds((prev) =>
      resetSeen ? [activeWorkout.id, nextWorkout.id] : [...prev, nextWorkout.id]
    );
    showToast(`새로운 추천 영상을 찾았습니다: ${nextWorkout.title}`);
  };

  const showToast = (msg: string) => {
    setCompletionToast(msg);
    setTimeout(() => {
      setCompletionToast(null);
    }, 3500);
  };

  // Validate Firestore connection and subscribe to real-time workoutLogs
  useEffect(() => {
    testConnection();

    const q = query(collection(db, "workoutLogs"), orderBy("timestamp", "desc"));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const firestoreLogs: WorkoutLog[] = [];
        snapshot.forEach((docSnap) => {
          firestoreLogs.push({
            ...(docSnap.data() as WorkoutLog),
            firestoreId: docSnap.id,
          });
        });

        const { kept, duplicates } = deduplicateLogsByDateAndTitle(firestoreLogs);
        setWorkoutLogs(kept);
        localStorage.setItem("today_workout_logs", JSON.stringify(kept));

        // Remove already-accumulated duplicate records from Firestore, keeping only the most recent
        const toDelete = duplicates.filter(
          (dup) => dup.firestoreId && !deletingIdsRef.current.has(dup.firestoreId)
        );
        if (toDelete.length > 0) {
          toDelete.forEach((dup) => {
            if (dup.firestoreId) deletingIdsRef.current.add(dup.firestoreId);
          });
          Promise.all(
            toDelete.map(async (dup) => {
              const dupId = dup.firestoreId!;
              try {
                await deleteDoc(doc(db, "workoutLogs", dupId));
              } catch (err) {
                handleFirestoreError(err, OperationType.DELETE, `workoutLogs/${dupId}`);
              } finally {
                deletingIdsRef.current.delete(dupId);
              }
            })
          );
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, "workoutLogs");
      }
    );

    // Load userSettings from Firestore
    const loadSettings = async () => {
      try {
        const settingsSnap = await getDoc(doc(db, "userSettings", "default"));
        if (settingsSnap.exists()) {
          const remoteSettings = settingsSnap.data() as UserSettings;
          setSettings(remoteSettings);
          localStorage.setItem("today_workout_settings", JSON.stringify(remoteSettings));
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, "userSettings/default");
      }
    };
    loadSettings();

    return () => unsubscribe();
  }, []);

  // Keep settings synchronized with local storage
  useEffect(() => {
    localStorage.setItem("today_workout_settings", JSON.stringify(settings));
  }, [settings]);

  const handleSaveSettings = async (updated: UserSettings) => {
    setSettings(updated);
    localStorage.setItem("today_workout_settings", JSON.stringify(updated));
    try {
      await setDoc(doc(db, "userSettings", "default"), updated);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, "userSettings/default");
    }
  };

  const computedStreak = Math.max(3, workoutLogs.length);

  const handleStartWorkout = () => {
    setCurrentScreen("PLAYBACK");
  };

  // Complete workout handler with start time, end time, and duration saved to Firestore
  const handleCompleteWorkout = async (details: WorkoutTimeDetails) => {
    setLastCompletedMinutes(details.durationMinutes);
    setLastCompletedDateText(details.dateString);

    const logId = `log-${Date.now()}`;
    const newLog: WorkoutLog = {
      id: logId,
      workoutId: activeWorkout.id,
      title: activeWorkout.title,
      dateString: details.dateString,
      timestamp: details.endTimestamp,
      durationMinutes: details.durationMinutes,
      durationSeconds: details.durationSeconds,
      startTime: details.startTime,
      endTime: details.endTime,
      startTimestamp: details.startTimestamp,
      endTimestamp: details.endTimestamp,
      target: activeWorkout.target,
      thumbnail: activeWorkout.thumbnail,
    };

    let savedLog: WorkoutLog = { ...newLog, firestoreId: logId };

    try {
      const existingQuery = query(
        collection(db, "workoutLogs"),
        where("dateString", "==", details.dateString),
        where("title", "==", activeWorkout.title)
      );
      const existingSnap = await getDocs(existingQuery);

      if (!existingSnap.empty) {
        const sortedDocs = [...existingSnap.docs].sort(
          (a, b) => ((b.data().timestamp as number) || 0) - ((a.data().timestamp as number) || 0)
        );
        const primaryDoc = sortedDocs[0];
        const primaryData = primaryDoc.data() as WorkoutLog;
        const updatePayload = {
          startTime: details.startTime,
          endTime: details.endTime,
          durationMinutes: details.durationMinutes,
          durationSeconds: details.durationSeconds,
          startTimestamp: details.startTimestamp,
          endTimestamp: details.endTimestamp,
          timestamp: details.endTimestamp,
          dateString: details.dateString,
          title: activeWorkout.title,
          target: activeWorkout.target,
          thumbnail: activeWorkout.thumbnail,
        };
        await updateDoc(doc(db, "workoutLogs", primaryDoc.id), updatePayload);
        savedLog = {
          ...primaryData,
          ...updatePayload,
          firestoreId: primaryDoc.id,
        };

        // Clean up any extra duplicate docs for this date + title
        if (sortedDocs.length > 1) {
          await Promise.all(
            sortedDocs.slice(1).map((dupDoc) =>
              deleteDoc(doc(db, "workoutLogs", dupDoc.id))
            )
          );
        }
      } else {
        await setDoc(doc(db, "workoutLogs", logId), newLog);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `workoutLogs/${logId}`);
    }

    setWorkoutLogs((prev) => {
      const { kept } = deduplicateLogsByDateAndTitle([savedLog, ...prev]);
      localStorage.setItem("today_workout_logs", JSON.stringify(kept));
      return kept;
    });

    showToast(
      `${activeWorkout.title} · ${details.startTime}~${details.endTime} (${details.durationMinutes}분) 저장 완료!`
    );
    setCurrentScreen("RECOMMEND");
  };

  // Update start time, end time, and duration of an existing log in Firestore
  const handleUpdateLog = async (
    log: WorkoutLog,
    updates: {
      startTime: string;
      endTime: string;
      durationMinutes: number;
      durationSeconds: number;
      startTimestamp: number;
      endTimestamp: number;
    }
  ) => {
    const docId = log.firestoreId || log.id;
    const payload = {
      startTime: updates.startTime,
      endTime: updates.endTime,
      durationMinutes: updates.durationMinutes,
      durationSeconds: updates.durationSeconds,
      startTimestamp: updates.startTimestamp,
      endTimestamp: updates.endTimestamp,
      timestamp: updates.endTimestamp,
    };

    try {
      await updateDoc(doc(db, "workoutLogs", docId), payload);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `workoutLogs/${docId}`);
    }

    setWorkoutLogs((prev) => {
      const updatedList = prev
        .map((item) =>
          (item.firestoreId || item.id) === docId ? { ...item, ...payload } : item
        )
        .sort((a, b) => b.timestamp - a.timestamp);
      localStorage.setItem("today_workout_logs", JSON.stringify(updatedList));
      return updatedList;
    });

    showToast(
      `운동 시간이 ${updates.startTime}~${updates.endTime} (${updates.durationMinutes}분)으로 수정되었습니다.`
    );
  };

  // Delete a specific log from Firestore
  const handleDeleteLog = async (log: WorkoutLog) => {
    const docId = log.firestoreId || log.id;
    try {
      await deleteDoc(doc(db, "workoutLogs", docId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `workoutLogs/${docId}`);
    }

    setWorkoutLogs((prev) => {
      const filtered = prev.filter((item) => (item.firestoreId || item.id) !== docId);
      localStorage.setItem("today_workout_logs", JSON.stringify(filtered));
      return filtered;
    });

    showToast("운동 기록이 삭제되었습니다.");
  };

  // Clear all logs from Firestore and localStorage
  const handleClearLogs = async () => {
    try {
      const snapshot = await getDocs(collection(db, "workoutLogs"));
      await Promise.all(
        snapshot.docs.map((docSnap) => deleteDoc(doc(db, "workoutLogs", docSnap.id)))
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, "workoutLogs");
    }
    setWorkoutLogs([]);
    localStorage.removeItem("today_workout_logs");
    showToast("모든 운동 기록이 초기화되었습니다.");
  };

  return (
    <div className="min-h-screen bg-background text-on-background selection:bg-primary-fixed select-none pb-28">
      {completionToast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-inverse-surface text-inverse-on-surface text-sm px-5 py-3 rounded-full shadow-lg flex items-center gap-2 font-bold whitespace-nowrap max-w-[92vw] truncate">
          <span
            className="material-symbols-outlined text-[18px] text-secondary-fixed shrink-0"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            check_circle
          </span>
          <span className="truncate">{completionToast}</span>
        </div>
      )}

      {currentScreen === "RECOMMEND" && (
        <RecommendScreen
          workout={activeWorkout}
          onStart={handleStartWorkout}
          onPickNewWorkout={handlePickNewWorkout}
          onNavigateToRecords={() => setCurrentScreen("RECORDS_LIST")}
          onNavigateToSettings={() => setCurrentScreen("SETTINGS")}
        />
      )}

      {currentScreen === "PLAYBACK" && (
        <PlaybackScreen
          workout={activeWorkout}
          onClose={() => setCurrentScreen("RECOMMEND")}
          onComplete={handleCompleteWorkout}
        />
      )}

      {currentScreen === "ACHIEVEMENT" && (
        <AchievementScreen
          workoutTimeText={`${lastCompletedMinutes}분`}
          workoutDateText={lastCompletedDateText}
          streakDays={computedStreak}
          onNavigateToRecords={() => setCurrentScreen("RECORDS_LIST")}
        />
      )}

      {currentScreen === "RECORDS_LIST" && (
        <RecordsScreen
          logs={workoutLogs}
          activeTab="LIST"
          onNavigateToRecommend={() => setCurrentScreen("RECOMMEND")}
          onNavigateToSettings={() => setCurrentScreen("SETTINGS")}
          onUpdateLog={handleUpdateLog}
          onDeleteLog={handleDeleteLog}
          onClearLogs={handleClearLogs}
        />
      )}

      {currentScreen === "RECORDS_REPORT" && (
        <RecordsScreen
          logs={workoutLogs}
          activeTab="REPORT"
          onNavigateToRecommend={() => setCurrentScreen("RECOMMEND")}
          onNavigateToSettings={() => setCurrentScreen("SETTINGS")}
          onUpdateLog={handleUpdateLog}
          onDeleteLog={handleDeleteLog}
          onClearLogs={handleClearLogs}
        />
      )}

      {currentScreen === "SETTINGS" && (
        <SettingsScreen
          initialSettings={settings}
          onSave={handleSaveSettings}
          onClose={() => setCurrentScreen("RECOMMEND")}
        />
      )}

      {/* Global Bottom Navigation Bar across all screens except playback */}
      {currentScreen !== "PLAYBACK" && (
        <nav
          id="app-global-bottom-nav"
          className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[1200px] z-50 bg-surface/95 backdrop-blur-md border-t border-outline-variant/80 shadow-[0_-4px_16px_rgba(0,0,0,0.04)] flex justify-around items-center py-2.5 px-4 select-none"
        >
          <button
            id="nav-tab-recommend"
            onClick={() => setCurrentScreen("RECOMMEND")}
            className={`flex flex-col items-center justify-center pt-1 px-5 cursor-pointer active:scale-95 transition-all duration-200 ${
              currentScreen === "RECOMMEND"
                ? "text-primary border-t-2 border-primary font-bold"
                : "text-on-surface-variant/85 hover:text-primary font-medium border-t-2 border-transparent"
            }`}
          >
            <span
              className="material-symbols-outlined mb-0.5"
              style={{ fontVariationSettings: `'FILL' ${currentScreen === "RECOMMEND" ? 1 : 0}` }}
            >
              home
            </span>
            <span className="text-[12px]">홈</span>
          </button>

          <button
            id="nav-tab-completed-list"
            onClick={() => setCurrentScreen("RECORDS_LIST")}
            className={`flex flex-col items-center justify-center pt-1 px-5 cursor-pointer active:scale-95 transition-all duration-200 ${
              currentScreen === "RECORDS_LIST"
                ? "text-primary border-t-2 border-primary font-bold"
                : "text-on-surface-variant/85 hover:text-primary font-medium border-t-2 border-transparent"
            }`}
          >
            <span
              className="material-symbols-outlined mb-0.5"
              style={{ fontVariationSettings: `'FILL' ${currentScreen === "RECORDS_LIST" ? 1 : 0}` }}
            >
              list_alt
            </span>
            <span className="text-[12px]">완료 목록</span>
          </button>

          <button
            id="nav-tab-achievement-report"
            onClick={() => setCurrentScreen("RECORDS_REPORT")}
            className={`flex flex-col items-center justify-center pt-1 px-5 cursor-pointer active:scale-95 transition-all duration-200 ${
              currentScreen === "RECORDS_REPORT"
                ? "text-primary border-t-2 border-primary font-bold"
                : "text-on-surface-variant/85 hover:text-primary font-medium border-t-2 border-transparent"
            }`}
          >
            <span
              className="material-symbols-outlined mb-0.5"
              style={{ fontVariationSettings: `'FILL' ${currentScreen === "RECORDS_REPORT" ? 1 : 0}` }}
            >
              equalizer
            </span>
            <span className="text-[12px]">달성 리포트</span>
          </button>
        </nav>
      )}
    </div>
  );
}
